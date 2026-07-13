# Budget-aware orchestrator flow

```text
User task
   |
   v
Root orchestrator (Terra / low)
   |
   +--> Intake check (root or Luna)
   |       +--> blocking ambiguity? ask one grouped question set
   |
   +--> C0-C3 / R0-R3 classification
   +--> select small / standard / complex context budget
   |
   +--> Search-first discovery
   |       +--> git diff/status
   |       +--> local repo map
   |       +--> targeted ripgrep
   |       +--> local docs RAG
   |
   +--> Plan only when dependencies justify it
   |
   +--> Work allocation
   |       +--> Luna: intake, mapping, deterministic work, affected tests
   |       +--> Terra: normal implementation and targeted validation
   |       +--> Sol: architecture, high-risk core, veto review, arbitration
   |
   +--> Diff-first independent validation
   |       +--> cosmetic: one validator
   |       +--> local logic: two validators
   |       +--> high risk: three validators
   |
   +--> repair affected slice only, maximum two rounds
   |
   v
Plain-language final result + context-budget report
```
