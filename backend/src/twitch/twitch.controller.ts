import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TwitchIrcService } from './twitch-irc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

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
}
