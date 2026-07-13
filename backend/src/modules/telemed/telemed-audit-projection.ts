export const TELEMED_AUDIT_EVENT_TYPES = [
  'ASSIGNED',
  'SAFETY_ESCALATED',
  'RECOMMENDATION_SAVED',
  'FOLLOW_UP_ROUTED',
  'SESSION_STARTED',
  'DOCTOR_CONNECTED',
  'OWNER_CANCELLED',
  'DOCTOR_TIMEOUT',
] as const;

export type TelemedAuditEventType = (typeof TELEMED_AUDIT_EVENT_TYPES)[number];
export type TelemedAuditItem = {
  id: string;
  eventType: TelemedAuditEventType;
  summaryCode: TelemedAuditEventType;
  createdAt: string;
};

export type StoredTelemedAuditEvent = {
  id: string;
  eventType: string;
  createdAt: Date;
};

export class UnsupportedTelemedAuditEventError extends Error {}

export function projectTelemedAuditEvent(event: StoredTelemedAuditEvent): TelemedAuditItem {
  if (!TELEMED_AUDIT_EVENT_TYPES.includes(event.eventType as TelemedAuditEventType)) {
    throw new UnsupportedTelemedAuditEventError(`Unsupported telemedicine audit event: ${event.eventType}`);
  }
  return {
    id: event.id,
    eventType: event.eventType as TelemedAuditEventType,
    summaryCode: event.eventType as TelemedAuditEventType,
    createdAt: event.createdAt.toISOString(),
  };
}
