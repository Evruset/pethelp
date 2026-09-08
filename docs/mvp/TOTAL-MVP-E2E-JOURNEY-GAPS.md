# Total MVP E2E Journey Gaps

Mocked fixtures and static prototypes are never counted as complete E2E.

| Journey | Edge classification | Verdict | Largest gap / wave |
|---|---|---|---|
| JOURNEY-001 QR → Owner Expo Web → OTP → request → Queue → confirm → Owner Web | QR attribution `PARTIAL`; Expo Web OTP/request/Queue confirm/authoritative readback `IMPLEMENTED_RUNTIME` | `PARTIAL` | persistent QR attribution / W8 |
| JOURNEY-002 Owner Mobile repeat booking → Queue → confirm → Mobile | Mobile selection/request `IMPLEMENTED_RUNTIME`; Queue/confirm/readback `IMPLEMENTED_RUNTIME`; repeat/history navigation `PARTIAL` | `PARTIAL` | full repeat journey and production evidence / W1,W4 |
| JOURNEY-003 request → 15-minute expiry → release → Owner readback | exact PostgreSQL deadline, expiry/release, race and Owner authoritative readback `IMPLEMENTED_RUNTIME`; focused real-PG + Owner evidence complete | `IMPLEMENTED` | physical-device/pilot acceptance remains a human gate |
| JOURNEY-004 Clinic reject → Owner terminal readback | Queue reject/backend/readback `IMPLEMENTED_RUNTIME`; Mobile controlled-seam evidence `PARTIAL` | `PARTIAL` | production channel proof / W1 |
| JOURNEY-005 Owner cancellation request → Operations → resolution | current direct cancellation `LEGACY_ONLY`; request/Ops/resolution `MISSING` | `NOT_STARTED` | BookingChangeRequest/Ops / W5 |
| JOURNEY-006 Owner reschedule request → Operations → resolution | all target edges `MISSING`; legacy status token is not a lifecycle | `NOT_STARTED` | BookingChangeRequest/Ops / W5 |
| JOURNEY-007 Clinic cancellation → Smart Reallocation → Booking B | same-location alternative `LEGACY_ONLY`; cross-clinic search/offer/B lineage `MISSING` | `NOT_STARTED` | reallocation domain / W6 |
| JOURNEY-008 Visit completion → Result → DiaryEntry → notification | Visit `PARTIAL`; Result/DiaryEntry/notification `MISSING`; legacy Diary `LEGACY_ONLY` | `BROKEN` | medical result/Diary domains / W7 |
| JOURNEY-009 Partner QR → booking → completed visit attribution | correlation pieces `PARTIAL`; QR persistence/visit attribution/reporting `MISSING` | `BROKEN` | attribution model / W8 |
| JOURNEY-010 Clinic Portal DoctorShift → publish → Owner Expo Web generated slot → Queue decision → Owner readback | production Portal build, Backend/PostgreSQL generation/publication, shared Owner selection, pending hold, Queue UI confirm and Owner confirmed readback `IMPLEMENTED_RUNTIME`; generated reject and expiry also proven | `IMPLEMENTED` | human Pilot/UAT acceptance remains separate |

Critical-path score is 29% with high confidence: backend booking edges are strong, but no journey is production-complete across all required presentation clients and operational/medical outcomes.
