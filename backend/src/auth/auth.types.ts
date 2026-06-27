import type { Request } from 'express';

export enum Role {
  GUEST = 'GUEST',
  OWNER = 'OWNER',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  CLINIC_RECEPTIONIST = 'CLINIC_RECEPTIONIST',
  CLINIC_VETERINARIAN = 'CLINIC_VETERINARIAN',
  TELEMED_VETERINARIAN = 'TELEMED_VETERINARIAN',
  SUPPORT_L1 = 'SUPPORT_L1',
  SUPPORT_L2 = 'SUPPORT_L2',
  FINANCE_OPERATOR = 'FINANCE_OPERATOR',
  INSURANCE_OPERATOR = 'INSURANCE_OPERATOR',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  SECURITY_AUDITOR = 'SECURITY_AUDITOR',
  SYSTEM_WORKER = 'SYSTEM_WORKER',
}

export interface JwtPayload {
  sub: string;
  roles: Role[];
  clinicIds?: string[];
  locationIds?: string[];
  iat?: number;
  exp?: number;
  nbf?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  authMode?: 'JWT' | 'SERVICE';
}
