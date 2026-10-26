import type { Server, Socket } from 'socket.io';
import type { HelpType, Triage } from '../shared/types';
import type { UserLite } from '../shared/types';
import type { Case } from '../shared/types';

/**
 * The realtime contract (docs/BACKEND_PROMPT.md §3.3 "Realtime", PHASE2_PLAN §8).
 *
 * Four events, and the payloads are shapes the frontend already has — so a
 * client can write `socket.on('case.created', ({ case }) => …)` with no mapping
 * layer. Keeping them in one file is what makes the documented surface and the
 * emitted one the same thing.
 */

/** `case.created` — a case was stored **and it is public**. */
export interface CaseCreatedEvent {
  case: Case;
}

/** `case.updated` — status, confirmations or flags changed the case. */
export interface CaseUpdatedEvent {
  case: Case;
}

/** `help.offered` — somebody volunteered on a case. */
export interface HelpOfferedEvent {
  caseId: string;
  helper: UserLite;
  helpType: HelpType;
}

/** `notification` — a notification row was written. Phase 3 creates the rest. */
export interface NotificationEvent {
  notification: {
    id: string;
    userId: string;
    kind: string;
    subject: string;
    href: string;
    read: boolean;
    createdAt: string;
  };
}

export type RealtimeEvent =
  | { name: 'case.created'; payload: CaseCreatedEvent }
  | { name: 'case.updated'; payload: CaseUpdatedEvent }
  | { name: 'help.offered'; payload: HelpOfferedEvent }
  | { name: 'notification'; payload: NotificationEvent };

/**
 * Typed emitters. Every broadcast in the codebase goes through one of these
 * four, so a typo in an event name is a type error rather than a silent event
 * nobody listens for.
 */
export function emitCaseCreated(server: Server, event: CaseCreatedEvent): void {
  server.emit('case.created', event);
}

export function emitCaseUpdated(server: Server, event: CaseUpdatedEvent): void {
  server.emit('case.updated', event);
}

export function emitHelpOffered(server: Server, event: HelpOfferedEvent): void {
  server.emit('help.offered', event);
}

export function emitNotification(server: Server, event: NotificationEvent): void {
  server.emit('notification', event);
}

/** What a connected socket has proved about itself. */
export interface SocketIdentity {
  sub: string;
  role: string;
  name: string;
}

/** The handshake payload, as the client sends it. */
export interface SocketHandshake {
  auth?: { token?: unknown };
  [key: string]: unknown;
}

export type { Server, Socket, Triage };
