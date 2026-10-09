import { Inject, Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/env';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';

/**
 * The only door to an SMS provider. Failures are logged and swallowed on
 * purpose: a signup that cannot receive its code is still a valid account (the
 * user asks for a new code with `POST /auth/resend-code`), and the demo must
 * never depend on the network. The OTP row is the source of truth.
 *
 * The code is passed straight through to the provider and is never part of a log
 * line here — only the redacted phone number is.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(@Inject(SMS_PROVIDER) private readonly provider: SmsProvider) {}
  /** 'console' | 'twilio' — also reported by GET /health. */
  get providerName(): string {
    return this.provider.name;
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    try {
      await this.provider.send(phone, code);
    } catch (error) {
      this.logger.error(
        `SMS delivery failed via ${this.provider.name} for ${maskPhone(phone)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
