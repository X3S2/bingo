import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_URL || 'http://localhost:4000',
    credentials: true,
  },
  path: '/socket.io',
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract JWT from cookie or auth header
      const token =
        client.handshake.headers.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('access_token='))
          ?.split('=')[1] ||
        client.handshake.auth?.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.isBanned) {
        client.disconnect();
        return;
      }

      // Store user on socket
      (client as any).user = user;
      this.logger.log(`Client connected: ${user.displayName}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as any).user;
    if (user) this.logger.log(`Client disconnected: ${user.displayName}`);
  }

  // ── Room management ────────────────────────────────────────

  @SubscribeMessage('join:game')
  joinGame(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    client.join(`game:${data.gameId}`);
    return { success: true, room: `game:${data.gameId}` };
  }

  @SubscribeMessage('leave:game')
  leaveGame(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    client.leave(`game:${data.gameId}`);
  }

  @SubscribeMessage('join:card')
  joinCard(@ConnectedSocket() client: Socket, @MessageBody() data: { cardId: string }) {
    client.join(`card:${data.cardId}`);
    return { success: true };
  }

  @SubscribeMessage('join:mod')
  joinMod(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const user = (client as any).user;
    if (!user || !['MODERATOR', 'STREAMER', 'ADMIN'].includes(user.role)) {
      return { error: 'Forbidden' };
    }
    client.join(`mod:${data.gameId}`);
    return { success: true };
  }

  @SubscribeMessage('join:admin')
  joinAdmin(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    if (!user || user.role !== 'ADMIN') {
      return { error: 'Forbidden' };
    }
    client.join('admin');
    return { success: true };
  }

  // ── Emit helpers ───────────────────────────────────────────

  emitToGame(gameId: string, event: string, data: any) {
    this.server.to(`game:${gameId}`).emit(event, data);
  }

  emitToCard(cardId: string, event: string, data: any) {
    this.server.to(`card:${cardId}`).emit(event, data);
  }

  emitToMod(gameId: string, event: string, data: any) {
    this.server.to(`mod:${gameId}`).emit(event, data);
  }

  emitToAdmin(event: string, data: any) {
    this.server.to('admin').emit(event, data);
  }

  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}
