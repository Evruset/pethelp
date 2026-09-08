# V50 Alternative Slot Gap Matrix

Initial classification; final closure is recorded after PostgreSQL and visual
gates.

| Concern | Status | Evidence / closure |
|---|---|---|
| Proposal creation/source | REUSE | Clinic command creates one pending swap group. |
| Original/proposed references | REUSE | Hold plus swap group retain both slot IDs. |
| Capacity policy | REUSE | Policy B: both slots are held during 15-minute TTL. |
| Owner read/isolation | REPAIR | Existing snapshot is owner-scoped but needs complete safe V50 actions/state metadata. |
| Accept/version/locking | REPAIR | Transaction exists; certify strict headers, replay fingerprint and race behavior. |
| Decline | REPAIR | Legacy Flutter uses generic release; add explicit proposal-resolution command and contract. |
| Expiration | REUSE | Worker/detected expiry exists; certify one counter/audit/outbox effect. |
| Price difference | MISSING | Add only server-authored neutral price semantics supported by current service snapshot. |
| Return to availability | MISSING | Add typed Flutter navigation intent; no implicit mutation/hold creation. |
| Authoritative readback | REPAIR | Existing BLoC has local success states; replace with detail/proposal readback. |
| Feature flags/evidence | MISSING | Add default-off dependent flag and 48-state evidence package. |

## Final closure

All required REPAIR/MISSING items above are closed at runtime `670bc32` without
schema migration. Capacity policy B and one global lock order are proven by the
focused real-PostgreSQL concurrency/rollback suite. Price wording is a neutral
server-authored notice; payment remains out of scope. Evidence integrity is
48/48 runtime plus 4/4 prototype references.
