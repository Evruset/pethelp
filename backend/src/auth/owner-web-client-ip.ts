import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

const MAX_CLOCK_SKEW_SECONDS = 30;

function normalizeIp(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const candidate = trimmed.startsWith('::ffff:') && isIP(trimmed.slice(7)) === 4 ? trimmed.slice(7) : trimmed;
  return isIP(candidate) ? candidate : '';
}

function signedIp(request: Request, nowSeconds: number): string {
  const secret = process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET;
  if (!secret || secret.length < 32) return '';
  const assertedIp = (request.header('x-vethelp-client-ip') ?? '').trim().toLowerCase();
  const ip = normalizeIp(assertedIp);
  const timestamp = request.header('x-vethelp-client-ip-timestamp') ?? '';
  const signature = request.header('x-vethelp-client-ip-signature') ?? '';
  if (!ip || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return '';
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return '';
  const expected = createHmac('sha256', secret).update(`${timestamp}\n${assertedIp}`).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? ip : '';
}

export function ownerOtpClientIp(request: Request, nowSeconds = Math.floor(Date.now() / 1000)): string {
  return signedIp(request, nowSeconds) || normalizeIp(request.socket?.remoteAddress ?? '');
}
