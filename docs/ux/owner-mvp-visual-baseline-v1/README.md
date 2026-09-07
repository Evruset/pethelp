# OWNER-MVP-VISUAL-V1

Status: `CANDIDATE_READY_FOR_HUMAN_VISUAL_ACCEPTANCE`.

This is the repository-controlled candidate visual baseline for the existing first-MVP Owner journey. It is not Product Owner approval and is not physical-device evidence.

The baseline uses the production React Native components, compiled through React Native Web with controlled session/query/API seams. It contains the mandatory 16 deterministic responsive states from welcome and authentication through selection, review, authoritative status, recovery and destructive cancellation.

## Direction

- calm iOS-inspired grouped surfaces without copying platform-private UI;
- one centered 500px Owner surface on wide web and edge-to-edge layout on phones;
- large-title hierarchy, restrained cards, inset sections and hairline dividers;
- semantic status encoded by text, tone and placement rather than color alone;
- minimum 48px controls, explicit selected/disabled states and destructive confirmation;
- shape-preserving loading, distinct empty/error/stale/conflict states;
- no dashboard, payments, emergency, telemedicine, insurance, Push/SMS/Telegram or future appointment center.

## Reproduction

```bash
npx -p node@22 node scripts/visual/capture-owner-foundation.mjs
npx -p node@22 node scripts/visual/capture-owner-availability.mjs
npx -p node@22 node scripts/visual/capture-owner-booking-request.mjs
npx -p node@22 node scripts/visual/capture-owner-booking-decision.mjs
npx -p node@22 node scripts/visual/capture-owner-cancellation.mjs
npx -p node@22 node scripts/visual/build-owner-mvp-visual-v1.mjs
```

See `manifest.json` for dimensions and SHA-256 digests. Human visual acceptance remains required for T142/T143/S05.
