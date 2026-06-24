import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class SandboxFixtureTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.SANDBOX_CERTIFICATION_TOKEN;
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const suppliedHeader = request.headers?.['x-sandbox-certification-token'];
    const supplied = Array.isArray(suppliedHeader) ? suppliedHeader[0] : suppliedHeader;

    if (!expected || !supplied || !safeEquals(expected, supplied)) {
      throw new NotFoundException();
    }
    return true;
  }
}

function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
