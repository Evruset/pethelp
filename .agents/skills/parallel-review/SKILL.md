---
name: parallel-review
description: Review an existing diff with cheap exploration and one high-quality Sol reviewer; use before PR or release, not during initial implementation.
---

Run read-only explorer_luna and reviewer_sol. Add security_reviewer_sol only for auth, permissions, secrets, external input, or sensitive data. Do not edit. Merge duplicates and report actionable findings by severity.
