import { ApiError } from '@/api/errors';
import { createSessionAuthority } from './session-authority';

it('uses the canonical typed API boundary for validation and revoke without token leakage',async()=>{
  const request=jest.fn().mockResolvedValueOnce({subjectId:'11111111-1111-4111-8111-111111111111',roles:['OWNER']}).mockResolvedValueOnce(undefined);
  const authority=createSessionAuthority({request});
  await expect(authority.validate('vh_secret')).resolves.toMatchObject({subjectId:expect.any(String)});
  await authority.revoke('vh_secret');
  expect(request).toHaveBeenNthCalledWith(1,'v1/auth/session',expect.objectContaining({headers:{Authorization:'Bearer vh_secret'}}));
  expect(request).toHaveBeenNthCalledWith(2,'v1/auth/logout',expect.objectContaining({method:'POST'}));
});

it('rejects malformed or non-owner authoritative snapshots',async()=>{
  const authority=createSessionAuthority({request:jest.fn().mockResolvedValue({subjectId:'bad',roles:['OWNER']})});
  await expect(authority.validate('opaque')).rejects.toBeInstanceOf(ApiError);
});
