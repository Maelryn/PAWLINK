import { Injectable, Logger } from '@nestjs/common';
import { isProduction, maskPhone } from '../common/env';
import { SmsProvider } from './sms.provider';

/**
 * Default provider: prints the code to the server log. Perfectly fine in
 * development and in the demo, which is exactly the point — the whole Phase 1
 * flow (register → verify → login) works with zero third-party services.
 *
 * In production this provider is a misconfiguration: writing an OTP to a log is
 * the same as publishing it. So there it logs a redacted error instead of the
 * code, and never returns it to the client (see `OtpService`, which is the only
 * place a code may cross the API boundary, and only when not in production).
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(to: string, code: string): Promise<void> {
    if (isProduction()) {
      this.logger.error(
        `SMS_PROVIDER=console in production: no code sent to ${maskPhone(to)}. ` +
          `Configure SMS_PROVIDER=twilio with TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM.`,
      );
      return;
    }
    // Development only: the operator needs the code to complete the flow.
    this.logger.log(`[dev SMS] verification code for ${maskPhone(to)}: ${code}`);
  }
}
