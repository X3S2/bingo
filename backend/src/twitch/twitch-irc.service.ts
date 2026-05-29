import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BingoService } from '../bingo/bingo.service';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { ApiClient } from '@twurple/api';

interface ActiveChannel {
  channelName: string;
  gameId: string;
}

@Injectable()
export class TwitchIrcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwitchIrcService.name);
  private chatClient: ChatClient | null = null;
  private apiClient: ApiClient | null = null;
  private activeChannels = new Map<string, ActiveChannel>(); // channelName → channel info
  private botToken: string | null = null;
  private botRefreshToken: string | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;

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
    // Load bot credentials from AdminSettings (set via Setup Wizard)
    const [botTokenSetting, botRefreshSetting, botLoginSetting, clientSecretSetting] =
      await Promise.all([
        this.prisma.adminSetting.findUnique({ where: { key: 'bot_access_token' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'bot_refresh_token' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'bot_login' } }),
        this.prisma.adminSetting.findUnique({ where: { key: 'twitch_client_secret' } }),
      ]);

    this.clientId = this.config.get<string>('TWITCH_CLIENT_ID') || null;
    this.clientSecret =
      clientSecretSetting?.value || this.config.get<string>('TWITCH_CLIENT_SECRET') || null;

    if (!botTokenSetting?.value || !botLoginSetting?.value || !this.clientId || !this.clientSecret) {
      this.logger.warn('Twitch IRC: Bot credentials not configured. Skipping IRC initialization.');
      return;
    }

    this.botToken = botTokenSetting.value;
    this.botRefreshToken = botRefreshSetting?.value || null;
    await this.connect(botLoginSetting.value);
  }

  async connect(botLogin: string) {
    if (!this.botToken || !this.clientId || !this.clientSecret) return;

    const authProvider = new RefreshingAuthProvider({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });

    authProvider.onRefresh(async (_userId, newTokenData) => {
      this.botToken = newTokenData.accessToken;
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
      this.logger.log('Twitch bot token refreshed and saved to DB');
    });

    await authProvider.addUserForToken(
      {
        accessToken: this.botToken,
        refreshToken: this.botRefreshToken,
        expiresIn: null,
        obtainmentTimestamp: 0,
        scope: ['chat:read', 'chat:edit'],
      },
      ['chat'],
    );

    this.apiClient = new ApiClient({ authProvider });

    this.chatClient = new ChatClient({
      authProvider,
      channels: [],
    });

    this.chatClient.onMessage(async (channel, user, text, msg) => {
      await this.handleMessage(channel, user, text, msg);
    });

    this.chatClient.onConnect(() => {
      this.logger.log('Twitch IRC connected');
    });

    this.chatClient.onDisconnect((manually, reason) => {
      this.logger.warn(`Twitch IRC disconnected (manual: ${manually}): ${reason?.message}`);
    });

    await this.chatClient.connect();

    // Rejoin active game channels
    for (const [channelName] of this.activeChannels) {
      await this.joinChannel(channelName);
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
    }
  }
}
