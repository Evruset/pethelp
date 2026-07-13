---
name: targeted-tests
description: Select and run the smallest test and static-check set that validates the current diff; use to avoid full-suite token and time cost.
---

Inspect changed behavior and nearest tests. Run changed-file/static, targeted unit, targeted integration, focused e2e in that order. Stop when risks are covered. Full build/e2e only for cross-cutting change or explicit release gate. Truncate logs.
