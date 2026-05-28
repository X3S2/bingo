import { Module, forwardRef } from '@nestjs/common';
import { TwitchIrcService } from './twitch-irc.service';
import { EventSubController } from './eventsub.controller';
import { BingoModule } from '../bingo/bingo.module';

@Module({
  imports: [forwardRef(() => BingoModule)],
  controllers: [EventSubController],
  providers: [TwitchIrcService],
  exports: [TwitchIrcService],
})
export class TwitchModule {}
