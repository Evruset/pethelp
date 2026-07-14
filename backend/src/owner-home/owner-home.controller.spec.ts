import { Role, type JwtPayload } from '../auth/auth.types';
import { OwnerHomeController } from './owner-home.controller';

describe('OwnerHomeController', () => {
  it('passes only the authenticated owner and optional selected-pet hint to the service', async () => {
    const response = { schemaVersion: 1 };
    const home = { read: jest.fn().mockResolvedValue(response) };
    const controller = new OwnerHomeController(home as never);
    const owner: JwtPayload = {
      sub: '11111111-1111-4111-8111-111111111111',
      roles: [Role.OWNER],
    };

    await expect(controller.read(owner, '22222222-2222-4222-8222-222222222222')).resolves.toBe(response);
    expect(home.read).toHaveBeenCalledWith(owner, '22222222-2222-4222-8222-222222222222');
  });
});
