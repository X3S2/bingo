import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedeemType } from '@prisma/client';

export interface ChannelPointsSettings {
  mode: 'auto' | 'manual';
  selfEnabled: boolean;
  selfName: string;
  selfCost: number;
  selfMaxPerUser: number; // -1 = unlimited
  selfMaxPerStream: number; // -1 = unlimited (total redeems per stream, all users)
  selfRewardId?: string;
  giftEnabled: boolean;
  giftName: string;
  giftCost: number;
  giftMaxPerUser: number; // -1 = unlimited
  giftMaxPerStream: number; // -1 = unlimited
  giftRewardId?: string;
  configured?: boolean; // true once settings have been saved at least once
}

const DEFAULT_SETTINGS: ChannelPointsSettings = {
  mode: 'auto',
  selfEnabled: true,
  selfName: 'StreamBingoKarte',
  selfCost: 5000,
  selfMaxPerUser: 1,
  selfMaxPerStream: -1,
  selfRewardId: undefined,
  giftEnabled: false,
  giftName: 'StreamBingoKarte verschenken',
  giftCost: 5000,
  giftMaxPerUser: -1,
  giftMaxPerStream: -1,
  giftRewardId: undefined,
  configured: false,
};

@Injectable()
export class TwitchRewardService {
  private readonly logger = new Logger(TwitchRewardService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async getClientId(): Promise<string> {
    const setting = await this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_id' } });
    return setting?.value || this.config.get<string>('TWITCH_CLIENT_ID') || '';
  }

  // ─── Settings management ────────────────────────────────────

  private settingKey(userId: string, field: string) {
    return `cp_${userId}_${field}`;
  }

  private async getSetting(userId: string, field: string): Promise<string | null> {
    const record = await this.prisma.adminSetting.findUnique({
      where: { key: this.settingKey(userId, field) },
    });
    return record?.value ?? null;
  }

  private async setSetting(userId: string, field: string, value: string): Promise<void> {
    await this.prisma.adminSetting.upsert({
      where: { key: this.settingKey(userId, field) },
      create: { key: this.settingKey(userId, field), value },
      update: { value },
    });
  }

  async getSettings(userId: string): Promise<ChannelPointsSettings> {
    const keys = [
      'mode', 'self_enabled', 'self_name', 'self_cost', 'self_max_per_user', 'self_max_per_stream', 'self_reward_id',
      'gift_enabled', 'gift_name', 'gift_cost', 'gift_max_per_user', 'gift_max_per_stream', 'gift_reward_id',
      'cp_configured',
    ];
    const records = await this.prisma.adminSetting.findMany({
      where: { key: { in: keys.map((k) => this.settingKey(userId, k)) } },
    });
    const map = new Map(records.map((r) => [r.key, r.value]));
    const get = (field: string) => map.get(this.settingKey(userId, field));

    return {
      mode: (get('mode') as 'auto' | 'manual') ?? DEFAULT_SETTINGS.mode,
      selfEnabled: (get('self_enabled') ?? 'true') === 'true',
      selfName: get('self_name') ?? DEFAULT_SETTINGS.selfName,
      selfCost: parseInt(get('self_cost') ?? String(DEFAULT_SETTINGS.selfCost), 10),
      selfMaxPerUser: parseInt(get('self_max_per_user') ?? String(DEFAULT_SETTINGS.selfMaxPerUser), 10),
      selfMaxPerStream: parseInt(get('self_max_per_stream') ?? String(DEFAULT_SETTINGS.selfMaxPerStream), 10),
      selfRewardId: get('self_reward_id') ?? undefined,
      giftEnabled: (get('gift_enabled') ?? 'false') === 'true',
      giftName: get('gift_name') ?? DEFAULT_SETTINGS.giftName,
      giftCost: parseInt(get('gift_cost') ?? String(DEFAULT_SETTINGS.giftCost), 10),
      giftMaxPerUser: parseInt(get('gift_max_per_user') ?? String(DEFAULT_SETTINGS.giftMaxPerUser), 10),
      giftMaxPerStream: parseInt(get('gift_max_per_stream') ?? String(DEFAULT_SETTINGS.giftMaxPerStream), 10),
      giftRewardId: get('gift_reward_id') ?? undefined,
      configured: get('cp_configured') === 'true',
    };
  }

  async saveSettings(userId: string, settings: Partial<ChannelPointsSettings>): Promise<void> {
    const ops: Promise<void>[] = [];
    if (settings.mode !== undefined) ops.push(this.setSetting(userId, 'mode', settings.mode));
    if (settings.selfEnabled !== undefined) ops.push(this.setSetting(userId, 'self_enabled', String(settings.selfEnabled)));
    if (settings.selfName !== undefined) ops.push(this.setSetting(userId, 'self_name', settings.selfName));
    if (settings.selfCost !== undefined) ops.push(this.setSetting(userId, 'self_cost', String(settings.selfCost)));
    if (settings.selfMaxPerUser !== undefined) ops.push(this.setSetting(userId, 'self_max_per_user', String(settings.selfMaxPerUser)));
    if (settings.selfMaxPerStream !== undefined) ops.push(this.setSetting(userId, 'self_max_per_stream', String(settings.selfMaxPerStream)));
    if (settings.selfRewardId !== undefined) ops.push(this.setSetting(userId, 'self_reward_id', settings.selfRewardId));
    if (settings.giftEnabled !== undefined) ops.push(this.setSetting(userId, 'gift_enabled', String(settings.giftEnabled)));
    if (settings.giftName !== undefined) ops.push(this.setSetting(userId, 'gift_name', settings.giftName));
    if (settings.giftCost !== undefined) ops.push(this.setSetting(userId, 'gift_cost', String(settings.giftCost)));
    if (settings.giftMaxPerUser !== undefined) ops.push(this.setSetting(userId, 'gift_max_per_user', String(settings.giftMaxPerUser)));
    if (settings.giftMaxPerStream !== undefined) ops.push(this.setSetting(userId, 'gift_max_per_stream', String(settings.giftMaxPerStream)));
    if (settings.giftRewardId !== undefined) ops.push(this.setSetting(userId, 'gift_reward_id', settings.giftRewardId));
    // Mark settings as configured
    ops.push(this.setSetting(userId, 'cp_configured', 'true'));
    await Promise.all(ops);
  }

  // ─── Twitch Channel Points API ───────────────────────────────

  /** Get all custom rewards the broadcaster has */
  async getChannelRewards(twitchId: string, accessToken: string) {
    const clientId = await this.getClientId();
    const res = await fetch(
      `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${twitchId}&only_manageable_rewards=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': clientId,
        },
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twitch API error ${res.status}: ${err}`);
    }
    const data: any = await res.json();
    return (data.data ?? []) as any[];
  }

