import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Endpoint discovery protection. Production and regular development runtimes
 * receive a 404 rather than an authorization failure or route metadata.
 */
@Injectable()
export class SandboxOnlyGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'sandbox-cert' || process.env.VETHELP_SANDBOX_CERT_ENABLED !== 'true') {
      throw new NotFoundException();
    }
    return true;
  }
}
