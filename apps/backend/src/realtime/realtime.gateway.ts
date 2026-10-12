import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ApiError } from '../common/filters/http-exception.filter';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
// A value import, not `import type`: `emitDecoratorMetadata` records the
// constructor parameter types, and a type-only import is erased before that
// metadata is written — so Nest would see `undefined` and refuse to boot.
import { TokensService } from '../auth/tokens.service';
import {
  emitCaseCreated,
  emitCaseUpdated,
  emitHelpOffered,
  emitNotification,
  type CaseCreatedEvent,
  type CaseUpdatedEvent,
  type HelpOfferedEvent,
  type NotificationEvent,
  type SocketIdentity,
} from './events';

/**
 * Socket.IO on `/realtime` (docs/BACKEND_PROMPT.md §3.3, PHASE2_PLAN §8).
 *
 * The handshake carries the access token in `auth.token`. It is verified in
 * Socket.IO **handshake middleware** (`server.use`), which is the only place a
 * connection can genuinely be refused: a client that fails the check receives
 * `connect_error` and never reaches the `connection` event, so an anonymous
 * socket cannot subscribe to case traffic at all. Doing it in
 * `handleConnection` instead would leave a window where the socket exists and
 * has heard nothing yet, which is exactly what risk R8 warned about.
 *
 * The gateway holds no application state: emitting is `server.emit`. Running two
 * instances later is a Redis adapter change, not a rewrite.
 */

/** The token the client sends in the handshake. */
export const SOCKET_AUTH_FIELD = 'token';

@WebSocketGateway({
  namespace: '/realtime',
  // The Socket.IO handshake is an HTTP upgrade: no cookie is sent, so the token
  // travels in `auth` and the origin has to be allowed explicitly.
  cors: { origin: true, credentials: true },
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  /** socket.id → the verified caller. Read by `identity`, cleared on disconnect. */
  private readonly identities = new Map<string, SocketIdentity>();

  constructor(private readonly tokens: TokensService) {}

  afterInit(): void {
    this.server.use(this.handshakeGuard.bind(this));
  }

  handleConnection(client: Socket): void {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (user) {
      this.identities.set(client.id, { sub: user.sub, role: user.role, name: user.name });
      this.logger.debug(`Socket ${client.id} connected as ${user.sub} (${user.role})`);
    }
  }

  handleDisconnect(client: Socket): void {
    if (this.identities.delete(client.id)) {
      this.logger.debug(`Socket ${client.id} disconnected`);
    }
  }

  /**
   * "Who am I?" — answered from the verified handshake, never from what the
   * client says. A socket that somehow got here without one is dropped.
   */
  @SubscribeMessage('identity')
  identity(@ConnectedSocket() client: Socket): SocketIdentity {
    const known = this.identities.get(client.id);
    if (!known) {
      client.disconnect(true);
      throw new ApiError(401, 'AUTH_UNAUTHORIZED', 'Authentification requise.');
    }
    return known;
  }

  /** A public case appeared. Only public cases reach this — see `CasesService`. */
  caseCreated(event: CaseCreatedEvent): void {
    emitCaseCreated(this.server, event);
  }

  /** Status, confirmations or flags changed a case. */
  caseUpdated(event: CaseUpdatedEvent): void {
    emitCaseUpdated(this.server, event);
  }

  /** Somebody volunteered on a case. */
  helpOffered(event: HelpOfferedEvent): void {
    emitHelpOffered(this.server, event);
  }

  /** A notification row was written. */
  notification(event: NotificationEvent): void {
    emitNotification(this.server, event);
  }

  /** Number of sockets currently attached — used by the health check and tests. */
  connectedSockets(): number {
    return this.server?.sockets?.sockets.size ?? 0;
  }

  /**
   * The handshake middleware that refuses an anonymous socket.
   *
   * `next(new Error(...))` is what turns into `connect_error` on the client; the
   * message is deliberately generic, because a precise one ("your token is
   * expired") is an oracle.
   */
  private async handshakeGuard(socket: Socket, next: (error?: Error) => void): Promise<void> {
    const token = socket.handshake.auth?.[SOCKET_AUTH_FIELD];
    if (typeof token !== 'string' || token.length === 0) {
      this.logger.debug(`Socket ${socket.id} refused: no handshake token`);
      next(new Error('AUTH_UNAUTHORIZED'));
      return;
    }

    try {
      const user = await this.tokens.verifyAccess(token);
      socket.data.user = user;
      next();
    } catch {
      // Same single code as the HTTP guards: no hint about which part failed.
      this.logger.debug(`Socket ${socket.id} refused: invalid handshake token`);
      next(new Error('AUTH_UNAUTHORIZED'));
    }
  }
}
