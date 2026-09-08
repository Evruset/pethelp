# T020 Owner authentication certification

Date: 2026-08-12
Jira: SCRUM-644 / T020
Scope: Story S07 authentication journey, authoritative session and client isolation.

| Scenario | Executable evidence | Result | Residual boundary |
|---|---|---|---|
| Guest booking → OTP → session → one-shot continuation | Integrated AuthJourneyProvider/SessionProvider case | PASS | Continuation is a safe prompt, not booking creation |
| Direct login | Direct-login component case | PASS | None |
| Invalid and expired OTP | T020 negative component cases plus backend auth integration | PASS | Server remains time/attempt authority |
| Resend/supersession/used challenge | RN replacement/conflict cases plus backend core integration | PASS | Real SMS provider not certified |
| Rate limit/block/provider/network error | RN safe-copy matrix, bounded API metadata test and T126/T128 evidence | PASS | Production abuse load not certified |
| Cold bootstrap, invalid/revoked/unknown session | SessionProvider authority matrix | PASS | None |
| Logout and unconfirmed revoke | SessionProvider matrix plus backend HTTP integration | PASS | No background revoke retry by T012 design |
| Owner A → B cache isolation | Distinct A authority/session → logout → distinct B credential/scope with query-consumer assertions | PASS | No account-switcher feature |
| Protected route containment | Real `expo-router/testing-library` direct `/(app)` entry with protected sentinel | PASS | Backend remains final resource authority |
| Duplicate/stale command races | Provider-level deferred request/verify and T012 generation tests | PASS | None |
| Sensitive data and enumeration neutrality | Closed parsing, safe-copy assertions and targeted review | PASS | No global analytics audit claimed |

No device, signed build, provider sandbox, production load, Jira transition or Story acceptance is claimed by this package.
