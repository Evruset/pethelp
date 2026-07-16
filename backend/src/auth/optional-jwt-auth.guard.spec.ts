import type { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import type { JwtAuthGuard } from './jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  it('allows a guest request without invoking JWT validation', async () => {
    const jwtAuth = { canActivate: jest.fn() } as unknown as JwtAuthGuard;
    const request = { headers: {}, user: { sub: 'stale' } };

    await expect(new OptionalJwtAuthGuard(jwtAuth).canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
    expect(jwtAuth.canActivate).not.toHaveBeenCalled();
  });

  it('delegates a present authorization header so invalid tokens remain 401', async () => {
    const error = new Error('invalid token');
    const jwtAuth = { canActivate: jest.fn().mockRejectedValue(error) } as unknown as JwtAuthGuard;
    const request = { headers: { authorization: 'Bearer invalid' } };

    await expect(new OptionalJwtAuthGuard(jwtAuth).canActivate(context(request))).rejects.toBe(error);
    expect(jwtAuth.canActivate).toHaveBeenCalledTimes(1);
  });
});

function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
