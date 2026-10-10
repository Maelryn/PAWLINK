import { describe, expect, it, jest } from '@jest/globals';
import type { Server, Socket } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway';
import type { TokensService } from '../auth/tokens.service';
import type { CaseCreatedEvent, HelpOfferedEvent } from './events';

/**
 * The gateway, without a network.
 *
 * The handshake middleware is the security boundary, so it is exercised directly:
 * the functions passed to `server.use()` are exactly what Socket.IO will run for
 * every connecting client. A bad token has to end in `next(error)`, because that
 * is the only thing that turns into `connect_error` on the client.
 */

type Middleware = (socket: Socket, next: (error?: Error) => void) => void | Promise<void>;

function fakeSocket(auth: unknown = { token: 'good' }): Socket {
  return {
    id: 'socket-1',
    handshake: { auth },
    data: {},
    disconnect: () => undefined,
  } as unknown as Socket;
}

function build(tokenResult: 'ok' | 'reject' = 'ok') {
  const verifyAccess = jest.fn(async () => {
    if (tokenResult === 'reject') throw new Error('invalid');
    return { sub: 'user-1', role: 'reporter', name: 'Amina' };
  });

  const emitted: Array<{ name: string; payload: unknown }> = [];
  const server = {
    emit: (name: string, payload: unknown) => emitted.push({ name, payload }),
    use: (fn: Middleware) => registered.push(fn),
    sockets: { sockets: new Map() },
  } as unknown as Server;

  const registered: Middleware[] = [];
  const gateway = new RealtimeGateway({ verifyAccess } as unknown as TokensService);
  gateway.server = server;
  gateway.afterInit();

  return { gateway, emitted, registered };
}

const CASE_EVENT: CaseCreatedEvent = {
  case: {
    id: 'case-1',
    title: 'Chien blessé',
    species: 'dog',
    category: 'companion',
    status: 'open',
    triage: 'urgent',
    location: { lat: 36.63, lng: 4.205 },
    photos: [],
    description: 'un chien qui saigne',
    conditionTags: ['bleeding'],
    reporter: { id: 'u1', name: 'Amina', avatar: '' },
    helpers: [],
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  },
};

const HELP_EVENT: HelpOfferedEvent = {
  caseId: 'case-1',
  helper: { id: 'u2', name: 'Yacine', avatar: '' },
  helpType: 'transport',
};

describe('the handshake', () => {
  it('registers exactly one piece of middleware', () => {
    const { registered } = build();
    expect(registered).toHaveLength(1);
  });

  it('refuses a socket with no token', async () => {
    const { registered } = build();
    const next = jest.fn();
    await registered[0](fakeSocket({}), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe('AUTH_UNAUTHORIZED');
  });

  it('refuses a socket with an empty token', async () => {
    const { registered } = build();
    const next = jest.fn();
    await registered[0](fakeSocket({ token: '' }), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('refuses a socket whose token does not verify', async () => {
    const { registered } = build('reject');
    const next = jest.fn();
    await registered[0](fakeSocket({ token: 'forged' }), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0][0] as Error).message).toBe('AUTH_UNAUTHORIZED');
  });

  it('lets a verified socket through and stashes who it is', async () => {
    const { registered } = build();
    const socket = fakeSocket();
    const next = jest.fn();
    await registered[0](socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ sub: 'user-1', role: 'reporter', name: 'Amina' });
  });

  it('records the identity on connect, so `identity` can answer', () => {
    const { gateway } = build();
    const socket = fakeSocket();
    socket.data.user = { sub: 'user-1', role: 'reporter', name: 'Amina' };

    gateway.handleConnection(socket);
    expect(gateway.identity(socket)).toEqual({ sub: 'user-1', role: 'reporter', name: 'Amina' });

    gateway.handleDisconnect(socket);
    expect(() => gateway.identity(socket)).toThrow();
  });
});

describe('the four events', () => {
  it('emits case.created with { case }', () => {
    const { gateway, emitted } = build();
    gateway.caseCreated(CASE_EVENT);
    expect(emitted).toEqual([{ name: 'case.created', payload: CASE_EVENT }]);
  });

  it('emits case.updated with { case }', () => {
    const { gateway, emitted } = build();
    gateway.caseUpdated({ case: { ...CASE_EVENT.case, status: 'in_progress' } });
    expect(emitted[0].name).toBe('case.updated');
  });

  it('emits help.offered with { caseId, helper, helpType }', () => {
    const { gateway, emitted } = build();
    gateway.helpOffered(HELP_EVENT);
    expect(emitted).toEqual([{ name: 'help.offered', payload: HELP_EVENT }]);
  });

  it('emits notification with { notification }', () => {
    const { gateway, emitted } = build();
    const notification = {
      id: 'n1',
      userId: 'u1',
      kind: 'help',
      subject: 'Yacine',
      href: '/cases/case-1',
      read: false,
      createdAt: '2026-10-10T10:00:00.000Z',
    };

    gateway.notification({ notification });
    expect(emitted).toEqual([{ name: 'notification', payload: { notification } }]);
  });

  it('carries the full Case shape, so the client needs no mapping layer', () => {
    const { gateway, emitted } = build();
    gateway.caseCreated(CASE_EVENT);
    const payload = emitted[0].payload as CaseCreatedEvent;
    expect(payload.case.reporter).toEqual({ id: 'u1', name: 'Amina', avatar: '' });
    expect(payload.case.trust).toBeUndefined();
    expect(payload.case.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
