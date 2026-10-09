/**
 * SMS delivery is behind an interface so the demo never needs a paid provider
 * (docs/BACKEND_PROMPT.md §2): `SMS_PROVIDER=console` (default) logs the code and
 * works fully offline, `SMS_PROVIDER=twilio` sends a real message. Swapping them
 * is an env change, nothing else.
 *
 * Nest 11 dropped the `InjectionToken` class (it is now a plain type alias), so
 * the token is a symbol — which `@Inject()` accepts and which cannot collide
 * with a class name.
 */
export interface SmsProvider {
  /** 'console' | 'twilio' — surfaced by GET /health so operators see what is live. */
  readonly name: string;
  send(to: string, code: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
