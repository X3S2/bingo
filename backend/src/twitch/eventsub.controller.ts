import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { BingoService } from '../bingo/bingo.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

const TWITCH_MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type';
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature';
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id';
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp';

@Controller('eventsub')
export class EventSubController {
  private readonly logger = new Logger(EventSubController.name);

  constructor(
    private config: ConfigService,
    private bingoService: BingoService,
    private prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleEventSub(
    @Req() req: RawBodyRequest<Request>,
    @Headers(TWITCH_MESSAGE_TYPE) messageType: string,
    @Headers(TWITCH_MESSAGE_ID) messageId: string,
    @Headers(TWITCH_MESSAGE_TIMESTAMP) timestamp: string,
    @Headers(TWITCH_MESSAGE_SIGNATURE) signature: string,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    // Verify HMAC signature
    if (!this.verifySignature(messageId, timestamp, rawBody, signature)) {
      this.logger.warn('EventSub: Invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    // Webhook verification challenge
    if (messageType === 'webhook_callback_verification') {
      return body.challenge;
    }

    if (messageType === 'notification') {
      await this.processNotification(body);
    }

    return 'OK';
  }

  private verifySignature(
    messageId: string,
    timestamp: string,
    rawBody: Buffer,
    signature: string,
  ): boolean {
    const secret = this.config.get<string>('TWITCH_EVENTSUB_SECRET');
    if (!secret) return false;

    const hmacMessage = messageId + timestamp + rawBody.toString('utf8');
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(hmacMessage).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  private async processNotification(body: any) {
    const { subscription, event } = body;
    const type: string = subscription?.type;

    this.logger.log(`EventSub notification: ${type}`);

    if (type === 'channel.channel_points_custom_reward_redemption.add') {
      await this.handleRedemption(event);
    }
  }

  private async handleRedemption(event: any) {
    const twitchRedeemId = event.reward?.id;
    const redeemerTwitchId = event.user_id;
    const userInput: string = event.user_input || '';

    // Find the redeem configuration
    const redeem = await this.prisma.redeem.findFirst({
      where: { twitchRedeemId, isActive: true },
      include: { game: true },
    });

    if (!redeem) return;
    if (redeem.game.status !== 'RUNNING') return;

    if (redeem.type === 'SELF') {
      // Create card for the redeemer
      const redeemer = await this.prisma.user.findUnique({
        where: { twitchId: redeemerTwitchId },
      });
      if (redeemer) {
        await this.bingoService.createCardForUser(redeem.gameId, redeemer.id).catch(() => {});
      }
    } else if (redeem.type === 'GIFT') {
      // Gift to another viewer – twitchName is in userInput
      const targetName = userInput.trim().replace('@', '').toLowerCase();
      if (!targetName) return;

      const targetUser = await this.prisma.user.findFirst({
        where: { displayName: { equals: targetName, mode: 'insensitive' } },
      });
      if (targetUser) {
        await this.bingoService.createCardForUser(redeem.gameId, targetUser.id).catch(() => {});
      }
    }
  }
}