  /** Create a custom reward */
  async createChannelReward(twitchId: string, accessToken: string, payload: object) {
    const clientId = await this.getClientId();
    const res = await fetch(
      `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${twitchId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twitch API error ${res.status}: ${err}`);
    }
    const data: any = await res.json();
    return data.data[0] as any;
  }

  /** Update a custom reward (e.g., enable/disable, change title/cost) */
  async updateChannelReward(twitchId: string, accessToken: string, rewardId: string, payload: object) {
    const clientId = await this.getClientId();
    const res = await fetch(
      `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${twitchId}&id=${rewardId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twitch API error ${res.status}: ${err}`);
    }
    const data: any = await res.json();
    return data.data[0] as any;
  }

  /** Delete a custom reward */
  async deleteChannelReward(twitchId: string, accessToken: string, rewardId: string) {
    const clientId = await this.getClientId();
    const res = await fetch(
      `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${twitchId}&id=${rewardId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': clientId,
        },
      },
    );
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Twitch API error ${res.status}: ${err}`);
    }
  }

  // ─── High-level orchestration ────────────────────────────────

  /**
   * Set up (create if missing) Channel Points rewards for a streamer.
   * Returns the updated settings with reward IDs.
   */
  async setupRewards(streamerId: string): Promise<{ selfRewardId?: string; giftRewardId?: string; warnings: string[] }> {
    const warnings: string[] = [];

    const user = await this.prisma.user.findUnique({ where: { id: streamerId } });
    if (!user?.twitchAccessToken) {
      return { warnings: ['Kein gespeichertes Twitch-Token. Bitte neu einloggen.'] };
    }

    const settings = await this.getSettings(streamerId);
    let selfRewardId = settings.selfRewardId;
    let giftRewardId = settings.giftRewardId;

    // Fetch existing rewards once
    let existingRewards: any[] = [];
    try {
      existingRewards = await this.getChannelRewards(user.twitchId, user.twitchAccessToken);
    } catch (e: any) {
      return { warnings: [e.message ?? 'Fehler beim Abrufen bestehender Rewards.'] };
    }

    const existingNames = new Map(existingRewards.map((r: any) => [r.title as string, r.id as string]));

    // Set up SELF reward
    if (settings.selfEnabled) {
      if (selfRewardId) {
        // Verify it still exists
        const exists = existingRewards.some((r: any) => r.id === selfRewardId);
        if (!exists) {
          selfRewardId = undefined;
          await this.setSetting(streamerId, 'self_reward_id', '');
          warnings.push(`SELF-Reward nicht mehr gefunden – wird neu erstellt.`);
        }
      }

      if (!selfRewardId) {
        // Check for name conflict
        if (existingNames.has(settings.selfName)) {
          const conflictId = existingNames.get(settings.selfName)!;
          warnings.push(`Reward "${settings.selfName}" existiert bereits – wird wiederverwendet.`);
          selfRewardId = conflictId;
          await this.setSetting(streamerId, 'self_reward_id', conflictId);
        } else {
          try {
            const reward = await this.createChannelReward(user.twitchId, user.twitchAccessToken, {
              title: settings.selfName,
              cost: settings.selfCost,
              is_enabled: false,
              is_max_per_user_per_stream_enabled: settings.selfMaxPerUser > 0,
              max_per_user_per_stream: settings.selfMaxPerUser > 0 ? settings.selfMaxPerUser : undefined,
              is_max_per_stream_enabled: settings.selfMaxPerStream > 0,
              max_per_stream: settings.selfMaxPerStream > 0 ? settings.selfMaxPerStream : undefined,
              should_redemptions_skip_request_queue: true,
              background_color: '#9147FF',
            });
            selfRewardId = reward.id;
            await this.setSetting(streamerId, 'self_reward_id', reward.id);
          } catch (e: any) {
            warnings.push(`SELF-Reward konnte nicht erstellt werden: ${e.message}`);
          }
        }
      }
    }

    // Set up GIFT reward
    if (settings.giftEnabled) {
      if (giftRewardId) {
        const exists = existingRewards.some((r: any) => r.id === giftRewardId);
        if (!exists) {
          giftRewardId = undefined;
          await this.setSetting(streamerId, 'gift_reward_id', '');
          warnings.push(`GIFT-Reward nicht mehr gefunden – wird neu erstellt.`);
        }
      }

      if (!giftRewardId) {
        if (existingNames.has(settings.giftName)) {
          const conflictId = existingNames.get(settings.giftName)!;
          warnings.push(`Reward "${settings.giftName}" existiert bereits – wird wiederverwendet.`);
          giftRewardId = conflictId;
          await this.setSetting(streamerId, 'gift_reward_id', conflictId);
        } else {
          try {
            const reward = await this.createChannelReward(user.twitchId, user.twitchAccessToken, {
              title: settings.giftName,
              cost: settings.giftCost,
              is_enabled: false,
              is_user_input_required: true,
              prompt: 'Gib den Twitch-Namen des Empfängers ein (max. 200 Zeichen). Groß-/Kleinschreibung egal.',
              is_max_per_user_per_stream_enabled: settings.giftMaxPerUser > 0,
              max_per_user_per_stream: settings.giftMaxPerUser > 0 ? settings.giftMaxPerUser : undefined,
              is_max_per_stream_enabled: settings.giftMaxPerStream > 0,
              max_per_stream: settings.giftMaxPerStream > 0 ? settings.giftMaxPerStream : undefined,
              should_redemptions_skip_request_queue: true,
              background_color: '#9147FF',
            });
            giftRewardId = reward.id;
            await this.setSetting(streamerId, 'gift_reward_id', reward.id);
          } catch (e: any) {
            warnings.push(`GIFT-Reward konnte nicht erstellt werden: ${e.message}`);
          }
        }
      }
    }

    return { selfRewardId, giftRewardId, warnings };
  }

  /**
   * Enable or disable a streamer's Channel Points rewards.
   * Called when a game starts (enable=true) or stops (enable=false).
   * Also creates/updates Redeem records in DB for the specific game.
   */
  async toggleGameRewards(streamerId: string, gameId: string, enable: boolean): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: streamerId } });
    if (!user?.twitchAccessToken) return;

    const settings = await this.getSettings(streamerId);
    if (settings.mode !== 'auto') return;

    const ops: Promise<void>[] = [];

    if (settings.selfEnabled && settings.selfRewardId) {
      ops.push(
        this.updateChannelReward(user.twitchId, user.twitchAccessToken, settings.selfRewardId, {
          is_enabled: enable,
        }).then(async () => {
          if (enable) {
            // Upsert Redeem record for this game
            await this.prisma.redeem.upsert({
              where: {
                gameId_type: { gameId, type: RedeemType.SELF },
              },
              create: {
                gameId,
                twitchRedeemId: settings.selfRewardId,
                type: RedeemType.SELF,
                title: settings.selfName,
                cost: settings.selfCost,
                isActive: true,
              },
              update: {
                twitchRedeemId: settings.selfRewardId,
                title: settings.selfName,
                cost: settings.selfCost,
                isActive: true,
              },
            });
          } else {
            await this.prisma.redeem.updateMany({
              where: { gameId, type: RedeemType.SELF },
              data: { isActive: false },
            });
          }
        }).catch((e) => this.logger.warn(`Failed to toggle SELF reward: ${e.message}`)),
      );
    }

    if (settings.giftEnabled && settings.giftRewardId) {
      ops.push(
        this.updateChannelReward(user.twitchId, user.twitchAccessToken, settings.giftRewardId, {
          is_enabled: enable,
        }).then(async () => {
          if (enable) {
            await this.prisma.redeem.upsert({
              where: {
                gameId_type: { gameId, type: RedeemType.GIFT },
              },
              create: {
                gameId,
                twitchRedeemId: settings.giftRewardId,
                type: RedeemType.GIFT,
                title: settings.giftName,
                cost: settings.giftCost,
                isActive: true,
              },
              update: {
                twitchRedeemId: settings.giftRewardId,
                title: settings.giftName,
                cost: settings.giftCost,
                isActive: true,
              },
            });
          } else {
            await this.prisma.redeem.updateMany({
              where: { gameId, type: RedeemType.GIFT },
              data: { isActive: false },
            });
          }
        }).catch((e) => this.logger.warn(`Failed to toggle GIFT reward: ${e.message}`)),
      );
    }

    await Promise.all(ops);
  }
}
