import { Module, forwardRef } from '@nestjs/common';
import { TwitchIrcService } from './twitch-irc.service';
import { TwitchRewardService } from './twitch-reward.service';
import { TwitchController } from './twitch.controller';
import { EventSubController } from './eventsub.controller';
import { BingoModule } from '../bingo/bingo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [forwardRef(() => BingoModule), PrismaModule, ConfigModule],
  controllers: [EventSubController, TwitchController],
  providers: [TwitchIrcService, TwitchRewardService],
  exports: [TwitchIrcService, TwitchRewardService],
})
export class TwitchModule {}
