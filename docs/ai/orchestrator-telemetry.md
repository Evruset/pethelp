# ORCH-MOE-03 telemetry capability matrix

Observed environment: Codex CLI `0.145.0`, 2026-09-16. Official source:
[OpenAI Codex observability and telemetry documentation](https://learn.chatgpt.com/docs/config-file/config-advanced#observability-and-telemetry).

| Capability | Status | Supported source / method |
|---|---|---|
| Run/thread ID | VERIFIED_SUPPORTED | `codex exec --json` → `thread.started.thread_id`; observed locally |
| Planned model | VERIFIED_SUPPORTED | Router decision / explicit CLI `--model`; not an observation |
| Observed model | VERIFIED_SUPPORTED via OTel; NOT_OBSERVED locally | Official OTel default `model` metadata; user OTel is not configured and JSONL pilot did not emit it |
| Input/output/cached/reasoning tokens | VERIFIED_SUPPORTED | JSONL `turn.completed.usage`; official OTel `response.completed`/`turn.token_usage`; observed locally |
| Cache-write input tokens | VERIFIED_SUPPORTED locally | JSONL `turn.completed.usage.cache_write_input_tokens` |
| Routing decision time | VERIFIED_SUPPORTED | Wrapper monotonic clock around `route()`; milliseconds |
| Full execution wall time | VERIFIED_SUPPORTED | Wrapper monotonic clock around `codex exec`; milliseconds |
| Tool calls | VERIFIED_SUPPORTED | Deduplicated JSONL tool item IDs; official OTel `codex.tool.call` |
| Tool duration | VERIFIED_SUPPORTED via OTel; NOT_OBSERVED locally | Official `codex.tool.call.duration_ms`; JSONL pilot did not provide duration |
| Agent invocations | NOT_VERIFIED | No stable field observed in JSONL and no specific official per-agent invocation field established |
| Repair cycles | UNSUPPORTED as native runtime metric | Orchestrator-owned semantic state; must remain NOT_OBSERVED until explicit lifecycle events are emitted |
| Per-phase model duration | NOT_VERIFIED | API/stream and turn duration are supported; arbitrary orchestrator phase attribution is not |
| `runtime_metrics` feature | NOT_VERIFIED / unstable | Local CLI marks it under development and disabled; not used |

OTel configuration is user-level only; project `.codex/config.toml` cannot set
telemetry routing. No OTel config was added or changed. Prompts remain redacted
by default in official OTel configuration and this envelope never stores raw
events, prompts, responses, commands, credentials, authorization tokens, or
user-file contents.

## Pilot evidence

- Pilot 1: ephemeral/read-only isolated directory, exit `0`, four JSONL events.
  Run ID and all documented usage key shapes were observed; raw values were not
  retained by the privacy-preserving capability probe.
- Pilot 2: ephemeral/read-only isolated directory, exit `0`, execution wall
  `14,543.675 ms`, seven JSONL events, one unique `command_execution` tool call.
- Both raw JSONL files and temporary directories were deleted immediately.
- Planned model was `gpt-5.6-luna`; observed model is `NOT_OBSERVED` because the
  JSONL stream did not expose it and local OTel was not configured.

No more pilots are permitted for ORCH-MOE-03. Token values for these two probes
are `NOT_OBSERVED` because the capability probe retained field presence, not
raw values; they must not be reconstructed or estimated.
