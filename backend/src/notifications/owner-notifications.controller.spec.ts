import { Role, type JwtPayload } from '../auth/auth.types';
import { OwnerNotificationsController } from './owner-notifications.controller';

const owner = { sub: '11111111-1111-4111-8111-111111111111', roles: [Role.OWNER] } as JwtPayload;
const record = {
  id: '22222222-2222-4222-8222-222222222222', recipientOwnerId: owner.sub,
  sourceOutboxEventId: '33333333-3333-4333-8333-333333333333',
  bookingHoldId: '44444444-4444-4444-8444-444444444444', appointmentId: null,
  notificationType: 'CONFIRMED', aggregateVersion: 2, title: 'Запись подтверждена',
  body: 'Клиника подтвердила запись.', readAt: null, createdAt: '2026-08-09T10:00:00.000Z',
};

describe('OwnerNotificationsController', () => {
  it('derives recipient from JWT and returns only the public projection', async () => {
    const repository = { projectPendingForOwner: jest.fn(), listForOwner: jest.fn().mockResolvedValue([record]) };
    const controller = new OwnerNotificationsController(repository as never);
    const result = await controller.list(owner, '20');
    expect(repository.projectPendingForOwner).toHaveBeenCalledWith(owner.sub);
    expect(repository.listForOwner).toHaveBeenCalledWith(owner.sub, 20);
    expect(result.notifications[0]).toEqual({
      id: record.id, notificationType: 'CONFIRMED', title: record.title, body: record.body,
      bookingHoldId: record.bookingHoldId, appointmentId: null, readAt: null, createdAt: record.createdAt,
    });
    expect(result.notifications[0]).not.toHaveProperty('recipientOwnerId');
    expect(result.notifications[0]).not.toHaveProperty('sourceOutboxEventId');
    expect(result.notifications[0]).not.toHaveProperty('aggregateVersion');
  });

  it('hides foreign notification existence on mark-read', async () => {
    const repository = { markReadAndGet: jest.fn().mockResolvedValue(undefined) };
    const controller = new OwnerNotificationsController(repository as never);
    await expect(controller.markRead(owner, record.id)).rejects.toMatchObject({ status: 404 });
    expect(repository.markReadAndGet).toHaveBeenCalledWith(owner.sub, record.id);
  });
});
