import { randomUUID } from 'node:crypto';
import { ContextLoggerService } from './context-logger.service';
import { TraceContext } from './trace-context.context';

describe('ContextLoggerService safe telemetry boundary', () => {
  const trace = new TraceContext();
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => consoleSpy.mockRestore());

  it('keeps only allowlisted primitive fields and framework authority', () => {
    const logger = new ContextLoggerService(trace);
    const correlationId = randomUUID();
    const holdId = randomUUID();
    trace.run({ correlationId }, () => logger.event('log', 'BookingCore', 'booking.command.completed', {
      holdId,
      outcome: 'CONFIRMED',
      duration_ms: 12.5,
      timestamp: 'attacker',
      level: 'fatal',
      context: 'attacker',
      message: 'attacker',
      correlationId: randomUUID(),
      unknown: 'attacker',
    }));

    const payload = JSON.parse(String(consoleSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({ context: 'BookingCore', message: 'booking.command.completed', correlationId, holdId, outcome: 'CONFIRMED', duration_ms: 12.5 });
    expect(payload.level).toBe('info');
    expect(payload.unknown).toBeUndefined();
  });

  it.each([
    ['otp', '123456'],
    ['accessToken', 'secret-access-token'],
    ['sessionToken', 'secret-session-token'],
    ['refreshToken', 'secret-refresh-token'],
    ['Authorization', 'Bearer secret'],
    ['Cookie', 'sid=secret'],
    ['phone', '+79991234567'],
    ['email', 'owner@example.test'],
    ['freeText', 'private owner note'],
    ['requestBody', { otp: '123456' }],
    ['responseBody', { token: 'secret' }],
    ['providerPayload', { raw: 'secret' }],
    ['error', new Error('token=secret')],
  ])('drops denied field %s', (key, value) => {
    const logger = new ContextLoggerService(trace);
    logger.event('log', 'Security', 'telemetry.security.checked', { [key]: value });
    const payload = JSON.parse(String(consoleSpy.mock.calls[0][0]));
    expect(payload[key]).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(JSON.stringify(payload)).not.toContain('123456');
    expect(JSON.stringify(payload)).not.toContain('owner@example.test');
    expect(JSON.stringify(payload)).not.toContain('+79991234567');
  });

  it('drops arbitrary messages and nested objects', () => {
    const logger = new ContextLoggerService(trace);
    logger.log({ nested: { token: 'secret' } });
    expect(JSON.parse(String(consoleSpy.mock.calls[0][0])).message).toBe('UNSAFE_TELEMETRY_MESSAGE_DROPPED');
  });

  it('drops arbitrary free-text messages and unsafe context', () => {
    const logger = new ContextLoggerService(trace);
    logger.event('log', 'owner@example.test', 'Иван принимает секретный препарат', {});
    expect(JSON.parse(String(consoleSpy.mock.calls[0][0]))).toMatchObject({
      context: 'VetHelp',
      message: 'UNSAFE_TELEMETRY_MESSAGE_DROPPED',
    });
  });

  it('fails closed when sanitizer property enumeration throws', () => {
    const logger = new ContextLoggerService(trace);
    const fields = new Proxy({}, { ownKeys: () => { throw new Error('sanitizer failed with secret'); } });
    logger.event('log', 'Security', 'telemetry.sanitizer.failed', fields);
    const payload = JSON.parse(String(consoleSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({ context: 'Security', message: 'telemetry.sanitizer.failed' });
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('rejects code-shaped secrets from core and every string-valued field', () => {
    const logger = new ContextLoggerService(trace);
    logger.event('log', 'secret-access-token', 'sk_live_example', {
      alert_type: 'secret-access-token', errorCode: 'sk_live_example', feature_state: 'secret-access-token',
      freshness_state: 'sk_live_example', metric: 'secret-access-token', outcome: 'sk_live_example',
      provider: 'secret-access-token', query_length_bucket: 'sk_live_example',
      role_class: 'secret-access-token', state: 'sk_live_example',
    });
    const serialized = String(consoleSpy.mock.calls[0][0]);
    expect(serialized).not.toContain('secret-access-token');
    expect(serialized).not.toContain('sk_live_example');
  });

  it('does not invoke accessor fields', () => {
    const logger = new ContextLoggerService(trace);
    const getter = jest.fn(() => 'secret-access-token');
    const fields = Object.defineProperty({}, 'outcome', { enumerable: true, get: getter });
    logger.event('log', 'Security', 'telemetry.security.checked', fields);
    expect(getter).not.toHaveBeenCalled();
    expect(String(consoleSpy.mock.calls[0][0])).not.toContain('secret-access-token');
  });

  it('preserves the bounded Registry access method and redacted route template', () => {
    const logger = new ContextLoggerService(trace);
    logger.event('log', 'RegistryReferenceAccess', 'http.request.completed', {
      method: 'GET',
      route: '/v1/clinic/:clinicId/locations/:locationId/patients?administrativeReference=[REDACTED]',
      status_code: 200,
    });
    expect(JSON.parse(String(consoleSpy.mock.calls[0][0]))).toMatchObject({
      method: 'GET',
      route: '/v1/clinic/:clinicId/locations/:locationId/patients?administrativeReference=[REDACTED]',
      status_code: 200,
    });
  });
});
