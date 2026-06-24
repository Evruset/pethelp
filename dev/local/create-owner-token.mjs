import { createHmac } from 'node:crypto';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const ownerId = process.env.LOCAL_OWNER_ID ?? '11111111-1111-4111-8111-111111111111';
const payload = {
  sub: ownerId,
  roles: ['OWNER'],
  iss: required('JWT_ISSUER'),
  aud: required('JWT_AUDIENCE'),
  iat: now,
  exp: now + 8 * 60 * 60,
};
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
const signature = createHmac('sha256', required('JWT_SECRET')).update(unsigned).digest('base64url');
process.stdout.write(`${unsigned}.${signature}\n`);
