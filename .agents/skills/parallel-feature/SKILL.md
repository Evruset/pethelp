---
name: parallel-feature
description: Implement a feature with two or more independent slices using controlled mixed-model subagents; use only when parallelism materially reduces elapsed work.
---

Use <=3 children and depth 1. Spawn explorer_luna once. Assign non-overlapping slices to implementer_terra; optionally tester_terra for independent test planning. Use integrator_terra only for contract reconciliation. Spawn reviewer_sol once after integration. No external MCP unless explicitly necessary.
