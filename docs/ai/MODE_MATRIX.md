# Codex mode matrix

| Signal | Mode | Main model | Child agents | Tools |
|---|---|---|---|---|
| automatic routing and budgets | orchestrator | Terra low | adaptive Luna/Terra/Sol | repo map + RAG, lazy MCP |
| exact edit, <=2 files | fast | Luna low | none | none |
| normal feature/bug | standard | Terra low | none | none |
| architecture/concurrency/migration | deep | Sol high | none | none |
| independent FE/BE/test slices | parallel | Terra low | Luna/Terra, Sol only if needed | none |
| version-specific facts | research | Terra low | docs researcher | Docs + Context7 |
| browser reproduction | ui-debug | Terra medium | browser/explorer/implementer | Playwright |
| existing diff | review | Terra low | validators/reviewer | none |

For normal work, leave `orchestrator` active. Start lower and escalate only after concrete uncertainty or risk.
