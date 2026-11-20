---
name: parallel-feature
description: Implement a feature with two or more independent slices using controlled mixed-model subagents; use only when parallelism materially reduces elapsed work.
---

Use at most three active threads including root. Only root may spawn, with at most two children concurrently at depth one and any lower configured limit taking precedence.

Assign independent, non-overlapping slices. Root owns production and authoritative writes unless explicitly authorized to delegate them. Use an explorer or tester only when the task needs independent discovery or test design. Use an integrator only for completed slices that need reconciliation. Select an independent reviewer when warranted by the remaining risk. Use external MCP only when required.

Resolve each role through [the adaptive-orchestrator routing policy](../adaptive-orchestrator/references/routing.md). The parent session supplies sandbox and approval settings. Keep assigned read-only work within those instructions.
