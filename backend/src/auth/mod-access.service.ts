import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class ModAccessService {
  private readonly logger = new Logger(ModAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check Twitch IRC mod status for a user and update ChannelModAccess + User.role.
   * Rate-limited by admin setting `mod_check_interval_minutes` (default 10).
   */
  async checkAndUpdate(user: User): Promise<void> {
    const intervalSetting = await this.prisma.adminSetting.findUnique({
      where: { key: 'mod_check_interval_minutes' },
    });
    const intervalMinutes = intervalSetting
      ? parseInt(intervalSetting.value, 10) || 10
      : 10;

    const now = new Date();
    const cutoff = new Date(now.getTime() - intervalMinutes * 60 * 1000);

    if (user.modLastCheckedAt && user.modLastCheckedAt > cutoff) {
      return; // Checked recently, skip
    }

    if (!user.twitchAccessToken) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { modLastCheckedAt: now },
      });
      return;
    }

    const clientIdSetting = await this.prisma.adminSetting.findUnique({
      where: { key: 'twitch_client_id' },
    });
    if (!clientIdSetting?.value) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { modLastCheckedAt: now },
      });
      return;
    }

    try {
      const response = await fetch(
        `https://api.twitch.tv/helix/moderation/channels?user_id=${encodeURIComponent(user.twitchId)}&first=100`,
        {
          headers: {
            'Client-Id': clientIdSetting.value,
            Authorization: `Bearer ${user.twitchAccessToken}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Twitch mod check failed for ${user.twitchId}: HTTP ${response.status}`,
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: { modLastCheckedAt: now },
        });
        return;
      }

      const data: {
        data: { broadcaster_id: string; broadcaster_login: string }[];
      } = await response.json();

      const activeChannels = data.data.map((c) =>
        c.broadcaster_login.toLowerCase(),
      );

      // Deactivate all existing channel mod entries for this user
      await this.prisma.channelModAccess.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      });

      // Upsert currently active channels
      for (const channelName of activeChannels) {
        await this.prisma.channelModAccess.upsert({
          where: { userId_channelName: { userId: user.id, channelName } },
          create: { userId: user.id, channelName, isActive: true },
          update: { isActive: true, updatedAt: now },
        });
      }

      // Promote VIEWER → MODERATOR or demote MODERATOR → VIEWER based on active mod status
      const hasActiveMod = activeChannels.length > 0;
      let newRole: UserRole = user.role;

      if (hasActiveMod && user.role === UserRole.VIEWER) {
        newRole = UserRole.MODERATOR;
      } else if (!hasActiveMod && user.role === UserRole.MODERATOR) {
        newRole = UserRole.VIEWER;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { modLastCheckedAt: now, role: newRole },
      });
    } catch (error) {
      this.logger.error(
        `Mod access check error for user ${user.twitchId}:`,
        error,
      );
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { modLastCheckedAt: now },
        });
      } catch {
        // Ignore secondary update errors
      }
    }
  }

  async canModerateGame(
    userId: string,
    channelName: string,
    gameUserId: string,
    userRole: UserRole,
  ): Promise<boolean> {
    if (userRole === UserRole.ADMIN) return true;
    if (userId === gameUserId) return true;
    const access = await this.prisma.channelModAccess.findUnique({
      where: { userId_channelName: { userId, channelName } },
    });
    return access?.isActive === true;
  }

  async getActiveModChannels(userId: string): Promise<string[]> {
    const records = await this.prisma.channelModAccess.findMany({
      where: { userId, isActive: true },
      select: { channelName: true },
    });
    return records.map((r) => r.channelName);
  }
}
