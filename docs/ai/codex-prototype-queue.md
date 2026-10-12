# VetHelp — Codex prototype queue (opt-in)

This is a minimal GitHub Issues → Codex → draft PR channel. It is **not active until this workflow is merged into the default branch and an API credential is configured**.

## One-time owner setup

1. Review and merge the setup PR. No product W4B branches are merged with it.
2. Add the `OPENAI_API_KEY` secret at GitHub repository **Settings → Secrets and variables → Actions**. Use a limited-budget API project/key. Do not paste a key into an issue, ChatGPT or any committed file. **GitHub-hosted Codex API usage is separately billed; a ChatGPT subscription is not the GitHub Action credential.**
3. In **Settings → Actions → General**, authorize GitHub Actions to create pull requests if currently disabled. Review workflow permissions.
4. A maintainer starts **one** task by adding the `codex-ready` label to a reviewed, bounded GitHub Issue. Only people with triage/write permission can apply the label; an arbitrary public issue does not start the runner.

## Execution

- On a reviewed issue's `codex-ready` label event, GitHub Actions checks out **main**, reads the issue, executes the official `openai/codex-action@v1` with `:workspace` permissions and sudo dropped, and allows only Owner/Clinic/static-prototype changes.
- The Codex step has no stored git credentials; GitHub token is used only in separate issue-input and PR-publishing steps.
- A successful change becomes a **draft pull request** against main. Nothing merges or deploys automatically.
- If the issue needs backend, credentials, medical-data handling or a product decision, the agent is instructed to stop; the run may require operator inspection of Actions logs.
- The workflow has a 45-minute timeout and serial concurrency. Costs still depend on API usage and runner pricing.
- The issue task is public in this public repository. Never put private medical documents, customer data, tokens or trade secrets in it.
- The workflow runner starts from main; it cannot see unmerged v1.5 branches. Integrating those branches is a separate reviewed operation.

## Operating model

The project lead may create small GitHub Issues with a concrete user flow and acceptance criteria and label them `codex-ready` using the connected GitHub integration. Each trigger executes one task and returns a draft PR for review.

This setup does **not** automatically wake a ChatGPT conversation or enable indefinite autonomous orchestration. For unattended review/next-task selection use a separately configured ChatGPT scheduled task or Work workflow once the queue is operational. Do not automatically chain issue labels before budget/security and review policy are agreed.

Prefer product validation: clinic selection → service → availability → booking → confirmation, and the clinic's accept/decline workflow. Basic access controls remain mandatory. No speculative OCR hardening or new governance Waves.

## Troubleshooting

- Secret missing: workflow fails closed before Codex and incurs no Codex API execution.
- `gh pr create` forbidden: enable GitHub Actions PR creation in repo Actions settings.
- No source changes, out-of-scope changes or failed tests: workflow does not create a PR; inspect the run. Do not claim acceptance.
- Rerun the issue deliberately by removing then adding `codex-ready` after understanding the failure. The queue is not a watchdog.

Last scoped engineering checkpoint remains W4B-03A-03 isolated acceptance at `23653ebb69690171d27b7fdbbe9646a914b3c435`. This automation branch is from `main` and does not modify the accepted checkpoint or the original local 674 dirty entries.