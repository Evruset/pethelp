import type { Request } from 'express';

export enum Role {
  OWNER = 'OWNER',
  CLINIC_RECEPTIONIST = 'CLINIC_RECEPTIONIST',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
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
