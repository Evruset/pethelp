type TestDatabase = {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
};

/**
 * Clears the shared booking persistence graph for integration fixtures.
 * Notification rows must be removed before their authoritative outbox parent.
 */
export async function resetBookingPersistence(database: TestDatabase): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('TEST_DATABASE_RESET_FORBIDDEN');
  }
  await database.query(`
    TRUNCATE
      booking_schema.owner_notification_email_deliveries,
      booking_schema.owner_notifications,
      booking_schema.outbox_events,
      booking_schema.idempotency_records,
      audit_schema.audit_log
  `);
}
