import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameGateway } from '../gateway/game.gateway';
import { BingoService } from '../bingo/bingo.service';
import { AuditAction, UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private gateway: GameGateway,
    private bingoService: BingoService,
  ) {}

  // ── Users ──────────────────────────────────────────────────

  async listUsers(page = 1, limit = 50, search?: string) {
    const where = search
      ? { displayName: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          twitchId: true,
          displayName: true,
          profileImageUrl: true,
          role: true,
          isBanned: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async banUser(targetId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isBanned: true, bannedAt: new Date(), bannedReason: reason },
    });

    await this.auditLog(adminId, AuditAction.USER_BANNED, 'User', targetId, { reason });
    this.gateway.emitToAll('user:banned', { userId: targetId });
    return updated;
  }

  async unbanUser(targetId: string, adminId: string) {
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isBanned: false, bannedAt: null, bannedReason: null },
    });

    await this.auditLog(adminId, AuditAction.USER_UNBANNED, 'User', targetId);
    return updated;
  }

  async changeUserRole(targetId: string, adminId: string, role: UserRole) {
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role },
    });

    await this.auditLog(adminId, AuditAction.USER_ROLE_CHANGED, 'User', targetId, { role });
    return updated;
  }

  // ── Games ──────────────────────────────────────────────────

  async listGames(page = 1, limit = 50) {
    const [games, total] = await Promise.all([
      this.prisma.bingoGame.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          streamer: { select: { displayName: true } },
          _count: { select: { cards: true, winners: true, drawnNumbers: true } },
        },
      }),
      this.prisma.bingoGame.count(),
    ]);

    return { games, total, page, limit };
  }

  async forceStopGame(gameId: string, adminId: string) {
    const stopped = await this.bingoService.stopGame(gameId, adminId, UserRole.ADMIN);
    await this.auditLog(adminId, AuditAction.GAME_STOPPED, 'BingoGame', gameId);
    return stopped;
  }

  // ── Settings ───────────────────────────────────────────────

  async getSetting(key: string) {
    return this.prisma.adminSetting.findUnique({ where: { key } });
  }

  async setSetting(key: string, value: string, adminId: string) {
    const setting = await this.prisma.adminSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: adminId },
      update: { value, updatedBy: adminId },
    });

    await this.auditLog(adminId, AuditAction.SETTINGS_UPDATED, 'Setting', key, { value });
    return setting;
  }

  async getAllSettings() {
    return this.prisma.adminSetting.findMany();
  }

  // ── Maintenance Mode ───────────────────────────────────────

  async setMaintenanceMode(enabled: boolean, message: string, adminId: string) {
    await this.setSetting('maintenance_enabled', String(enabled), adminId);
    await this.setSetting('maintenance_message', message, adminId);

    await this.auditLog(adminId, AuditAction.MAINTENANCE_TOGGLED, 'Setting', 'maintenance', {
      enabled,
      message,
    });

    this.gateway.emitToAll('maintenance:toggle', { enabled, message });
    return { enabled, message };
  }

  // ── Statistics ─────────────────────────────────────────────

  async getStats() {
    const [totalUsers, totalGames, activeGames, totalWinners] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.bingoGame.count(),
      this.prisma.bingoGame.count({ where: { status: 'RUNNING' } }),
      this.prisma.winner.count(),
    ]);

    return { totalUsers, totalGames, activeGames, totalWinners };
  }

  // ── Audit Log ──────────────────────────────────────────────

  async getAuditLog(page = 1, limit = 50) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { displayName: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { logs, total, page, limit };
  }

  private async auditLog(
    adminId: string,
    action: AuditAction,
    targetType?: string,
    targetId?: string,
    metadata?: any,
  ) {
    await this.prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, metadata },
    });
  }
}
