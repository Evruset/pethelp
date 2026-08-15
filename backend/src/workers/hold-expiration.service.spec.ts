import { HoldExpirationService } from './hold-expiration.service';

describe('HoldExpirationService lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService(expireHolds = jest.fn().mockResolvedValue({ expired: 0 })) {
    const expirationBacklog = jest.fn().mockResolvedValue({ pendingCount: 3, overdueCount: 1, oldestOverdueAgeSeconds: 12 });
    const service = new HoldExpirationService({ expireHolds, expirationBacklog } as never);
    return { service, expireHolds, expirationBacklog };
  }

  it('runs one shared interval and retries after a failed scheduled cycle', async () => {
    const failure = new Error('Booking unavailable');
    const expireHolds = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ expired: 1 });
    const { service } = createService(expireHolds);
    const error = jest.spyOn((service as any).logger, 'error').mockImplementation();

    service.onModuleInit();
    service.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(error).toHaveBeenCalledWith(
      'Hold expiration cycle failed; the next scheduled cycle will retry',
    );

    await jest.advanceTimersByTimeAsync(15_000);
    expect(expireHolds).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not overlap cycles and waits for the active cycle during shutdown', async () => {
    let resolve!: (result: { expired: number }) => void;
    const active = new Promise<{ expired: number }>((done) => {
      resolve = done;
    });
    const { service, expireHolds } = createService(jest.fn().mockReturnValue(active));

    const first = service.runOnce();
    await expect(service.runOnce()).resolves.toEqual({ expired: 0 });
    expect(expireHolds).toHaveBeenCalledTimes(1);

    let destroyed = false;
    const shutdown = service.onModuleDestroy().then(() => {
      destroyed = true;
    });
    await Promise.resolve();
    expect(destroyed).toBe(false);

    resolve({ expired: 1 });
    await expect(first).resolves.toEqual({ expired: 1 });
    await shutdown;
    await expect(service.runOnce()).resolves.toEqual({ expired: 0 });
    expect(expireHolds).toHaveBeenCalledTimes(1);
  });

  it('keeps direct run failures observable to callers', async () => {
    const failure = new Error('database configuration invalid');
    const { service } = createService(jest.fn().mockRejectedValue(failure));

    await expect(service.runOnce()).rejects.toBe(failure);
  });

  it('resets lifecycle state after a synchronous booking failure', async () => {
    const failure = new Error('synchronous adapter failure');
    const expireHolds = jest
      .fn()
      .mockImplementationOnce(() => {
        throw failure;
      })
      .mockResolvedValueOnce({ expired: 0 });
    const { service } = createService(expireHolds);

    await expect(service.runOnce()).rejects.toBe(failure);
    await expect(service.runOnce()).resolves.toEqual({ expired: 0 });
    expect(expireHolds).toHaveBeenCalledTimes(2);
  });

  it('exposes bounded success, processed, failure and backlog health signals', async () => {
    const expireHolds = jest.fn().mockResolvedValueOnce({ expired: 2 }).mockRejectedValueOnce(new Error('secret database detail'));
    const { service } = createService(expireHolds);

    await expect(service.runOnce()).resolves.toEqual({ expired: 2 });
    const first = service.healthSnapshot();
    expect(first).toMatchObject({ running: false, processedTotal: 2, failuresTotal: 0, pendingCount: 3, overdueCount: 1, oldestOverdueAgeSeconds: 12 });
    expect(first.lastSuccessAt).toEqual(expect.any(String));

    await expect(service.runOnce()).rejects.toThrow('secret database detail');
    const failed = service.healthSnapshot();
    expect(failed).toMatchObject({ running: false, processedTotal: 2, failuresTotal: 1 });
    expect(JSON.stringify(failed)).not.toContain('secret database detail');
  });
});
