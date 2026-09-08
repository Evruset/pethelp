# V50-CLINIC-04F — Patient local alias Portal

The existing clinic Patient Detail page owns this workflow. The official pet
name remains the page heading; **Имя в клинике** is a separate internal-only
block with **Не задано** for an absent alias.

The read projection remains visible when mutations are disabled. Edit is
available only with `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS=true`, effective
`patient.admin.local-profile.update`, exact clinic/location scope and an
authoritative Detail version. The compact dialog supports set, replace and
explicit clear; clear alone sends `null`.

Client validation applies NFC, trim, 1–80 Unicode code points, and rejects
blank, newline and control/format values. The Portal BFF forwards strong quoted
`If-Match` and a UUID idempotency key. A technical retry of an unchanged
normalized SET/CLEAR intent reuses the key. All new intents use a new key.

Validated success updates alias, version and timestamp without an optimistic
write. Stale/association conflicts refresh Detail and never auto-resubmit.
403 removes edit while preserving authorized read data. No-leak 404 removes
the snapshot. Policy, network, 5xx and malformed-success failures preserve the
last valid snapshot and expose a safe retry.

The dialog supplies accessible labelling and descriptions, live error/pending
announcements, focus entry/return, Escape close when idle, disabled pending
controls and explicit clear naming. Flexible controls and word wrapping prevent
horizontal overflow at 390×844; focused evidence also covers desktop and tablet
viewports.

F-01–F-30 are grouped in the deterministic Patient Detail Playwright suite:
F-01..F-05 presentation and gates; F-06..F-11 set/replace/clear, scope,
versions and headers; F-12..F-14 double-submit and intent lifecycle; F-15
response fields; F-16..F-22 conflict, authority, no-leak and snapshot
preservation; F-23..F-26 validation; F-27..F-28 pending/focus/keyboard; and
F-29..F-30 1440×900, 1024×768, 390×844 and exact route-scope evidence.
Backend, migrations, roles, state machines,
new screens, WebSocket/SSE, Registry mutation and Owner Mobile are excluded.
