import { Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../common/filters/http-exception.filter';
import { maskPhone } from '../common/env';
import { SmsProvider } from './sms.provider';

const TWILIO_API = 'https://api.twilio.com/2010-04-01';

interface TwilioConfig {
  sid: string;
  token: string;
  from: string;
}

function readConfig(): TwilioConfig {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  if (!sid || !token || !from) {
    throw new ApiError(
      503,
      'SMS_PROVIDER_NOT_CONFIGURED',
      'SMS_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM.',
    );
  }
  return { sid, token, from };
}

/**
 * Real SMS delivery, selected with `SMS_PROVIDER=twilio`.
 *
 * Uses the global `fetch` (Node 22) rather than the Twilio SDK — the stack in
 * docs/BACKEND_PROMPT.md §2 does not include it, and two environment variables
 * plus one POST do not justify a dependency. The auth token is only ever used in
 * the Authorization header: it is never logged, echoed or copied into an error.
 */
@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioSmsProvider.name);

  async send(to: string, code: string): Promise<void> {
    const { sid, token, from } = readConfig();

    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: `PawLink — votre code de vérification est ${code}. Il expire dans 5 minutes.`,
    });

    const response = await fetch(`${TWILIO_API}/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      // Status + the upstream error body are safe; the token is not in either.
      const detail = (await response.text()).slice(0, 200);
      this.logger.error(`Twilio rejected the message for ${maskPhone(to)}: ${response.status} ${detail}`);
      throw new ApiError(503, 'SMS_DELIVERY_FAILED', 'The SMS provider refused the message.');
    }
  }
}
