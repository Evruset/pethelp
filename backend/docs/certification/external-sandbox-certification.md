# External sandbox certification contract

Run only through the protected `External Sandbox Certification` workflow or an isolated runner with:

```bash
NODE_ENV=sandbox-cert
SANDBOX_CERT_ENABLED=true
SANDBOX_FIXTURES_ENABLED=true
SANDBOX_ENVIRONMENT_ID=alpha-sandbox-01
SANDBOX_ALLOWED_HOSTS='vethelp-sandbox.example,mis-sandbox.example,acquiring-sandbox.example'
SANDBOX_VETHELP_URL='https://vethelp-sandbox.example'
SANDBOX_MIS_URL='https://mis-sandbox.example'
SANDBOX_ACQUIRING_URL='https://acquiring-sandbox.example'
SANDBOX_CERTIFICATION_TOKEN='...'
SANDBOX_OWNER_JWT='...'
SANDBOX_MIS_AUTH_TOKEN='...'
SANDBOX_ACQUIRING_SIGN_SECRET='...'
npm run cert:sandbox
```

The configuration rejects `NODE_ENV` values other than `sandbox-cert`, local database URLs, local hosts, production-looking hostnames and hosts outside `SANDBOX_ALLOWED_HOSTS`.

## Required provider controls

### MIS

`POST /__certification/scenarios/timeout-after-accept`

Headers: `Authorization: Bearer <SANDBOX_MIS_AUTH_TOKEN>`, `X-Correlation-ID`.

Payload:

```json
{ "delayMs": 4500, "correlationId": "uuid" }
```

The next reservation for the correlation must be accepted internally but held without a response for more than 4000 ms.

### Acquiring

`GET /__certification/payment-intents/{providerPaymentId}/void-evidence`

The response must confirm that the late fenced authorization caused a provider void:

```json
{ "voided": true, "merchantPaymentId": "payment-intent-uuid" }
```

## Required sandbox-only VetHelp fixture routes

All routes require `SANDBOX_CERTIFICATION_TOKEN`, are exposed only when `NODE_ENV=sandbox-cert`, and must not be mounted in production:

- `POST /v1/internal/certification/fixtures/alternative-slot`
- `GET /v1/internal/certification/booking-holds/{holdId}/slot-invariant`
- `POST /v1/internal/certification/fixtures/expired-payment-hold`
- `GET /v1/internal/certification/payment-intents/{paymentIntentId}/ledger`

`slot-invariant` returns `state`, `slot.heldCount`, `slot.activeHoldCount` and `slot.capacity`. The certification suite requires `MIS_RECONCILIATION_PENDING` and `heldCount === activeHoldCount > 0`.

The generator reads redacted evidence JSON and Jest result JSON and writes `artifacts/SANDBOX_CERTIFICATION_REPORT.md`.
