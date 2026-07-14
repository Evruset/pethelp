# V50 Authoritative Source Manifest

## Decision

```text
AUTHORITATIVE_SOURCE_CONFIRMED
targetVersion: V50
sourcePath: prototype-v50/index.html
decisionSource: product owner clarification
```

V51 does not exist as a product target. Existing V51 runtime identifiers are compatibility debt and are not renamed by this decision.

## Machine-readable manifest

- File: `prototype-v50/manifest.json`
- Prototype metadata: `v50-clinic-role-workspaces`
- Entrypoint: `prototype-v50/index.html`
- Checksum algorithm: `SHA-256(path\\0content\\0, sorted requiredFiles)`
- Bundle SHA-256: `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`
- Required files: 108 source, JS, CSS, and asset files; all must exist.

## Extracted source contract

| Metric | Value |
|---|---:|
| Unique screens | 30 |
| DOM screen nodes | 31 |
| Routes | 15 |
| Primary navigation anchors | 15 |
| State/status tokens | 41 |
| Roles | `doctor`, `reception` |
| Responsive variants | desktop, tablet, mobile, reduced-motion |

The duplicate DOM screen node is `catalog`. The manifest checksum is the common source reference for every row in `V50-PARITY-REGISTER.md`.

## Verification

```text
node scripts/v50-prototype-inventory.mjs prototype-v50/index.html --require-v50 --verify-manifest
```

Verification fails closed for missing required files, manifest differences, checksum differences, wrong source path, or non-V50 metadata. The stale `--require-v51` argument exits 2 with `UNSUPPORTED_TARGET_VERSION`.
