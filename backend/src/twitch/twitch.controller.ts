import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { TwitchIrcService } from './twitch-irc.service';
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
  constructor(private readonly twitchIrc: TwitchIrcService) {}

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
}
