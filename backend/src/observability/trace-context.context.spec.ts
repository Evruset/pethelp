import { TraceContext } from './trace-context.context';

describe('TraceContext correlation input', () => {
  const trace = new TraceContext();
  const valid = '11111111-1111-4111-8111-111111111111';

  it('preserves one valid correlation ID', () => {
    expect(trace.correlationIdFromHeader(valid)).toBe(valid);
  });

  it.each([
    ['malformed', 'not-a-uuid'],
    ['duplicated array', [valid, valid]],
    ['duplicated distinct array', [valid, '22222222-2222-4222-8222-222222222222']],
    ['combined duplicate string', `${valid}, ${valid}`],
  ])('replaces %s input', (_case, value) => {
    const result = trace.correlationIdFromHeader(value);
    expect(result).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result).not.toBe(valid);
  });
});
