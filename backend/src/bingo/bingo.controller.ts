import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BingoService } from './bingo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  MinLength,
  IsBoolean,
  IsArray,
} from 'class-validator';

class CreateGameDto {
  @IsString() @MinLength(1) title: string;
  @IsString() @MinLength(1) channelName: string;
  @IsInt() @Min(1) @Max(10) @IsOptional() maxWinners?: number;
  @IsBoolean() @IsOptional() autoStopEnabled?: boolean;
  @IsBoolean() @IsOptional() autoStopEod?: boolean;
  @IsString() @IsOptional() autoStopAt?: string;
  @IsBoolean() @IsOptional() buycardAllowFollowers?: boolean;
  @IsBoolean() @IsOptional() buycardAllowSubscribers?: boolean;
  @IsInt() @Min(0) @IsOptional() buycardMinFollowDays?: number;
  @IsInt() @Min(0) @IsOptional() buycardMinSubMonths?: number;
}

class DrawNumberDto {
  @IsInt() @Min(1) @Max(75) number: number;
}

class SaveMarkedDto {
  @IsArray() marked: boolean[][];
}

class AssignCardDto {
  @IsString() @MinLength(1) twitchName: string;
}

@Controller('games')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BingoController {
  constructor(private bingoService: BingoService) {}

  @Post()
  @Roles(UserRole.STREAMER)
  createGame(@Body() dto: CreateGameDto, @Req() req: any) {
    return this.bingoService.createGame(req.user.id, dto.channelName, dto.title, dto.maxWinners, {
      autoStopEnabled: dto.autoStopEnabled,
      autoStopEod: dto.autoStopEod,
      autoStopAt: dto.autoStopAt,
      buycardAllowFollowers: dto.buycardAllowFollowers,
      buycardAllowSubscribers: dto.buycardAllowSubscribers,
      buycardMinFollowDays: dto.buycardMinFollowDays,
      buycardMinSubMonths: dto.buycardMinSubMonths,
    });
  }

  @Patch(':id/start')
  @Roles(UserRole.STREAMER)
  startGame(@Param('id') id: string, @Req() req: any) {
    return this.bingoService.startGame(id, req.user.id, req.user.role);
  }

  @Patch(':id/stop')
  @Roles(UserRole.MODERATOR)
  stopGame(@Param('id') id: string, @Req() req: any) {
    return this.bingoService.stopGame(id, req.user.id, req.user.role);
  }

  @Get('active')
  getActiveGame(@Query('channel') channel: string) {
    return this.bingoService.getActiveGameByChannel(channel);
  }

  @Get('running')
  getRunningGame() {
    return this.bingoService.getRunningGame();
  }

  @Get('all-running')
  getAllRunningGames(@Req() req: any) {
    return this.bingoService.getAllRunningGames(req.user?.id, req.user?.role);
  }

  @Get('my-games')
  @Roles(UserRole.STREAMER)
  getMyGames(@Req() req: any) {
    return this.bingoService.getGamesByStreamer(req.user.id);
  }

  @Get('mod-games')
  @Roles(UserRole.MODERATOR)
  getModGames(@Req() req: any) {
    return this.bingoService.getGamesByModerator(req.user.id, req.user.role);
  }

  @Get(':id')
  getGame(@Param('id') id: string) {
    return this.bingoService.getGame(id);
  }

  @Get(':id/join-info')
  getJoinInfo(@Param('id') id: string) {
    return this.bingoService.getJoinInfo(id);
  }

  @Get(':id/cards')
  @Roles(UserRole.MODERATOR)
  getAllCards(@Param('id') id: string) {
    return this.bingoService.getAllCards(id);
  }

  @Get(':id/winners')
  getWinners(@Param('id') id: string) {
    return this.bingoService.getWinners(id);
  }

  @Get(':id/my-card')
  getMyCard(@Param('id') id: string, @Req() req: any) {
    return this.bingoService.getUserCard(id, req.user.id);
  }

  /** Any authenticated user can join a game as a player (creates own card, subject to buycard conditions) */
  @Post(':id/join')
  async joinGame(@Param('id') id: string, @Req() req: any) {
    const eligibility = await this.bingoService.checkBuycardEligibility(id, req.user.twitchId, undefined, req.user.role);
    if (!eligibility.eligible && eligibility.reason !== 'sub_months_irc_only') {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: 'BUYCARD_CONDITION_NOT_MET',
          reason: eligibility.reason,
          currentValue: eligibility.currentValue,
          requiredValue: eligibility.requiredValue,
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return this.bingoService.createCardForUser(id, req.user.id);
  }

  /** Check buycard eligibility for the current user */
  @Get(':id/buycard-eligibility')
  getBuycardEligibility(@Param('id') id: string, @Req() req: any) {
    return this.bingoService.checkBuycardEligibility(id, req.user.twitchId, undefined, req.user.role);
  }

  @Post(':id/numbers/random')
  @Roles(UserRole.MODERATOR)
  drawRandom(@Param('id') id: string, @Req() req: any) {
    return this.bingoService.drawRandomNumber(id, req.user.id);
  }

  @Post(':id/cards/assign')
  @Roles(UserRole.MODERATOR)
  assignCard(@Param('id') id: string, @Body() dto: AssignCardDto, @Req() req: any) {
    return this.bingoService.assignCard(id, dto.twitchName, req.user.id, req.user.role);
  }

  @Patch(':id/my-card/marked')
  @HttpCode(200)
  saveMarked(@Param('id') id: string, @Body() dto: SaveMarkedDto, @Req() req: any) {
    return this.bingoService.saveUserMarked(id, req.user.id, dto.marked);
  }

  @Post(':id/numbers')
  @Roles(UserRole.MODERATOR)
  drawNumber(@Param('id') id: string, @Body() dto: DrawNumberDto, @Req() req: any) {
    return this.bingoService.drawNumber(id, dto.number, req.user.id);
  }

  @Delete(':id/numbers/:number')
  @Roles(UserRole.MODERATOR)
  removeNumber(@Param('id') id: string, @Param('number') number: string) {
    return this.bingoService.removeNumber(id, parseInt(number, 10));
  }

  @Post(':id/claim-bingo')
  claimBingo(@Param('id') id: string, @Req() req: any) {
    return this.bingoService.claimBingo(id, req.user.id, 'BUTTON');
  }

  @Post(':id/cards')
  @Roles(UserRole.STREAMER)
  createCard(@Param('id') id: string, @Body('userId') userId: string) {
    return this.bingoService.createCardForUser(id, userId);
  }

  @Delete(':id/winners/:userId')
  @Roles(UserRole.MODERATOR)
  removeWinner(@Param('id') id: string, @Param('userId') userId: string) {
    return this.bingoService.removeWinner(id, userId);
  }
}
