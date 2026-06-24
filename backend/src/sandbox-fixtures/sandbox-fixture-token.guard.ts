import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class SandboxFixtureTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.SANDBOX_CERTIFICATION_TOKEN;
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const explicit = first(request.headers?.['x-sandbox-certification-token']);
    const authorization = first(request.headers?.authorization);
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const supplied = explicit ?? bearer;

    if (!expected || !supplied || !safeEquals(expected, supplied)) {
      throw new NotFoundException();
    }
    return true;
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
