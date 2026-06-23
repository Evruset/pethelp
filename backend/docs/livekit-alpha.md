# LiveKit integration for Alpha

The backend uses the official `livekit-server-sdk` to mint room tokens and verify signed callbacks.

Set these runtime secrets through the deployment secret manager:

- `LIVEKIT_API_URL` — public WebSocket URL provided to approved clients, for example `wss://livekit.alpha.example`.
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Configure LiveKit webhooks to send `application/webhook+json` callbacks to:

```text
POST /v1/telemed/webhooks/livekit
```

The endpoint verifies the original raw body and `Authorization` token via `WebhookReceiver`. Do not put this route behind JSON body rewriting middleware or a proxy that modifies the request body.

The backend treats doctor identity as server-owned: a `participant_joined` event is audited as doctor activity only when its identity equals `telemed_schema.telemed_sessions.doctor_id` for the room.
