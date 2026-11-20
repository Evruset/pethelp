---
name: targeted-tests
description: Run the selected focused tests and static checks, record reproducible evidence, and stop when they cover the affected risk.
---

Use checks already identified in the task brief or current evidence. If the affected checks are unclear, use `$affected-tests` to select them. Run selected static and unit checks first, then affected integration and focused end-to-end checks where needed.

Record commands, results and evidence with bounded logs. Keep matching reproducible PASS evidence and rerun only failed or affected checks. Stop when the risk is covered. Use full build or end-to-end coverage only when justified by cross-cutting risk or an explicit release gate.
