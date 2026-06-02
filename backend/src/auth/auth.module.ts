import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ModAccessService } from './mod-access.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' as const },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ModAccessService, OptionalJwtAuthGuard, JwtStrategy, RolesGuard],
  exports: [AuthService, ModAccessService, JwtModule, RolesGuard],
})
export class AuthModule {}
