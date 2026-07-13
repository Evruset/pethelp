---
name: mode-router
description: Choose the cheapest sufficient Codex mode and model for a development task; use when asked to route, estimate, or select quality level.
---

Classify the task and return: mode, main model/reasoning, whether subagents are justified, required MCP, and one-sentence reason.

Routing: fast for exact <=2-file edits; standard for normal bounded work; deep for architecture/concurrency/migrations/security; parallel for 2+ independent workstreams; research for current external docs; ui-debug for browser evidence; review for an existing diff. Choose the lower tier when uncertain. Do not execute unless asked.
