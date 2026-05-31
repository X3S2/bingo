import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
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

  // ─── Command config cache ────────────────────────────────────────────────
  private cmdCache: Map<string, { name: string; enabled: boolean; perm: 'all' | 'mod' | 'broadcaster' }> = new Map();
  private cmdCacheAt = 0;
  private readonly CMD_CACHE_TTL = 30_000; // 30 s

  private static readonly CMD_SLUGS = ['zahl_add', 'zahl_remove', 'bingo', 'buycard', 'zahlen', 'winners'] as const;
  private static readonly CMD_DEFAULTS: Record<string, { name: string; perm: 'all' | 'mod' | 'broadcaster' }> = {
    zahl_add:    { name: '!zahl+',         perm: 'mod' },
    zahl_remove: { name: '!zahl-',         perm: 'mod' },
    bingo:       { name: 'bingo',          perm: 'all' },
    buycard:     { name: '!buycard',       perm: 'all' },
    zahlen:      { name: '!zahlen',        perm: 'all' },
    winners:     { name: '!bingogewinner', perm: 'all' },
  };

  private async refreshCmdCache(): Promise<void> {
    const now = Date.now();
    if (now - this.cmdCacheAt < this.CMD_CACHE_TTL) return;
    const keys = TwitchIrcService.CMD_SLUGS.flatMap((s) => [
      `bot_cmd_${s}_name`, `bot_cmd_${s}_enabled`, `bot_cmd_${s}_perm`,
    ]);
    const rows = await this.prisma.adminSetting.findMany({ where: { key: { in: keys } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    for (const slug of TwitchIrcService.CMD_SLUGS) {
      const def = TwitchIrcService.CMD_DEFAULTS[slug];
      this.cmdCache.set(slug, {
        name:    map.get(`bot_cmd_${slug}_name`)    ?? def.name,
        enabled: (map.get(`bot_cmd_${slug}_enabled`) ?? 'true') === 'true',
        perm:    (map.get(`bot_cmd_${slug}_perm`)    as 'all' | 'mod' | 'broadcaster') ?? def.perm,
      });
    }
    this.cmdCacheAt = now;
  }

  private getCmd(slug: string) {
    return this.cmdCache.get(slug) ?? { ...TwitchIrcService.CMD_DEFAULTS[slug], enabled: true };
  }

  private checkPerm(perm: 'all' | 'mod' | 'broadcaster', msg: any): boolean {
    if (perm === 'all') return true;
    if (perm === 'mod') return msg.userInfo.isMod || msg.userInfo.isBroadcaster;
    if (perm === 'broadcaster') return msg.userInfo.isBroadcaster;
    return false;
  }
  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => BingoService))
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

  /** Send a message in the channel associated with the given gameId */
  async sayInGame(gameId: string, text: string): Promise<void> {
    if (!this.chatClient || !this._connected) return;
    for (const [channelName, entry] of this.activeChannels) {
      if (entry.gameId === gameId) {
        try { await this.chatClient.say(channelName, text); } catch { /* ignore */ }
        return;
      }
    }
  }

  /** Returns the current command config for all slugs (forces cache refresh) */
  async getPublicCmdConfig() {
    this.cmdCacheAt = 0; // force refresh
    await this.refreshCmdCache();
    const result: Record<string, { name: string; enabled: boolean; perm: string; label: string }> = {};
    const labels: Record<string, string> = {
      zahl_add:    'Zahl ziehen',
      zahl_remove: 'Zahl entfernen',
      bingo:       'Bingo melden',
      buycard:     'Karte erhalten',
      zahlen:      'Zahlen anzeigen',
      winners:     'Gewinner anzeigen',
    };
    for (const slug of TwitchIrcService.CMD_SLUGS) {
      const cfg = this.getCmd(slug);
      result[slug] = { ...cfg, label: labels[slug] };
    }
    return result;
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

    // Refresh command config (cached 30 s)
    await this.refreshCmdCache();

    // ── !zahl+N – draw number ──────────────────────────────────────────────
    const czahlAdd = this.getCmd('zahl_add');
    if (czahlAdd.enabled) {
      const prefix = czahlAdd.name.toLowerCase();
      if (trimmed.startsWith(prefix)) {
        const numStr = trimmed.slice(prefix.length);
        const number = parseInt(numStr, 10);
        if (!isNaN(number) && String(number) === numStr) {
          if (!this.checkPerm(czahlAdd.perm, msg)) return;
          try {
            await this.bingoService.drawNumber(gameId, number);
            await this.chatClient?.say(channel, `✅ Zahl ${number} wurde gezogen!`);
          } catch (err: any) {
            await this.chatClient?.say(channel, `❌ ${err.message}`);
          }
          return;
        }
      }
    }

    // ── !zahl-N – remove number ────────────────────────────────────────────
    const czahlRemove = this.getCmd('zahl_remove');
    if (czahlRemove.enabled) {
      const prefix = czahlRemove.name.toLowerCase();
      if (trimmed.startsWith(prefix)) {
        const numStr = trimmed.slice(prefix.length);
        const number = parseInt(numStr, 10);
        if (!isNaN(number) && String(number) === numStr) {
          if (!this.checkPerm(czahlRemove.perm, msg)) return;
          try {
            await this.bingoService.removeNumber(gameId, number);
            await this.chatClient?.say(channel, `✅ Zahl ${number} wurde entfernt!`);
          } catch (err: any) {
            await this.chatClient?.say(channel, `❌ ${err.message}`);
          }
          return;
        }
      }
    }

    // ── bingo – claim bingo ────────────────────────────────────────────────
    const cbingo = this.getCmd('bingo');
    if (cbingo.enabled && trimmed === cbingo.name.toLowerCase()) {
      if (!this.checkPerm(cbingo.perm, msg)) return;
      const twitchId = msg.userInfo.userId;
      const user = await this.prisma.user.findUnique({ where: { twitchId } });
      if (!user) return;
      try {
        const winner = await this.bingoService.claimBingo(gameId, user.id, 'CHAT');
        await this.chatClient?.say(channel, `🎉 @${username} hat BINGO! (Platz ${winner.position})`);
      } catch {
        // Ignore – not a valid bingo
      }
      return;
    }

    // ── !zahlen – list drawn numbers ───────────────────────────────────────
    const czahlen = this.getCmd('zahlen');
    if (czahlen.enabled && trimmed === czahlen.name.toLowerCase()) {
      if (!this.checkPerm(czahlen.perm, msg)) return;
      try {
        const game = await this.prisma.bingoGame.findUnique({
          where: { id: gameId },
          include: { drawnNumbers: { orderBy: { number: 'asc' } } },
        });
        if (!game) return;
        const nums = game.drawnNumbers.map((d: { number: number }) => d.number);
        if (nums.length === 0) {
          await this.chatClient?.say(channel, `🎱 Noch keine Zahlen gezogen.`);
        } else {
          await this.chatClient?.say(channel, `🎱 Gezogene Zahlen (${nums.length}/75): ${nums.join(', ')}`);
        }
      } catch (err: any) {
        this.logger.error(`!zahlen error: ${err.message}`);
      }
      return;
    }

    // ── !bingogewinner – list winners ──────────────────────────────────────
    const cwinners = this.getCmd('winners');
    if (cwinners.enabled && trimmed === cwinners.name.toLowerCase()) {
      if (!this.checkPerm(cwinners.perm, msg)) return;
      try {
        const game = await this.prisma.bingoGame.findUnique({
          where: { id: gameId },
          include: { winners: { orderBy: { position: 'asc' }, include: { user: { select: { displayName: true } } } } },
        });
        if (!game) return;
        const ws = game.winners as Array<{ position: number; user: { displayName: string } }>;
        if (ws.length === 0) {
          await this.chatClient?.say(channel, `🏆 Noch keine Gewinner.`);
        } else {
          const list = ws.map((w) => `${w.position}. @${w.user.displayName}`).join(' · ');
          await this.chatClient?.say(channel, `🏆 Gewinner: ${list}`);
        }
      } catch (err: any) {
        this.logger.error(`!bingogewinner error: ${err.message}`);
      }
      return;
    }

    // ── !buycard – get a bingo card ────────────────────────────────────────
    const cbuycard = this.getCmd('buycard');
    if (cbuycard.enabled && trimmed === cbuycard.name.toLowerCase()) {
      if (!this.checkPerm(cbuycard.perm, msg)) return;
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
      return;
    }
  }
}
