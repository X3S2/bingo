import { Module, forwardRef } from '@nestjs/common';
import { BingoService } from './bingo.service';
import { BingoController } from './bingo.controller';
import { CardGeneratorService } from './card-generator.service';
import { WinConditionService } from './win-condition.service';
import { GatewayModule } from '../gateway/gateway.module';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [forwardRef(() => GatewayModule), forwardRef(() => TwitchModule)],
  controllers: [BingoController],
  providers: [BingoService, CardGeneratorService, WinConditionService],
  exports: [BingoService, CardGeneratorService, WinConditionService],
})
export class BingoModule {}
