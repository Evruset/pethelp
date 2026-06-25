# VetHelp Owner Mobile

This folder contains the owner-side mobile implementation slices for VetHelp.

Current slice planned after the clinic queue:

1. Alternative slot proposal screen.
2. Server-synchronized countdown from `serverNow` and `expiresAt`.
3. Accept alternative slot using `POST /v1/booking-holds/:holdId/alternative-slot/accept`.
4. No offline queue for booking or payment actions.
5. Soft retry for `SLOT_LOCKED_RETRY` and fenced UX for expired or stale proposals.

The mobile app must treat PostgreSQL/backend state as authoritative. Local timers are display only.
