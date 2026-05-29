import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
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
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Called after successful Twitch OAuth callback.
   * Creates or updates the user, returns a JWT.
   */
  async loginWithTwitch(userData: TwitchUserData): Promise<{ accessToken: string; user: any }> {
    let user = await this.prisma.user.findUnique({
      where: { twitchId: userData.twitchId },
    });

    if (!user) {
      // Check if this is the very first user (becomes admin)
      const userCount = await this.prisma.user.count();
      const role = userCount === 0 ? UserRole.ADMIN : UserRole.VIEWER;

      user = await this.prisma.user.create({
        data: {
          twitchId: userData.twitchId,
          displayName: userData.displayName,
          profileImageUrl: userData.profileImageUrl,
          email: userData.email,
          role,
        },
      });
    } else {
      // Update profile image
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: userData.displayName,
          profileImageUrl: userData.profileImageUrl,
        },
      });
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
   * Build the Twitch OAuth authorization URL with PKCE state
   */
  async buildAuthUrl(state: string): Promise<string> {
    const clientId = await this.getClientId();
    const redirectUri = this.config.get<string>('TWITCH_REDIRECT_URI');
    const scopes = [
      'user:read:email',
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
