import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { TwitchIrcService } from './twitch-irc.service';
import { TwitchRewardService, ChannelPointsSettings } from './twitch-reward.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';

class BotJoinDto {
  @IsString() @MinLength(1) channelName: string;
}

@Controller('twitch')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TwitchController {
  constructor(
    private readonly twitchIrc: TwitchIrcService,
    private readonly twitchReward: TwitchRewardService,
  ) {}

  /** Returns which channels the bot has currently joined — accessible to MOD+ */
  @Get('bot-channels')
  @Roles(UserRole.MODERATOR, UserRole.STREAMER, UserRole.ADMIN)
  getBotChannels() {
    return { joinedChannels: this.twitchIrc.getJoinedChannels() };
  }

  /** Check whether the bot has joined the channel for a specific game */
  @Get('bot-joined/:channelName')
  @Roles(UserRole.MODERATOR, UserRole.STREAMER, UserRole.ADMIN)
  isBotJoined(@Param('channelName') channelName: string) {
    const joined = this.twitchIrc.getJoinedChannels().includes(channelName.toLowerCase());
    return { channelName: channelName.toLowerCase(), botJoined: joined };
  }

  /** Manually instruct the bot to join a channel (triggers on game start) */
  @Post('bot-join')
  @HttpCode(200)
  @Roles(UserRole.STREAMER, UserRole.ADMIN)
  async joinChannel(@Body() dto: BotJoinDto) {
    return this.twitchIrc.manualJoinChannel(dto.channelName);
  }

  /** Returns current bot command names/config for display (MOD+) */
  @Get('bot-commands')
  @Roles(UserRole.MODERATOR, UserRole.STREAMER, UserRole.ADMIN)
  async getBotCommands() {
    return this.twitchIrc.getPublicCmdConfig();
  }

  // ─── Channel Points Rewards ─────────────────────────────────────────────────

  /** Get current Channel Points settings for the logged-in streamer */
  @Get('rewards/settings')
  @Roles(UserRole.STREAMER, UserRole.ADMIN)
  async getRewardSettings(@Req() req: any) {
    return this.twitchReward.getSettings(req.user.id);
  }

  /** Save Channel Points settings */
  @Post('rewards/settings')
  @HttpCode(200)
  @Roles(UserRole.STREAMER, UserRole.ADMIN)
  async saveRewardSettings(@Req() req: any, @Body() body: Partial<ChannelPointsSettings>) {
    await this.twitchReward.saveSettings(req.user.id, body);
    return { success: true };
  }

  /** Create or verify Channel Points rewards on Twitch */
  @Post('rewards/setup')
  @HttpCode(200)
  @Roles(UserRole.STREAMER, UserRole.ADMIN)
  async setupRewards(@Req() req: any) {
    const result = await this.twitchReward.setupRewards(req.user.id);
    return result;
  }

  /** Check if a reward name already exists for the broadcaster */
  @Get('rewards/check-name')
  @Roles(UserRole.STREAMER, UserRole.ADMIN)
  async checkRewardName(@Req() req: any, @Query('name') name: string) {
    const user: any = req.user;
    if (!user.twitchAccessToken) {
      return { exists: false, noToken: true };
    }
    try {
      const rewards = await this.twitchReward.getChannelRewards(user.twitchId, user.twitchAccessToken);
      const exists = rewards.some((r: any) => r.title === name);
      return { exists };
    } catch {
      return { exists: false, error: true };
    }
  }
}
