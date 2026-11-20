---
name: mode-router
description: Choose the cheapest sufficient Codex mode and model for a development task; use when asked to route, estimate, or select quality level.
---

Use [the adaptive-orchestrator routing policy](../adaptive-orchestrator/references/routing.md) for C/R, model and reasoning effort, runtime availability, and justified delegation. Report the suggested mode, verified model/effort, needed specialists and MCP, and a short reason. Label the current root separately when its client-confirmed settings differ from the proposal.

Routing: fast for exact <=2-file edits; standard for normal bounded work; deep for architecture/concurrency/migrations/security; parallel for 2+ independent workstreams; research for current external docs; ui-debug for browser evidence; review for an existing diff. Choose the smallest route that covers the classified risk. Do not execute unless asked.
