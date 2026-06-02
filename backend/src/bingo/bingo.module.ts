import { Module, forwardRef } from '@nestjs/common';
import { BingoService } from './bingo.service';
import { BingoController } from './bingo.controller';
import { CardGeneratorService } from './card-generator.service';
import { WinConditionService } from './win-condition.service';
import { GatewayModule } from '../gateway/gateway.module';
import { TwitchModule } from '../twitch/twitch.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => GatewayModule), forwardRef(() => TwitchModule), AuthModule],
  controllers: [BingoController],
  providers: [BingoService, CardGeneratorService, WinConditionService],
  exports: [BingoService, CardGeneratorService, WinConditionService],
})
export class BingoModule {}
