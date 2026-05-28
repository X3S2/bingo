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
   */
  @Get('twitch')
  initiateLogin(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    // Store state with 10-minute expiry
    oauthStates.set(state, Date.now() + 10 * 60 * 1000);
    const authUrl = this.authService.buildAuthUrl(state);
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

    // Validate state (CSRF protection)
    const expiry = oauthStates.get(state);
    if (!expiry || Date.now() > expiry) {
      oauthStates.delete(state);
      return res.redirect(`${appUrl}/auth/error?reason=invalid_state`);
    }
    oauthStates.delete(state);

    try {
      const tokenData = await this.authService.exchangeCode(code);
      const twitchUser = await this.authService.getTwitchUser(tokenData.access_token);
      const { accessToken } = await this.authService.loginWithTwitch(twitchUser);

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
