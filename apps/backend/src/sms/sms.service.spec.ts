import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';
import { SmsService } from './sms.service';
import { TwilioSmsProvider } from './twilio-sms.provider';

const CODE = '482913';

function fakeProvider(name = 'fake', send = jest.fn(async () => undefined)): SmsProvider {
  return { name, send };
}

describe('SmsService', () => {
  it('exposes the selected provider name', () => {
    expect(new SmsService(fakeProvider('twilio')).providerName).toBe('twilio');
  });

  it('delegates to the injected provider', async () => {
    const send = jest.fn(async () => undefined);
    const service = new SmsService(fakeProvider('fake', send));

    await service.sendOtp('+213 26 00 00 01', CODE);

    expect(send).toHaveBeenCalledWith('+213 26 00 00 01', CODE);
  });

  it('never throws when delivery fails — resend-code is the recovery path', async () => {
    const failing = fakeProvider('fake', jest.fn(async () => Promise.reject(new Error('twilio exploded'))));
    const service = new SmsService(failing);

    await expect(service.sendOtp('+213 26 00 00 01', CODE)).resolves.toBeUndefined();
  });

  it('logs the redacted phone but never the code when delivery fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failing = fakeProvider('fake', jest.fn(async () => Promise.reject(new Error('boom'))));
    const service = new SmsService(failing);

    await service.sendOtp('+213 26 00 00 01', CODE);

    const line = String(errorSpy.mock.calls[0]?.[0]);
    expect(line).toContain('***0001');
    expect(line).not.toContain(CODE);
    errorSpy.mockRestore();
  });

  it('accepts the provider only through the token type', () => {
    // compile-time guard: the token is typed, so a mismatch fails the build, not prod
    expect(SMS_PROVIDER.toString()).toContain('SMS_PROVIDER');
  });
});

describe('ConsoleSmsProvider', () => {
  const originalEnv = process.env.NODE_ENV;
  let logSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs the code in development so the flow is testable offline', async () => {
    process.env.NODE_ENV = 'development';
    await new ConsoleSmsProvider().send('+213 26 00 00 01', CODE);

    expect(String(logSpy.mock.calls[0]?.[0])).toContain(CODE);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never logs the code in production', async () => {
    process.env.NODE_ENV = 'production';
    await new ConsoleSmsProvider().send('+213 26 00 00 01', CODE);

    for (const call of [...logSpy.mock.calls, ...errorSpy.mock.calls]) {
      expect(String(call[0])).not.toContain(CODE);
    }
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('***0001');
  });

  it('still resolves in production (signup must not break)', async () => {
    process.env.NODE_ENV = 'production';
    await expect(new ConsoleSmsProvider().send('+213 26 00 00 01', CODE)).resolves.toBeUndefined();
  });
});

describe('TwilioSmsProvider', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'secret-token';
    process.env.TWILIO_FROM = '+15005550006';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('refuses to run without its three variables', async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const provider = new TwilioSmsProvider();

    await expect(provider.send('+213 26 00 00 01', CODE)).rejects.toMatchObject({
      status: 503,
      getResponse: expect.any(Function),
    });
  });

  it('posts to the Messages API with basic auth and the code in the body', async () => {
    const fetchMock = jest.fn(async () => new Response('{}', { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await new TwilioSmsProvider().send('+213 26 00 00 01', CODE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/Accounts/ACtest/Messages.json');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('ACtest:secret-token').toString('base64')}`);
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get('To')).toBe('+213 26 00 00 01');
    expect(sent.get('From')).toBe('+15005550006');
    expect(sent.get('Body')).toContain(CODE);
    // the French copy carries an em dash, so assert on the encoded bytes too
    expect(String(init.body)).toContain('%E2%80%94');
  });

  it('turns a 4xx/5xx from Twilio into a typed 503', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 400 })) as unknown as typeof fetch;
    await expect(new TwilioSmsProvider().send('+213 26 00 00 01', CODE)).rejects.toMatchObject({
      status: 503,
    });
  });
});
