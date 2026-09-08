# Clinic Booking Journal prototype

Standalone product/UX prototype for `V50-CLINIC-MVP1-02`. It uses synthetic `demo-*` fixtures, performs no network requests and does not represent production authorization or backend command success.

Run locally:

```bash
python3 -m http.server 8091 --bind 127.0.0.1
```

Open `http://127.0.0.1:8091/?state=reception-ready&role=reception&date=2026-08-01`.

State and role are URL-driven; interactive transitions update the URL and reload restores the selected deterministic state. No state is persisted in `localStorage`.

The manifest checksum hashes the sorted `requiredFiles` as `path`, NUL, raw content, NUL. `manifest.json` and `generatedAt` are excluded to avoid a recursive/non-reproducible digest.
