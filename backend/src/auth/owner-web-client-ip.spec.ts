import { createHmac } from 'node:crypto';
import { ownerOtpClientIp } from './owner-web-client-ip';

const NOW = 1_777_000_000;
const SECRET = 'owner-web-test-signing-secret-32-bytes-long';
const request = (remoteAddress: string | undefined, headers: Record<string, string> = {}) => ({
  ip: headers['express-ip'] ?? '203.0.113.99',
  socket: { remoteAddress },
  header: (name: string) => headers[name.toLowerCase()],
}) as never;
const signed = (ip: string, timestamp = String(NOW), secret = SECRET) => ({
  'x-vethelp-client-ip': ip,
  'x-vethelp-client-ip-timestamp': timestamp,
  'x-vethelp-client-ip-signature': createHmac('sha256', secret).update(`${timestamp}\n${ip}`).digest('hex'),
});

describe('Owner OTP client IP authority', () => {
  beforeEach(() => { process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET = SECRET; });
  afterEach(() => { delete process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET; });

  it.each([
    ['IPv4', '198.51.100.7', '198.51.100.7'],
    ['IPv6', '2001:db8::7', '2001:db8::7'],
    ['mapped', '::ffff:192.0.2.9', '192.0.2.9'],
  ])('accepts a fresh authenticated %s assertion', (_name, ip, expected) => {
    expect(ownerOtpClientIp(request('127.0.0.1', signed(ip)), NOW)).toBe(expected);
  });

  it.each([
    ['bad signature', { ...signed('198.51.100.8'), 'x-vethelp-client-ip-signature': '0'.repeat(64) }],
    ['stale timestamp', signed('198.51.100.8', String(NOW - 31))],
    ['future timestamp', signed('198.51.100.8', String(NOW + 31))],
    ['malformed IP', signed('not-an-ip')],
    ['unsigned forwarding header', { 'x-forwarded-for': '198.51.100.8' }],
  ])('falls back to the direct peer for %s', (_name, headers) => {
    expect(ownerOtpClientIp(request('127.0.0.1', headers), NOW)).toBe('127.0.0.1');
  });

  it('fails closed without either a valid signature or socket peer', () => {
    expect(ownerOtpClientIp(request(undefined), NOW)).toBe('');
    expect(ownerOtpClientIp(request('bad'), NOW)).toBe('');
  });
});
