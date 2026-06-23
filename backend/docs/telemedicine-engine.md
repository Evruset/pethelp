# Telemedicine Engine

A confirmed booking hold causes PostgreSQL to append `telemed.session.start.requested.v1` to the transactional outbox. `TelemedSessionStartWorker` creates an idempotent waiting session.

A doctor has five minutes to join. `TelemedSlaWorker` transitions an overdue session to `DOCTOR_TIMEOUT`, creates an immutable SLA ledger entry and queues the existing provider void command in the same short transaction.

Video room tokens are short-lived HMAC JWT-compatible tokens. Set `TELEMED_TOKEN_SECRET` in the runtime secret manager; when omitted, the service uses `JWT_SECRET` for the local simulation boundary.
