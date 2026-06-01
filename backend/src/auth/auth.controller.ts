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
import { RolesGuard, Roles } from './guards/roles.guard';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

// Simple in-memory state store (sufficient for single-instance)
const oauthStates = new Map<string, number>();
// Separate state store for bot account OAuth (admin-only)
const oauthBotStates = new Map<string, { expiry: number; adminId: string }>();

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  /**
   * Initiate bot account Twitch OAuth – admin only.
   * Redirects to Twitch login with only chat scopes and force_verify=true
   * so the admin can authenticate AS the bot account.
   * On completion the callback stores bot tokens in AdminSetting.
   */
  @Get('bot-twitch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async initiateBotLogin(@Req() req: Request, @Res() res: Response) {
    const rand = crypto.randomBytes(16).toString('hex');
    oauthBotStates.set(rand, { expiry: Date.now() + 10 * 60 * 1000, adminId: (req as any).user.id });
    const authUrl = await this.authService.buildBotAuthUrl(rand);
    return res.redirect(authUrl);
  }

  /**
   * Initiate Twitch OAuth – redirect user to Twitch
   * Optional ?invite=TOKEN query param embeds invite token into state
   * Optional ?returnTo=PATH query param redirects after login (relative paths only)
   */
  @Get('twitch')
  async initiateLogin(
    @Res() res: Response,
    @Query('invite') invite?: string,
    @Query('returnTo') returnTo?: string,
  ) {
    const rand = crypto.randomBytes(16).toString('hex');
    const invitePart = invite || '';
    // Validate returnTo: must be a relative path, no external redirects
    let returnToPart = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.includes('://') && returnTo.length < 200) {
      returnToPart = encodeURIComponent(returnTo);
    }
    const state = [rand, invitePart, returnToPart].join(':');
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

    // Parse state: may be "{rand}", "{rand}:{invite}", or "{rand}:{invite}:{returnTo}"
    const parts = state.split(':');
    const rand = parts[0];
    const inviteToken = parts[1] || '';
    const returnToEncoded = parts[2] || '';
    const returnToPath = returnToEncoded ? decodeURIComponent(returnToEncoded) : '';

    // ── Bot OAuth flow ────────────────────────────────────────────────────────
    // Check if this is a bot-account authorization (uses separate state map)
    const botState = oauthBotStates.get(rand);
    if (botState) {
      oauthBotStates.delete(rand);
      if (Date.now() > botState.expiry) {
        return res.redirect(`${appUrl}/auth/error?reason=invalid_state`);
      }
      try {
        const tokenData = await this.authService.exchangeCode(code);
        const botLogin = await this.authService.getBotLogin(tokenData.access_token);
        await this.authService.storeBotCredentials(botLogin, tokenData.access_token, tokenData.refresh_token);
        return res.redirect(`${appUrl}/admin?tab=bot&botauth=ok`);
      } catch {
        return res.redirect(`${appUrl}/admin?tab=bot&botauth=error`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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

      const redirectPath = returnToPath && returnToPath.startsWith('/') && !returnToPath.includes('://') ? returnToPath : '/dashboard';
      return res.redirect(`${appUrl}${redirectPath}`);
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
