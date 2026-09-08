# V50-OWNER-04 bootstrap

Title: V50 Service, Slot and Booking Review

Status: `V50-OWNER-04: ACTIVE`

Goal: deliver read-only `OWN-005 #booking → /owner/booking` and `OWN-006
#booking-review → /owner/booking/review`, stopping before hold or mutation.

Allowed scope: Owner booking selection UI/entrypoint, public-catalog safe read,
focused tests, V50 contract/parity/state/evidence documents. Forbidden: Portal,
payment, MIS, migrations, hold/booking mutation, dependencies and unrelated
refactors.

Acceptance: server-authored timezone/freshness/confirmation/price; typed intent;
guest auth restoration with pet revalidation; offline block; dependency-ordered
default-off flags; responsive/state evidence; rollback to legacy.

Baseline: OWNER-03 integrated by `e747f61`; retained package
`v50-owner-03-dc762b4` verified 48/48 runtime, 16/16 prototype, SHA-256
`e07837d15af828090b6be02b50be06b9f1dde3d60fa37f913991a87cac60a67b`.

Architecture: additive Public Catalog read is required because the legacy
availability DTO exposes remaining capacity. Existing reads and booking
mutation remain unchanged. Persistent Work Chat is unavailable; this file is
the bounded durable context.
