import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardGeneratorService } from './card-generator.service';
import { WinConditionService } from './win-condition.service';
import { GameGateway } from '../gateway/game.gateway';
import { GameStatus, UserRole } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BingoService {
  constructor(
    private prisma: PrismaService,
    private cardGen: CardGeneratorService,
    private winCondition: WinConditionService,
    private gateway: GameGateway,
  ) {}

  // ── Game Management ───────────────────────────────────────

  async createGame(
    streamerId: string,
    channelName: string,
    title: string,
    maxWinners = 1,
    opts?: { autoStopEnabled?: boolean; autoStopEod?: boolean; autoStopAt?: string },
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
    return updated;
  }

  async getGame(gameId: string) {
    return this.getGameOrThrow(gameId);
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
      throw new BadRequestException('Game is not running');

    if (number < 1 || number > 75)
      throw new BadRequestException('Number must be between 1 and 75');

    // Check if already drawn
    const existing = await this.prisma.drawnNumber.findUnique({
      where: { gameId_number: { gameId, number } },
    });
    if (existing) throw new BadRequestException(`Number ${number} already drawn`);

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
      throw new BadRequestException('Game is not running');

    await this.prisma.drawnNumber.deleteMany({ where: { gameId, number } });

    // Recompute all card states from scratch
    await this.recomputeAllCards(gameId);

    this.gateway.emitToGame(gameId, 'number:removed', { number });
  }

  // ── Bingo Claim ───────────────────────────────────────────

  async claimBingo(gameId: string, userId: string, claimedVia = 'BUTTON') {
    const game = await this.getGameOrThrow(gameId);
    if (game.status !== GameStatus.RUNNING)
      throw new BadRequestException('Game is not running');

    const card = await this.prisma.bingoCard.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (!card) throw new NotFoundException('Card not found');

    const marked = card.marked as boolean[][];
    const { hasWon } = this.winCondition.checkWin(marked);
    if (!hasWon) throw new BadRequestException('No winning condition found on card');

    // Check if already a winner
    const existing = await this.prisma.winner.findUnique({
      where: { gameId_userId: { gameId, userId } },
    });
    if (existing) throw new BadRequestException('Already claimed Bingo');

    // Check max winners
    const winnerCount = await this.prisma.winner.count({ where: { gameId } });
    if (winnerCount >= game.maxWinners)
      throw new BadRequestException('Maximum winners already reached');

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

    // Auto-stop if max winners reached
    if (winnerCount + 1 >= game.maxWinners) {
      await this.stopGame(gameId, game.streamerId, UserRole.STREAMER);
    }

    return winner;
  }

  async getWinners(gameId: string) {
    return this.prisma.winner.findMany({
      where: { gameId },
      orderBy: { position: 'asc' },
      include: { user: { select: { displayName: true, profileImageUrl: true } } },
    });
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
