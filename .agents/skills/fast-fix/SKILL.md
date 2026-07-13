---
name: fast-fix
description: Perform a small deterministic code or UI change with minimum context, minimum diff, and targeted validation; not for architecture or cross-module redesign.
---

Confirm acceptance criteria. Search only named files/direct symbols. Do not spawn agents or use MCP. Make the smallest edit and run one targeted check. Return changed files, check, risk. Recommend standard if >3 coupled files or a public contract changes.
