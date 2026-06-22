import { createHmac } from 'node:crypto';

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const ownerId = process.env.B01_OWNER_ID ?? '11111111-1111-4111-8111-111111111111';
const secret = required('JWT_SECRET');
const now = Math.floor(Date.now() / 1000);
const header = encode({ alg: 'HS256', typ: 'JWT' });
const payload = encode({
  sub: ownerId,
  roles: ['OWNER'],
  iss: required('JWT_ISSUER'),
  aud: required('JWT_AUDIENCE'),
  iat: now,
  exp: now + 300,
});
const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
process.stdout.write(`${header}.${payload}.${signature}`);
