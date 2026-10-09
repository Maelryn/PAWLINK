import { Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SMS_PROVIDER } from './sms.provider';
import { SmsService } from './sms.service';
import { TwilioSmsProvider } from './twilio-sms.provider';

/**
 * Picks the delivery implementation from `SMS_PROVIDER` (default `console`).
 * Both providers are always instantiated — they are cheap — but only the selected
 * one is bound to the token, so `SmsService` never branches on env itself.
 */
@Module({
  providers: [
    ConsoleSmsProvider,
    TwilioSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConsoleSmsProvider, TwilioSmsProvider],
      useFactory: (consoleProvider: ConsoleSmsProvider, twilioProvider: TwilioSmsProvider) => {
        const choice = (process.env.SMS_PROVIDER ?? 'console').trim().toLowerCase();
        if (choice === 'twilio') return twilioProvider;
        if (choice !== 'console') {
          console.warn(`Unknown SMS_PROVIDER="${choice}", falling back to console.`);
        }
        return consoleProvider;
      },
    },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
