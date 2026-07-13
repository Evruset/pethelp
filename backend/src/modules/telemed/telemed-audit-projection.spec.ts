import { projectTelemedAuditEvent, TELEMED_AUDIT_EVENT_TYPES, UnsupportedTelemedAuditEventError } from './telemed-audit-projection';

describe('projectTelemedAuditEvent', () => {
  const createdAt = new Date('2026-07-12T10:00:00.000Z');

  it.each(TELEMED_AUDIT_EVENT_TYPES)('projects %s with exact display-safe fields', (eventType) => {
    const projected = projectTelemedAuditEvent({ id: '44444444-4444-4444-8444-444444444444', eventType, createdAt });
    expect(projected).toEqual({ id: '44444444-4444-4444-8444-444444444444', eventType, summaryCode: eventType, createdAt: '2026-07-12T10:00:00.000Z' });
    expect(Object.keys(projected).sort()).toEqual(['createdAt', 'eventType', 'id', 'summaryCode']);
    expect(JSON.stringify(projected)).not.toMatch(/ownerPhone|ownerEmail|token|stack|authorizationReason|internalHost|secret|payload/i);
  });

  it('fails closed for an unknown stored event type', () => {
    expect(() => projectTelemedAuditEvent({ id: '44444444-4444-4444-8444-444444444444', eventType: 'UNSUPPORTED', createdAt })).toThrow(UnsupportedTelemedAuditEventError);
  });
});
