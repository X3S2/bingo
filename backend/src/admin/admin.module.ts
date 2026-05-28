import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BingoModule } from '../bingo/bingo.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [forwardRef(() => BingoModule), GatewayModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
