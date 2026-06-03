import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CardGeneratorService } from './card-generator.service';
import { WinConditionService } from './win-condition.service';
import { GameGateway } from '../gateway/game.gateway';
import { TwitchIrcService } from '../twitch/twitch-irc.service';
import { TwitchRewardService } from '../twitch/twitch-reward.service';
import { ModAccessService } from '../auth/mod-access.service';
import { GameStatus, UserRole } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface BuycardEligibilityResult {
  eligible: boolean;
  /** Reason for ineligibility */
  reason?: 'not_following' | 'follow_days' | 'not_subscribed' | 'sub_months' | 'scope_missing' | 'sub_months_irc_only';
  /** Current value (days following, or months subscribed) */
  currentValue?: number;
  /** Required value */
  requiredValue?: number;
}

@Injectable()
export class BingoService {
  /** Per-game cooldown for random number draws (10 seconds) */
  private readonly randomDrawCooldowns = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private cardGen: CardGeneratorService,
    private winCondition: WinConditionService,
    private gateway: GameGateway,
    @Inject(forwardRef(() => TwitchIrcService))
    private twitchIrc: TwitchIrcService,
    @Inject(forwardRef(() => TwitchRewardService))
    private twitchReward: TwitchRewardService,
    private readonly modAccessService: ModAccessService,
    private readonly config: ConfigService,
  ) {}

  // ── Game Management ───────────────────────────────────────

  async createGame(
    streamerId: string,
    channelName: string,
    title: string,
    maxWinners = 1,
    opts?: {
      autoStopEnabled?: boolean;
      autoStopEod?: boolean;
      autoStopAt?: string;
      buycardAllowFollowers?: boolean;
      buycardAllowSubscribers?: boolean;
      buycardMinFollowDays?: number;
      buycardMinSubMonths?: number;
    },
  ) {
    // Enforce: only one active (CREATED or RUNNING) game per channel at a time
    const existing = await this.prisma.bingoGame.findFirst({
      where: { channelName, status: { in: [GameStatus.CREATED, GameStatus.RUNNING] } },
    });
    if (existing) {
      throw new BadRequestException(
        `Auf Channel "${channelName}" läuft bereits ein Spiel (Status: ${existing.status}). Bitte beende es zuerst.`,
      );
    }
    return this.prisma.bingoGame.create({
      data: {
        streamerId,
        channelName,
        title,
        maxWinners,
        autoStopEnabled: opts?.autoStopEnabled ?? false,
        autoStopEod: opts?.autoStopEod ?? false,
        autoStopAt: opts?.autoStopAt ? new Date(opts.autoStopAt) : null,
        buycardAllowFollowers: opts?.buycardAllowFollowers ?? false,
        buycardAllowSubscribers: opts?.buycardAllowSubscribers ?? false,
        buycardMinFollowDays: opts?.buycardMinFollowDays ?? 0,
        buycardMinSubMonths: opts?.buycardMinSubMonths ?? 0,
      },
    });
  }

  async startGame(gameId: string, actorId: string, actorRole?: string) {
    const game = await this.getGameOrThrow(gameId);
    if (game.streamerId !== actorId && actorRole !== 'ADMIN') throw new ForbiddenException();
    if (game.status !== GameStatus.CREATED)
      throw new BadRequestException('Game already started or stopped');

    const updated = await this.prisma.bingoGame.update({
      where: { id: gameId },
      data: { status: GameStatus.RUNNING, startedAt: new Date() },
    });

    this.gateway.emitToGame(gameId, 'game:status', { status: GameStatus.RUNNING });

    // Auto-activate Channel Points rewards (fire-and-forget)
    this.twitchReward.toggleGameRewards(game.streamerId, gameId, true).catch(() => {});

    // Auto-join bot to channel
    this.twitchIrc.registerActiveGame(game.channelName, gameId);

    return updated;
  }

  async stopGame(gameId: string, actorId: string, actorRole: UserRole) {
    const game = await this.getGameOrThrow(gameId);

    const isStreamer = game.streamerId === actorId;
    const isAdmin = actorRole === UserRole.ADMIN;
    if (!isStreamer && !isAdmin) throw new ForbiddenException();

    const updated = await this.prisma.bingoGame.update({
      where: { id: gameId },
      data: { status: GameStatus.STOPPED, stoppedAt: new Date() },
    });

    this.gateway.emitToGame(gameId, 'game:status', { status: GameStatus.STOPPED });

    // Auto-deactivate Channel Points rewards (fire-and-forget)
    this.twitchReward.toggleGameRewards(game.streamerId, gameId, false).catch(() => {});

    // Auto-leave bot from channel
    this.twitchIrc.unregisterActiveGame(game.channelName);

    return updated;
  }

  async getGame(gameId: string) {
    const game = await this.prisma.bingoGame.findUnique({
      where: { id: gameId },
      include: { drawnNumbers: { orderBy: { drawnAt: 'asc' }, select: { number: true, drawnAt: true } } },
    });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  async getJoinInfo(gameId: string) {
    const game = await this.prisma.bingoGame.findUnique({
      where: { id: gameId },
      select: { channelName: true, streamerId: true, status: true },
    });
    if (!game) throw new NotFoundException('Game not found');
    const settings = await this.twitchReward.getSettings(game.streamerId);
    return {
      channelName: game.channelName,
      status: game.status,
      selfEnabled: settings.selfEnabled,
      selfName: settings.selfName,
      giftEnabled: settings.giftEnabled,
      giftName: settings.giftName,
      configured: settings.configured ?? false,
    };
  }

  async getActiveGameByChannel(channelName: string) {
    if (!channelName) return null;
    return this.prisma.bingoGame.findFirst({
      where: { channelName, status: GameStatus.RUNNING },
      select: { id: true, title: true, channelName: true, status: true, startedAt: true },
    });
  }

  async getRunningGame() {
    return this.prisma.bingoGame.findFirst({
      where: { status: GameStatus.RUNNING },
      select: { id: true, title: true, channelName: true, status: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getAllRunningGames(userId?: string, userRole?: string) {
    const games = await this.prisma.bingoGame.findMany({
      where: { status: GameStatus.RUNNING },
      select: { id: true, title: true, channelName: true, status: true, startedAt: true, streamerId: true },
      orderBy: { startedAt: 'desc' },
    });
    if (!userId) {
      return games.map(g => ({ ...g, canModerate: false }));
    }
    if (userRole === UserRole.ADMIN) {
      return games.map(g => ({ ...g, canModerate: true }));
    }
    const activeModChannels = await this.modAccessService.getActiveModChannels(userId);
    return games.map(g => ({
      ...g,
      canModerate: g.streamerId === userId || activeModChannels.includes(g.channelName.toLowerCase()),
    }));
  }

  async getGamesByModerator(userId: string, userRole: string) {
    return this.getAllRunningGames(userId, userRole);
  }

  async checkModeratorAccess(userId: string, gameId: string, userRole: string): Promise<void> {
    if (userRole === UserRole.ADMIN) return;
    const game = await this.getGameOrThrow(gameId);
    if (game.streamerId === userId) return;
    const activeModChannels = await this.modAccessService.getActiveModChannels(userId);
    if (!activeModChannels.includes(game.channelName.toLowerCase())) {
      throw new ForbiddenException('No moderator rights for this channel');
    }
  }

  async getGamesByStreamer(streamerId: string) {
    return this.prisma.bingoGame.findMany({
      where: { streamerId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { cards: true, winners: true, drawnNumbers: true } },
      },
    });
  }

  async getActiveGameForChannel(channelName: string) {
    return this.prisma.bingoGame.findFirst({
      where: { channelName, status: GameStatus.RUNNING },
      include: { drawnNumbers: { orderBy: { drawnAt: 'asc' } } },
    });
  }

  // ── Card Management ───────────────────────────────────────

  async createCardForUser(gameId: string, userId: string) {
    const game = await this.getGameOrThrow(gameId);
    if (game.status !== GameStatus.RUNNING)
      throw new BadRequestException('Game is not running');

    const existing = await this.prisma.bingoCard.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (existing) return existing; // Idempotent

    const { numbers } = this.cardGen.generateCard();
    const marked = this.cardGen.generateInitialMarked();

    const card = await this.prisma.bingoCard.create({
      data: { gameId, userId, grid: numbers, marked },
    });

    // Auto-apply already-drawn numbers
    const drawnNumbers = await this.prisma.drawnNumber.findMany({ where: { gameId } });
    if (drawnNumbers.length > 0) {
      let currentMarked = marked;
      for (const dn of drawnNumbers) {
        const { updated } = this.winCondition.applyNumber(numbers, currentMarked, dn.number);
        currentMarked = updated;
      }
      await this.prisma.bingoCard.update({
        where: { id: card.id },
        data: { marked: currentMarked },
      });
      card.marked = currentMarked as any;
    }

    return card;
  }

  async getUserCard(gameId: string, userId: string) {
    return this.prisma.bingoCard.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
  }

  async saveUserMarked(gameId: string, userId: string, marked: boolean[][]) {
    // Validate shape
    if (!Array.isArray(marked) || marked.length !== 5 || marked.some((r) => !Array.isArray(r) || r.length !== 5)) {
      throw new Error('Invalid marked grid');
    }
    // Ensure free cell (center) stays marked in player marks too
    const card = await this.prisma.bingoCard.findUnique({
      where: { gameId_userId: { gameId, userId } },
      select: { id: true, grid: true },
    });
    if (!card) return null;
    const grid = card.grid as (number | null)[][];
    const safePlayerMarked = marked.map((row, r) =>
      row.map((cell, c) => (grid[r][c] === null ? true : Boolean(cell))),
    );
    // Write to playerMarked only – server-tracked "marked" is not touched here
    return this.prisma.bingoCard.update({
      where: { id: card.id },
      data: { playerMarked: safePlayerMarked },
    });
  }

  async getAllCards(gameId: string) {
    return this.prisma.bingoCard.findMany({
      where: { gameId },
      include: { user: { select: { id: true, displayName: true, profileImageUrl: true } } },
    });
  }

  // ── Number Drawing ────────────────────────────────────────

  async drawNumber(gameId: string, number: number, drawnById?: string) {
    const game = await this.getGameOrThrow(gameId);
    if (game.status !== GameStatus.RUNNING)
      throw new BadRequestException('Das Spiel läuft nicht.');

    if (number < 1 || number > 75)
      throw new BadRequestException('Die Zahl muss zwischen 1 und 75 liegen.');

    // Check if already drawn
    const existing = await this.prisma.drawnNumber.findUnique({
      where: { gameId_number: { gameId, number } },
    });
    if (existing) throw new BadRequestException(`Zahl ${number} wurde bereits gezogen.`);

    const drawn = await this.prisma.drawnNumber.create({
      data: { gameId, number, drawnById },
    });

    // Update all active cards
    await this.updateAllCardsWithNumber(gameId, number);

    this.gateway.emitToGame(gameId, 'number:drawn', { number, drawnAt: drawn.drawnAt });
    return drawn;
  }

  async removeNumber(gameId: string, number: number) {
    const game = await this.getGameOrThrow(gameId);
    if (game.status !== GameStatus.RUNNING)
      throw new BadRequestException('Das Spiel läuft nicht.');

    await this.prisma.drawnNumber.deleteMany({ where: { gameId, number } });

    // Recompute all card states from scratch
    await this.recomputeAllCards(gameId);

    this.gateway.emitToGame(gameId, 'number:removed', { number });
  }

  // ── Bingo Claim ───────────────────────────────────────────

  async claimBingo(gameId: string, userId: string, claimedVia = 'BUTTON') {
    const game = await this.getGameOrThrow(gameId);
    if (game.status !== GameStatus.RUNNING)
      throw new BadRequestException('Das Spiel läuft nicht.');

    const card = await this.prisma.bingoCard.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (!card) throw new NotFoundException('Keine Karte gefunden.');

    const marked = card.marked as boolean[][];
    const { hasWon } = this.winCondition.checkWin(marked);
    if (!hasWon) throw new BadRequestException('Keine Gewinnbedingung auf deiner Karte erfüllt.');

    // Check if already a winner
    const existing = await this.prisma.winner.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (existing) throw new BadRequestException('Du hast bereits Bingo gemeldet.');

    // Check max winners
    const winnerCount = await this.prisma.winner.count({ where: { gameId } });
    if (winnerCount >= game.maxWinners)
      throw new BadRequestException('Die maximale Anzahl an Gewinnern wurde bereits erreicht.');

    const winner = await this.prisma.winner.create({
      data: {
        gameId,
        userId,
        cardId: card.id,
        position: winnerCount + 1,
        claimedVia,
      },
      include: { user: { select: { displayName: true, profileImageUrl: true } } },
    });

    this.gateway.emitToGame(gameId, 'winner:added', winner);

    // Announce bingo win in Twitch chat
    try {
      await this.twitchIrc.sayInGame(gameId, `🎉 @${winner.user.displayName} hat BINGO! (Platz ${winner.position})`);
    } catch { /* non-critical */ }

    // Auto-stop if max winners reached
    if (winnerCount + 1 >= game.maxWinners) {
      await this.stopGame(gameId, game.streamerId, UserRole.STREAMER);
    }

    return winner;
  }

  async removeWinner(gameId: string, userId: string) {
    const existing = await this.prisma.winner.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (!existing) throw new NotFoundException('Gewinner nicht gefunden.');

    await this.prisma.winner.delete({ where: { gameId_userId: { gameId, userId } } });

    // Re-number remaining winners
    const remaining = await this.prisma.winner.findMany({
      where: { gameId },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.winner.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      });
    }

    this.gateway.emitToGame(gameId, 'winner:removed', { userId });
    return { success: true };
  }

  async getWinners(gameId: string) {
    return this.prisma.winner.findMany({
      where: { gameId },
      orderBy: { position: 'asc' },
      include: { user: { select: { id: true, displayName: true, profileImageUrl: true } } },
    });
  }

  // ── Buycard Eligibility ───────────────────────────────────

  /**
   * Check if a viewer is eligible to receive a card based on the game's buycard conditions.
   *
   * Logic:
   *  - ADMIN / STREAMER / MODERATOR always bypass all conditions.
   *  - If neither flag is set → everyone is eligible.
   *  - Both flags can be active simultaneously: viewer qualifies if they meet EITHER condition.
   *  - Subscribers automatically satisfy follower conditions (hierarchy).
   *
   * @param irc  When called from IRC, pass { isSubscribed, subMonths } read from badge-info.
   *             When called from the web API, leave undefined (will use Twitch REST API).
   * @param userRole  The role of the requesting user (bypasses checks for staff roles).
   */
  async checkBuycardEligibility(
    gameId: string,
    viewerTwitchId: string,
    irc?: { isSubscribed: boolean; subMonths: number },
    userRole?: string,
  ): Promise<BuycardEligibilityResult> {
    // Staff roles always bypass buycard conditions
    if (userRole && ['ADMIN', 'STREAMER', 'MODERATOR'].includes(userRole)) {
      return { eligible: true };
    }

    const game = await this.prisma.bingoGame.findUnique({
      where: { id: gameId },
      select: {
        buycardAllowFollowers: true,
        buycardAllowSubscribers: true,
        buycardMinFollowDays: true,
        buycardMinSubMonths: true,
        streamerId: true,
      },
    });
    if (!game) return { eligible: true };

    // If neither restriction is active → everyone can join
    if (!game.buycardAllowFollowers && !game.buycardAllowSubscribers) {
      return { eligible: true };
    }

    const streamer = await this.prisma.user.findUnique({
      where: { id: game.streamerId },
      select: { twitchId: true, twitchAccessToken: true, twitchScopes: true },
    });
    if (!streamer?.twitchAccessToken) return { eligible: false, reason: 'scope_missing' };

    const clientId = await this.getClientId();
    const grantedScopes = (streamer.twitchScopes || '').split(/[\s,]+/).filter(Boolean);

    // ── Check subscriber condition (also satisfies follower condition) ──────
    let isSubscribed = false;
    let subMonths = 0;
    if (game.buycardAllowSubscribers || game.buycardAllowFollowers) {
      if (irc !== undefined) {
        isSubscribed = irc.isSubscribed;
        subMonths = irc.subMonths;
      } else if (grantedScopes.includes('channel:read:subscriptions')) {
        try {
          const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${streamer.twitchId}&user_id=${viewerTwitchId}`;
          const resp = await fetch(url, {
            headers: {
              Authorization: `Bearer ${streamer.twitchAccessToken}`,
              'Client-Id': clientId,
            },
          });
          if (resp.ok) {
            const data = await resp.json() as any;
            isSubscribed = (data.data?.length ?? 0) > 0;
          }
        } catch { /* ignore — will fall through to follower check */ }
      }
    }

    // Subscriber qualifies when subscriber flag is set and minMonths condition is met
    if (game.buycardAllowSubscribers && isSubscribed) {
      if (irc !== undefined) {
        // IRC: exact month count available
        if (subMonths >= game.buycardMinSubMonths) return { eligible: true };
        // Not enough months but subscribed → report sub_months error (only if no follower path available)
        if (!game.buycardAllowFollowers) {
          return {
            eligible: false,
            reason: 'sub_months',
            currentValue: subMonths,
            requiredValue: game.buycardMinSubMonths,
          };
        }
      } else {
        // Web: month count unavailable — accept if minMonths is 0, hint to use IRC otherwise
        if (game.buycardMinSubMonths === 0) return { eligible: true };
        return { eligible: true, reason: 'sub_months_irc_only' };
      }
    }

    // ── Check follower condition ──────────────────────────────────────────────
    if (game.buycardAllowFollowers) {
      // Subscribers implicitly satisfy follower requirement
      if (isSubscribed) return { eligible: true };

      if (!grantedScopes.includes('moderator:read:followers')) {
        return { eligible: false, reason: 'scope_missing' };
      }
      try {
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${streamer.twitchId}&user_id=${viewerTwitchId}`;
        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${streamer.twitchAccessToken}`,
            'Client-Id': clientId,
          },
        });
        if (resp.status === 401) return { eligible: false, reason: 'scope_missing' };
        if (!resp.ok) return { eligible: false, reason: 'scope_missing' };
        const data = await resp.json() as any;
        const entry = data.data?.[0];
        if (!entry) {
          // Not following — if subscriber path is also enabled, report as not following
          return {
            eligible: false,
            reason: 'not_following',
            currentValue: 0,
            requiredValue: game.buycardMinFollowDays,
          };
        }
        const daysSince = Math.floor(
          (Date.now() - new Date(entry.followed_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < game.buycardMinFollowDays) {
          return {
            eligible: false,
            reason: 'follow_days',
            currentValue: daysSince,
            requiredValue: game.buycardMinFollowDays,
          };
        }
        return { eligible: true };
      } catch {
        return { eligible: false, reason: 'scope_missing' };
      }
    }

    // Only subscriber condition was active but viewer is not subscribed
    if (game.buycardAllowSubscribers) {
      return {
        eligible: false,
        reason: 'not_subscribed',
        requiredValue: game.buycardMinSubMonths,
      };
    }

    return { eligible: true };
  }

  // ── Random Number Draw ────────────────────────────────────

  async drawRandomNumber(gameId: string, drawnById?: string) {
    const now = Date.now();
    const lastDraw = this.randomDrawCooldowns.get(gameId) ?? 0;
    if (now - lastDraw < 10_000) {
      throw new BadRequestException('Bitte warte 10 Sekunden zwischen Zufallszügen.');
    }

    const game = await this.getGameOrThrow(gameId);
    if (game.status !== GameStatus.RUNNING) throw new BadRequestException('Das Spiel läuft nicht.');

    const drawnNumbers = await this.prisma.drawnNumber.findMany({
      where: { gameId },
      select: { number: true },
    });
    const drawnSet = new Set(drawnNumbers.map((d) => d.number));
    const available = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));

    if (available.length === 0) {
      throw new BadRequestException('Alle Zahlen wurden bereits gezogen.');
    }

    const randomNumber = available[Math.floor(Math.random() * available.length)];
    this.randomDrawCooldowns.set(gameId, now);

    const drawn = await this.prisma.drawnNumber.create({
      data: { gameId, number: randomNumber, drawnById },
    });

    await this.updateAllCardsWithNumber(gameId, randomNumber);

    // Emit with isRandom: true so clients can trigger the animation
    this.gateway.emitToGame(gameId, 'number:drawn', {
      number: randomNumber,
      drawnAt: drawn.drawnAt,
      isRandom: true,
    });
    return drawn;
  }

  // ── Manual Card Assignment ────────────────────────────────

  async assignCard(gameId: string, twitchName: string, actorId: string, actorRole: string) {
    await this.checkModeratorAccess(actorId, gameId, actorRole);

    const user = await this.prisma.user.findFirst({
      where: { displayName: { equals: twitchName, mode: 'insensitive' } },
    });
    if (!user) {
      throw new NotFoundException(
        'Nutzer nicht gefunden – er muss sich mindestens einmal auf der Website angemeldet haben.',
      );
    }

    return this.createCardForUser(gameId, user.id);
  }

  // ── Auto-stop CRON ────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAutoStop() {
    const now = new Date();

    // Stop games that have reached their autoStopAt time
    const timedOut = await this.prisma.bingoGame.findMany({
      where: {
        status: GameStatus.RUNNING,
        autoStopEnabled: true,
        autoStopAt: { lte: now },
      },
    });

    for (const game of timedOut) {
      await this.stopGame(game.id, game.streamerId, UserRole.ADMIN);
    }

    // End-of-day auto-stop (23:59)
    const isEod = now.getHours() === 23 && now.getMinutes() === 59;
    if (isEod) {
      const eodGames = await this.prisma.bingoGame.findMany({
        where: { status: GameStatus.RUNNING, autoStopEod: true },
      });
      for (const game of eodGames) {
        await this.stopGame(game.id, game.streamerId, UserRole.ADMIN);
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────

  private async getClientId(): Promise<string> {
    const s = await this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_id' } });
    return s?.value || this.config.get<string>('TWITCH_CLIENT_ID') || '';
  }

  private async getGameOrThrow(gameId: string) {
    const game = await this.prisma.bingoGame.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  private async updateAllCardsWithNumber(gameId: string, number: number) {
    const cards = await this.prisma.bingoCard.findMany({ where: { gameId, isActive: true } });

    for (const card of cards) {
      const grid = card.grid as (number | null)[][];
      const marked = card.marked as boolean[][];
      const { updated, cellMarked } = this.winCondition.applyNumber(grid, marked, number);

      if (cellMarked) {
        await this.prisma.bingoCard.update({
          where: { id: card.id },
          data: { marked: updated },
        });

        this.gateway.emitToCard(card.id, 'card:updated', {
          cardId: card.id,
          marked: updated,
          newlyMarked: number,
        });
      }
    }
  }

  private async recomputeAllCards(gameId: string) {
    const cards = await this.prisma.bingoCard.findMany({ where: { gameId } });
    const drawnNumbers = await this.prisma.drawnNumber.findMany({
      where: { gameId },
      orderBy: { drawnAt: 'asc' },
    });

    for (const card of cards) {
      const grid = card.grid as (number | null)[][];
      let marked = this.cardGen.generateInitialMarked();

      for (const dn of drawnNumbers) {
        const { updated } = this.winCondition.applyNumber(grid, marked, dn.number);
        marked = updated;
      }

      await this.prisma.bingoCard.update({
        where: { id: card.id },
        data: { marked },
      });

      this.gateway.emitToCard(card.id, 'card:updated', {
        cardId: card.id,
        marked,
      });
    }
  }
}
