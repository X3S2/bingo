import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

// Simple in-memory state store (sufficient for single-instance)
const oauthStates = new Map<string, number>();

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  /**
   * Initiate Twitch OAuth – redirect user to Twitch
   * Optional ?invite=TOKEN query param embeds invite token into state
   */
  @Get('twitch')
  async initiateLogin(@Res() res: Response, @Query('invite') invite?: string) {
    const rand = crypto.randomBytes(16).toString('hex');
    // Embed optional invite token in state: "{rand}:{invite}"
    const state = invite ? `${rand}:${invite}` : rand;
    // Store the rand part as the state key with 10-minute expiry
    oauthStates.set(rand, Date.now() + 10 * 60 * 1000);
    const authUrl = await this.authService.buildAuthUrl(state);
    return res.redirect(authUrl);
  }

  /**
   * Twitch OAuth callback
   */
  @Get('callback/twitch')
  async twitchCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:4000';

    if (error) {
      return res.redirect(`${appUrl}/auth/error?reason=access_denied`);
    }

    // Parse state: may be "{rand}:{invite}" or just "{rand}"
    const [rand, inviteToken] = state.split(':');

    // Validate state (CSRF protection)
    const expiry = oauthStates.get(rand);
    if (!expiry || Date.now() > expiry) {
      oauthStates.delete(rand);
      return res.redirect(`${appUrl}/auth/error?reason=invalid_state`);
    }
    oauthStates.delete(rand);

    try {
      const tokenData = await this.authService.exchangeCode(code);
      const twitchUser = await this.authService.getTwitchUser(tokenData.access_token);
      const { accessToken } = await this.authService.loginWithTwitch(
        twitchUser,
        { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token },
        inviteToken,
      );

      // Set secure HttpOnly cookie
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return res.redirect(`${appUrl}/dashboard`);
    } catch {
      return res.redirect(`${appUrl}/auth/error?reason=auth_failed`);
    }
  }

  /**
   * Get current user info
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request) {
    return (req as any).user;
  }

  /**
   * Logout – clear cookie
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res() res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return res.json({ success: true });
  }
}
