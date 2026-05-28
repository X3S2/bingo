import { Controller, Post, Body, ForbiddenException, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

class SetupDto {
  @IsString() setupToken: string;
  @IsString() @MinLength(1) botLogin: string;
  @IsString() @MinLength(1) botAccessToken: string;
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
      setupComplete: !!isConfigured,
      hasAdmin: adminExists > 0,
    };
  }

  @Post()
  async runSetup(@Body() dto: SetupDto) {
    // Verify setup token
    const expectedToken = this.config.get<string>('ADMIN_SETUP_TOKEN');
    if (!expectedToken || dto.setupToken !== expectedToken) {
      throw new ForbiddenException('Invalid setup token');
    }

    // Check if already completed
    const alreadyDone = await this.prisma.adminSetting.findUnique({
      where: { key: 'setup_complete' },
    });
    if (alreadyDone) {
      throw new ForbiddenException('Setup already completed');
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

    // Mark setup as complete
    await this.prisma.adminSetting.upsert({
      where: { key: 'setup_complete' },
      create: { key: 'setup_complete', value: 'true' },
      update: { value: 'true' },
    });

    return { success: true, message: 'Setup completed successfully' };
  }
}
