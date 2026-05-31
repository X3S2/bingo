import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BingoModule } from '../bingo/bingo.module';
import { GatewayModule } from '../gateway/gateway.module';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [forwardRef(() => BingoModule), GatewayModule, forwardRef(() => TwitchModule)],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
