import { Controller, Post, Body, ForbiddenException, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength, IsOptional } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

class SetupDto {
  @IsString() adminSetupToken: string;
  @IsOptional() @IsString() twitchClientId?: string;
  @IsOptional() @IsString() twitchClientSecret?: string;
  @IsString() @MinLength(1) botLogin: string;
  @IsString() @MinLength(1) botAccessToken: string;
  @IsOptional() @IsString() botRefreshToken?: string;
}

@Controller('setup')
export class SetupController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get('status')
  async getStatus() {
    const adminExists = await this.prisma.user.count({ where: { role: UserRole.ADMIN } });
    const isConfigured = await this.prisma.adminSetting.findUnique({
      where: { key: 'setup_complete' },
    });
    return {
      setupComplete: isConfigured?.value === 'true',
      hasAdmin: adminExists > 0,
    };
  }

  @Post()
  async runSetup(@Body() dto: SetupDto) {
    // Verify setup token
    const expectedToken = this.config.get<string>('ADMIN_SETUP_TOKEN');
    if (!expectedToken || dto.adminSetupToken !== expectedToken) {
      throw new ForbiddenException('Invalid setup token');
    }

    // Check if already completed
    const alreadyDone = await this.prisma.adminSetting.findUnique({
      where: { key: 'setup_complete' },
    });
    if (alreadyDone?.value === 'true') {
      throw new ForbiddenException('Setup already completed');
    }

    // Store Twitch app credentials (if provided)
    if (dto.twitchClientId) {
      await this.prisma.adminSetting.upsert({
        where: { key: 'twitch_client_id' },
        create: { key: 'twitch_client_id', value: dto.twitchClientId },
        update: { value: dto.twitchClientId },
      });
    }
    if (dto.twitchClientSecret) {
      await this.prisma.adminSetting.upsert({
        where: { key: 'twitch_client_secret' },
        create: { key: 'twitch_client_secret', value: dto.twitchClientSecret },
        update: { value: dto.twitchClientSecret },
      });
    }

    // Store bot credentials
    await this.prisma.adminSetting.upsert({
      where: { key: 'bot_login' },
      create: { key: 'bot_login', value: dto.botLogin },
      update: { value: dto.botLogin },
    });

    await this.prisma.adminSetting.upsert({
      where: { key: 'bot_access_token' },
      create: { key: 'bot_access_token', value: dto.botAccessToken },
      update: { value: dto.botAccessToken },
    });

    if (dto.botRefreshToken) {
      await this.prisma.adminSetting.upsert({
        where: { key: 'bot_refresh_token' },
        create: { key: 'bot_refresh_token', value: dto.botRefreshToken },
        update: { value: dto.botRefreshToken },
      });
    }

    // Mark setup as complete
    await this.prisma.adminSetting.upsert({
      where: { key: 'setup_complete' },
      create: { key: 'setup_complete', value: 'true' },
      update: { value: 'true' },
    });

    return { success: true, message: 'Setup completed successfully' };
  }
}
