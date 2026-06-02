import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ModAccessService } from './mod-access.service';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';

export interface TwitchUserData {
  twitchId: string;
  displayName: string;
  profileImageUrl?: string;
  email?: string;
}

export interface JwtPayload {
  sub: string;
  twitchId: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly modAccessService: ModAccessService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}
  async validateInviteToken(token: string) {
    const invite = await this.prisma.inviteToken.findUnique({ where: { token } });
    if (!invite) return { valid: false, reason: 'not_found' };
    if (invite.usedAt) return { valid: false, reason: 'already_used' };
    if (invite.expiresAt && invite.expiresAt < new Date()) return { valid: false, reason: 'expired' };
    return { valid: true, role: invite.role };
  }

  /**
   * Called after successful Twitch OAuth callback.
   * Creates or updates the user, returns a JWT.
   */
  async loginWithTwitch(
    userData: TwitchUserData,
    tokens?: { accessToken: string; refreshToken: string },
    inviteToken?: string,
  ): Promise<{ accessToken: string; user: any }> {
    let user = await this.prisma.user.findUnique({
      where: { twitchId: userData.twitchId },
    });

    if (!user) {
      // Check if this is the very first user (becomes admin)
      const userCount = await this.prisma.user.count();
      let role: UserRole = userCount === 0 ? UserRole.ADMIN : UserRole.VIEWER;

      // Check invite token for initial role assignment
      if (inviteToken && role === UserRole.VIEWER) {
        const invite = await this.prisma.inviteToken.findUnique({ where: { token: inviteToken } });
        if (invite && !invite.usedAt && (!invite.expiresAt || invite.expiresAt > new Date())) {
          role = invite.role;
        }
      }

      user = await this.prisma.user.create({
        data: {
          twitchId: userData.twitchId,
          displayName: userData.displayName,
          profileImageUrl: userData.profileImageUrl,
          email: userData.email,
          role,
          twitchAccessToken: tokens?.accessToken,
          twitchRefreshToken: tokens?.refreshToken,
        },
      });

      // Consume invite token
      if (inviteToken && role !== UserRole.ADMIN) {
        await this.prisma.inviteToken.updateMany({
          where: { token: inviteToken, usedAt: null },
          data: { usedAt: new Date(), usedBy: user.id },
        }).catch(() => {});
      }
    } else {
      // Update profile image and tokens
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: userData.displayName,
          profileImageUrl: userData.profileImageUrl,
          ...(tokens && {
            twitchAccessToken: tokens.accessToken,
            twitchRefreshToken: tokens.refreshToken,
          }),
        },
      });

      // Apply invite token role upgrade (VIEWER → STREAMER or higher)
      if (inviteToken && user.role === UserRole.VIEWER) {
        const invite = await this.prisma.inviteToken.findUnique({ where: { token: inviteToken } });
        if (invite && !invite.usedAt && (!invite.expiresAt || invite.expiresAt > new Date())) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { role: invite.role },
          });
          await this.prisma.inviteToken.update({
            where: { token: inviteToken },
            data: { usedAt: new Date(), usedBy: user.id },
          }).catch(() => {});
        }
      }

      // Auto-detect moderator role for VIEWERs
      if (user.role === UserRole.VIEWER && tokens?.accessToken) {
        const elevated = await this.tryElevateModerator(user.twitchId, tokens.accessToken);
        if (elevated) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { role: UserRole.MODERATOR },
          });
        }
      }
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been suspended.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      twitchId: user.twitchId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user };
  }

  /**
   * Check if user moderates any channel that currently has a running game.
   * Returns true if the user should be elevated to MODERATOR.
   */
  private async tryElevateModerator(
    twitchId: string,
    twitchAccessToken: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { twitchId } });
    if (!user) return false;
    await this.modAccessService.checkAndUpdate({ ...user, twitchAccessToken });
    const updated = await this.prisma.user.findUnique({ where: { twitchId } });
    return updated?.role === UserRole.MODERATOR;
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.isBanned) return null;
    return user;
  }

  private async getClientId(): Promise<string> {
    const setting = await this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_id' } });
    return setting?.value || this.config.get<string>('TWITCH_CLIENT_ID') || '';
  }

  private async getClientSecret(): Promise<string> {
    const setting = await this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_secret' } });
    return setting?.value || this.config.get<string>('TWITCH_CLIENT_SECRET') || '';
  }

  /**
   * Build a Twitch OAuth URL for bot account authorization.
   * Uses only chat:read + chat:edit scopes; force_verify=true so the admin
   * can log in as the bot account even if already signed in elsewhere.
   */
  async buildBotAuthUrl(state: string): Promise<string> {
    const clientId = await this.getClientId();
    const redirectUri = this.config.get<string>('TWITCH_REDIRECT_URI');
    const scopes = ['chat:read', 'chat:edit'].join(' ');
    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri!,
      response_type: 'code',
      scope: scopes,
      state,
      force_verify: 'true', // Always show login prompt so the bot account can be selected
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Return the lowercase login name for the given access token.
   */
  async getBotLogin(accessToken: string): Promise<string> {
    const clientId = await this.getClientId();
    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId!,
      },
    });
    if (!response.ok) throw new Error('Could not fetch bot user info from Twitch');
    const data: any = await response.json();
    const login = data.data?.[0]?.login as string | undefined;
    if (!login) throw new Error('Twitch returned no user data');
    return login;
  }

  /**
   * Persist bot credentials to AdminSetting so the IRC service can use them.
   */
  async storeBotCredentials(login: string, accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      this.prisma.adminSetting.upsert({
        where: { key: 'bot_login' },
        create: { key: 'bot_login', value: login },
        update: { value: login },
      }),
      this.prisma.adminSetting.upsert({
        where: { key: 'bot_access_token' },
        create: { key: 'bot_access_token', value: accessToken },
        update: { value: accessToken },
      }),
      this.prisma.adminSetting.upsert({
        where: { key: 'bot_refresh_token' },
        create: { key: 'bot_refresh_token', value: refreshToken },
        update: { value: refreshToken },
      }),
    ]);
  }

  /**
   * Build the Twitch OAuth authorization URL with PKCE state
   */
  async buildAuthUrl(state: string): Promise<string> {
    const clientId = await this.getClientId();
    const redirectUri = this.config.get<string>('TWITCH_REDIRECT_URI');
    const scopes = [
      'user:read:email',
      'user:read:moderated_channels',
      'channel:read:redemptions',
      'channel:manage:redemptions',
      'moderator:read:chatters',
      'chat:read',
      'chat:edit',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri!,
      response_type: 'code',
      scope: scopes,
      state,
      force_verify: 'false',
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(code: string): Promise<any> {
    const clientId = await this.getClientId();
    const clientSecret = await this.getClientSecret();
    const redirectUri = this.config.get<string>('TWITCH_REDIRECT_URI');

    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri!,
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange Twitch code');
    }

    return response.json();
  }

  /**
   * Get Twitch user info using access token
   */
  async getTwitchUser(accessToken: string): Promise<TwitchUserData> {
    const clientId = await this.getClientId();

    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId!,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch Twitch user data');
    }

    const data: any = await response.json();
    const twitchUser = data.data[0];

    return {
      twitchId: twitchUser.id,
      displayName: twitchUser.display_name,
      profileImageUrl: twitchUser.profile_image_url,
      email: twitchUser.email,
    };
  }
}

