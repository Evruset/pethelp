import { SetMetadata } from '@nestjs/common';
import { Role } from './auth.types';

export const ROLES_KEY = 'vethelp:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
