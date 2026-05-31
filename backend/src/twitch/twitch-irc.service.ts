import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BingoService } from '../bingo/bingo.service';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { ApiClient } from '@twurple/api';
import { AuditAction } from '@prisma/client';

interface ActiveChannel {
  channelName: string;
  gameId: string;
}

export interface BotStatus {
  connected: boolean;
  botLogin: string | null;
  tokenValid: boolean;
  tokenExpiresIn: number | null; // seconds
  lastRefreshedAt: string | null;
  joinedChannels: string[];
}

@Injectable()
export class TwitchIrcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwitchIrcService.name);
  private chatClient: ChatClient | null = null;
  private apiClient: ApiClient | null = null;
  private authProvider: RefreshingAuthProvider | null = null;
  private activeChannels = new Map<string, ActiveChannel>();
  private botToken: string | null = null;
  private botRefreshToken: string | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private botLogin: string | null = null;
  private lastRefreshedAt: Date | null = null;
  private _connected = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private bingoService: BingoService,
  ) {}

  async onModuleInit() {
    await this.initializeFromSettings();
  }

  async onModuleDestroy() {
    await this.chatClient?.quit();
  }

  private async initializeFromSettings() {
    const [botTokenSetting, botRefreshSetting, botLoginSetting, clientIdSetting, clientSecretSetting] =
      await Promise.all([
        this.prisma.adminSetting.findUnique({ where: { key: 'bot_access_token' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'bot_refresh_token' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'bot_login' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_id' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_secret' } }),
      ]);

    // DB setting takes precedence over env var
    this.clientId = clientIdSetting?.value || this.config.get<string>('TWITCH_CLIENT_ID') || null;
    this.clientSecret =
      clientSecretSetting?.value || this.config.get<string>('TWITCH_CLIENT_SECRET') || null;

    if (!botTokenSetting?.value || !botLoginSetting?.value || !this.clientId || !this.clientSecret) {
      this.logger.warn('Twitch IRC: Bot credentials not configured. Skipping IRC initialization.');
      return;
    }

    this.botToken = botTokenSetting.value;
    this.botRefreshToken = botRefreshSetting?.value || null;
    this.botLogin = botLoginSetting.value;
    try {
      await this.connect(botLoginSetting.value);
    } catch (err: any) {
      this.logger.error(`Twitch IRC: Failed to connect bot on startup: ${err?.message ?? err}`);
    }
  }

  async connect(botLogin: string) {
    if (!this.botToken || !this.clientId || !this.clientSecret) return;

    this.authProvider = new RefreshingAuthProvider({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });

    this.authProvider.onRefresh(async (_userId, newTokenData) => {
      try {
        this.botToken = newTokenData.accessToken;
        this.lastRefreshedAt = new Date();
        await this.prisma.adminSetting.upsert({
          where: { key: 'bot_access_token' },
          create: { key: 'bot_access_token', value: newTokenData.accessToken },
          update: { value: newTokenData.accessToken },
        });
        if (newTokenData.refreshToken) {
          this.botRefreshToken = newTokenData.refreshToken;
          await this.prisma.adminSetting.upsert({
            where: { key: 'bot_refresh_token' },
            create: { key: 'bot_refresh_token', value: newTokenData.refreshToken },
            update: { value: newTokenData.refreshToken },
          });
        }
        // Audit log
        await this.prisma.auditLog.create({
          data: {
            adminId: 'system',
            action: AuditAction.BOT_TOKEN_REFRESHED,
            targetType: 'BotToken',
            targetId: this.botLogin ?? 'bot',
            metadata: { auto: true, at: new Date().toISOString() },
          },
        });
        this.logger.log('Twitch bot token refreshed and saved to DB');
      } catch (err: any) {
        this.logger.error(`onRefresh handler error: ${err?.message ?? err}`);
      }
    });

    // expiresIn: null + current timestamp = use the access token as-is;
    // twurple will only call the refresh endpoint when Twitch returns a 401.
    // Using expiresIn:0/obtainmentTimestamp:0 would force an immediate refresh
    // attempt before any API call, which fails if the refresh token is tied to
    // a different client application.
    await this.authProvider.addUserForToken(
      {
        accessToken: this.botToken,
        refreshToken: this.botRefreshToken,
        expiresIn: null,
        obtainmentTimestamp: Date.now(),
        scope: ['chat:read', 'chat:edit'],
      },
      ['chat'],
    );

    this.apiClient = new ApiClient({ authProvider: this.authProvider });

    this.chatClient = new ChatClient({
      authProvider: this.authProvider,
      channels: [],
    });

    this.chatClient.onMessage(async (channel, user, text, msg) => {
      await this.handleMessage(channel, user, text, msg);
    });

    this.chatClient.onConnect(() => {
      this._connected = true;
      this.logger.log('Twitch IRC connected');
    });

    this.chatClient.onDisconnect((manually, reason) => {
      this._connected = false;
      this.logger.warn(`Twitch IRC disconnected (manual: ${manually}): ${reason?.message}`);
    });

    await this.chatClient.connect();
    this._connected = true;

    // Auto-join all currently RUNNING games from DB
    try {
      const runningGames = await this.prisma.bingoGame.findMany({
        where: { status: 'RUNNING' },
        select: { id: true, channelName: true },
      });
      for (const g of runningGames) {
        this.activeChannels.set(g.channelName.toLowerCase(), { channelName: g.channelName.toLowerCase(), gameId: g.id });
        void this.joinChannel(g.channelName.toLowerCase());
      }
      if (runningGames.length > 0) {
        this.logger.log(`Auto-joined ${runningGames.length} running game channel(s) from DB`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not auto-join running games: ${err?.message}`);
    }

    // Rejoin any other tracked channels (in-memory)
    for (const [channelName] of this.activeChannels) {
      void this.joinChannel(channelName);
    }
  }

  /** Validate the current bot access token via Twitch's validate endpoint */
  async validateToken(): Promise<{ valid: boolean; expiresIn: number | null; login: string | null }> {
    if (!this.botToken) return { valid: false, expiresIn: null, login: null };
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${this.botToken}` },
      });
      if (!res.ok) return { valid: false, expiresIn: null, login: null };
      const data: { expires_in: number; login: string } = await res.json();
      return { valid: true, expiresIn: data.expires_in, login: data.login };
    } catch {
      return { valid: false, expiresIn: null, login: null };
    }
  }

  async getBotStatus(): Promise<BotStatus> {
    const tokenInfo = await this.validateToken();
    return {
      connected: this._connected,
      botLogin: this.botLogin,
      tokenValid: tokenInfo.valid,
      tokenExpiresIn: tokenInfo.expiresIn,
      lastRefreshedAt: this.lastRefreshedAt?.toISOString() ?? null,
      joinedChannels: Array.from(this.activeChannels.keys()),
    };
  }

  getJoinedChannels(): string[] {
    return Array.from(this.activeChannels.keys());
  }

  /** Force a token refresh by setting obtainmentTimestamp to 0 and re-requesting */
  async forceRefreshToken(adminId: string): Promise<{ success: boolean; message: string }> {
    if (!this.authProvider || !this.botLogin) {
      return { success: false, message: 'Bot nicht initialisiert oder kein Auth-Provider vorhanden.' };
    }
    try {
      // RefreshingAuthProvider exposes refreshAccessTokenForUser(userId)
      // but user must first be added. We trigger via the API client (any call forces refresh check).
      // Alternatively force by resetting token data:
      await this.authProvider.addUserForToken(
        {
          accessToken: this.botToken!,
          refreshToken: this.botRefreshToken,
          expiresIn: 0,
          obtainmentTimestamp: 0,
          scope: ['chat:read', 'chat:edit'],
        },
        ['chat'],
      );
      // Make a lightweight API call to trigger the actual refresh
      await this.apiClient?.asUser(this.botLogin, (ctx) => ctx.users.getAuthenticatedUser(this.botLogin!));
      await this.prisma.auditLog.create({
        data: {
          adminId,
          action: AuditAction.BOT_TOKEN_REFRESHED,
          targetType: 'BotToken',
          targetId: this.botLogin,
          metadata: { manual: true, at: new Date().toISOString() },
        },
      });
      return { success: true, message: 'Token-Refresh angefordert. Neues Token wird nach dem nächsten API-Aufruf gespeichert.' };
    } catch (e: any) {
      return { success: false, message: `Refresh fehlgeschlagen: ${e.message}` };
    }
  }

  /** Reconnect the IRC bot (re-reads all credentials from DB first) */
  async reconnect(): Promise<{ success: boolean; message: string }> {
    try {
      // Re-read credentials from DB before connecting
      const [botTokenSetting, botRefreshSetting, botLoginSetting, clientIdSetting, clientSecretSetting] =
        await Promise.all([
          this.prisma.adminSetting.findUnique({ where: { key: 'bot_access_token' } }),
          this.prisma.adminSetting.findUnique({ where: { key: 'bot_refresh_token' } }),
          this.prisma.adminSetting.findUnique({ where: { key: 'bot_login' } }),
          this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_id' } }),
          this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_secret' } }),
        ]);

      const clientId = clientIdSetting?.value || this.config.get<string>('TWITCH_CLIENT_ID') || null;
      const clientSecret = clientSecretSetting?.value || this.config.get<string>('TWITCH_CLIENT_SECRET') || null;

      if (!botTokenSetting?.value || !botLoginSetting?.value || !clientId || !clientSecret) {
        return { success: false, message: 'Bot-Credentials unvollständig. Bitte alle Felder in den Bot-Einstellungen ausfüllen.' };
      }

      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.botToken = botTokenSetting.value;
      this.botRefreshToken = botRefreshSetting?.value || null;
      this.botLogin = botLoginSetting.value;

      if (this.chatClient) {
        try { await this.chatClient.quit(); } catch { /* ignore */ }
        this.chatClient = null;
        this._connected = false;
      }
      await this.connect(this.botLogin);
      // Re-register all known active channels
      for (const channelName of this.activeChannels.keys()) {
        void this.joinChannel(channelName);
      }
      return { success: true, message: 'IRC-Verbindung wird neu aufgebaut.' };
    } catch (e: any) {
      return { success: false, message: `Reconnect fehlgeschlagen: ${e.message}` };
    }
  }

  async joinChannel(channelName: string) {
    if (!this.chatClient) return;
    try {
      await this.chatClient.join(channelName);
      this.logger.log(`Joined channel: ${channelName}`);
    } catch (err) {
      this.logger.error(`Failed to join channel ${channelName}: ${err}`);
    }
  }

  async leaveChannel(channelName: string) {
    if (!this.chatClient) return;
    this.chatClient.part(channelName);
    this.activeChannels.delete(channelName);
    this.logger.log(`Left channel: ${channelName}`);
  }

  registerActiveGame(channelName: string, gameId: string) {
    this.activeChannels.set(channelName, { channelName, gameId });
    void this.joinChannel(channelName);
  }

  unregisterActiveGame(channelName: string) {
    void this.leaveChannel(channelName);
  }

  async manualJoinChannel(channelName: string): Promise<{ success: boolean; message: string }> {
    if (!this.chatClient || !this._connected) {
      return { success: false, message: 'Bot nicht verbunden. Bitte zuerst IRC neu verbinden.' };
    }
    const name = channelName.toLowerCase();
    // Look up any RUNNING or CREATED game for this channel
    const game = await this.prisma.bingoGame.findFirst({
      where: { channelName: name, status: { in: ['RUNNING', 'CREATED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const gameId = game?.id ?? `manual_${Date.now()}`;
    this.activeChannels.set(name, { channelName: name, gameId });
    void this.joinChannel(name);
    return { success: true, message: `Bot joint #${name}.` };
  }

  private async handleMessage(channel: string, username: string, text: string, msg: any) {
    const channelName = channel.replace('#', '').toLowerCase();
    const activeGame = this.activeChannels.get(channelName);
    if (!activeGame) return;

    const { gameId } = activeGame;
    const trimmed = text.trim().toLowerCase();

    // Check permissions for number commands
    const isModOrBroadcaster = msg.userInfo.isMod || msg.userInfo.isBroadcaster;

    // !zahl+N – add number (mods/broadcaster only)
    const addMatch = trimmed.match(/^!zahl\+(\d+)$/);
    if (addMatch) {
      if (!isModOrBroadcaster) return; // Silent ignore for regular viewers
      const number = parseInt(addMatch[1], 10);
      try {
        await this.bingoService.drawNumber(gameId, number);
        await this.chatClient?.say(channel, `✅ Zahl ${number} wurde gezogen!`);
      } catch (err: any) {
        await this.chatClient?.say(channel, `❌ ${err.message}`);
      }
      return;
    }

    // !zahl-N – remove number (mods/broadcaster only)
    const removeMatch = trimmed.match(/^!zahl-(\d+)$/);
    if (removeMatch) {
      if (!isModOrBroadcaster) return;
      const number = parseInt(removeMatch[1], 10);
      try {
        await this.bingoService.removeNumber(gameId, number);
        await this.chatClient?.say(channel, `✅ Zahl ${number} wurde entfernt!`);
      } catch (err: any) {
        await this.chatClient?.say(channel, `❌ ${err.message}`);
      }
      return;
    }

    // BINGO – any viewer can claim
    if (trimmed === 'bingo') {
      const twitchId = msg.userInfo.userId;
      const user = await this.prisma.user.findUnique({ where: { twitchId } });
      if (!user) return;

      try {
        const winner = await this.bingoService.claimBingo(gameId, user.id, 'CHAT');
        await this.chatClient?.say(
          channel,
          `🎉 @${username} hat BINGO! (Platz ${winner.position})`,
        );
      } catch {
        // Ignore – not a valid bingo
      }
      return;
    }

    // !buycard – debug command: give the sender a bingo card (mods/broadcaster only for now or any user)
    if (trimmed === '!buycard') {
      const twitchId = msg.userInfo.userId;
      const user = await this.prisma.user.findUnique({ where: { twitchId } });
      if (!user) {
        await this.chatClient?.say(channel, `@${username} Du bist noch nicht registriert. Bitte melde dich zuerst auf der Website an.`);
        return;
      }
      try {
        await this.bingoService.createCardForUser(gameId, user.id);
        await this.chatClient?.say(channel, `✅ @${username} Deine Bingo-Karte wurde erstellt! Öffne das Spiel auf der Website.`);
      } catch (err: any) {
        await this.chatClient?.say(channel, `❌ @${username} ${err.message}`);
      }
    }
  }
}
