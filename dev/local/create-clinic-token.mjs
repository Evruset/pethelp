import { createHmac } from 'node:crypto';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const clinicId = required('LOCAL_CLINIC_ID');
const locationId = required('LOCAL_CLINIC_LOCATION_ID');
const employeeId = process.env.LOCAL_CLINIC_EMPLOYEE_ID ?? '33333333-3333-4333-8333-333333333333';
const roles = (process.env.LOCAL_CLINIC_ROLES ?? 'CLINIC_RECEPTIONIST')
  .split(',')
  .map((role) => role.trim())
  .filter(Boolean);
const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const payload = {
  sub: employeeId,
  roles,
  clinicIds: [clinicId],
  locationIds: [locationId],
  iss: required('JWT_ISSUER'),
  aud: required('JWT_AUDIENCE'),
  iat: now,
  exp: now + 8 * 60 * 60,
};
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
const signature = createHmac('sha256', required('JWT_SECRET')).update(unsigned).digest('base64url');
process.stdout.write(`${unsigned}.${signature}\n`);
