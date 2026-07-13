---
name: local-doc-rag
description: Retrieve small relevant excerpts from local project documentation using zero-API SQLite RAG before opening many docs; use for architecture, rules, state machines, and historical decisions.
---

Run ./scripts/rag-index.sh if missing/stale, then ./scripts/rag-query.sh "specific query". Use <=5 chunks and <=6000 chars. Open source docs only when excerpts are insufficient and only cited ranges. Treat docs as evidence, with source code taking precedence.
