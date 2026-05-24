# Revealth

Revealth is an autonomous AI software company operating system.

Revealth v0.1 focuses on governed software planning and SDLC orchestration. It turns a founder's product idea into durable workflow runs, structured artifacts, explicit approvals, audit events, dry-run GitHub issue records, Codex task packets, Git execution plans, execution contracts, and dry-run execution tracking.

v0.1 is intentionally safety-first. It does not perform live code execution, create branches, open pull requests, deploy software, bill customers, or run autonomous customer-facing automation.

## Architecture Overview

Revealth is a TypeScript monorepo with a governance plane, workflow plane, execution-preparation plane, and operator UI.

```text
apps/web       Next.js control plane dashboard
apps/api       Fastify API, approvals, artifacts, audit, orchestration APIs
apps/workers   Temporal workers for governed SDLC workflows
apps/executor  Isolated dry-run/preflight executor service
packages/contracts  Shared Zod schemas and TypeScript contracts
packages/database   Prisma schema, migrations, seed data, Prisma client
```

Core infrastructure:

```text
PostgreSQL + pgvector
Temporal + Temporal UI
Fastify API
Temporal worker
Executor service
Next.js web app
Docker Compose
```

Primary governed chain:

```text
idea
  -> project_brief
  -> sdlc_plan
  -> task_batch
  -> github_issue_batch
  -> codex_task_packet_batch
  -> git_execution_plan
  -> codex_execution_contract
  -> codex_execution_run
```

Each transition is approval-gated, lineage-aware, and audit logged.

## Demo Bootstrap

Prerequisites:

- Node.js 20+
- Corepack
- pnpm via Corepack
- Docker Desktop or GitHub Codespaces with Docker Compose

From the repository root:

```powershell
corepack pnpm install
corepack pnpm demo:bootstrap
```

The bootstrap script starts Docker services, runs Prisma generate/deploy/seed, and checks API/executor health.

Run the full v0.1 dry-run smoke test:

```powershell
corepack pnpm demo:smoke
```

The smoke test creates a workspace, runs intake, approves the governed chain, creates dry-run GitHub issue records, generates Codex planning artifacts, creates a queued execution run, performs a dry-run executor lifecycle, and verifies the control-plane aggregation endpoint.

## Control Plane

After bootstrap, open:

```text
http://localhost:3000/workspaces
```

Seeded demo workspace:

```text
http://localhost:3000/workspaces/11111111-1111-4111-8111-111111111111/control-plane
```

The control plane shows:

- workflow runs
- artifacts
- approvals
- execution runs
- branch preparation plans
- audit timeline
- lineage visualization
- executor health
- Temporal workflow status
- readiness indicators

## Safety Model

Revealth v0.1 is built around explicit human governance:

- No production deployment without human approval.
- No code changes without governed issue/task context.
- No task without acceptance criteria.
- No agent action without audit logging.
- No customer-facing automation in early versions.
- No live execution unless explicitly enabled in a future version.
- Dry-run modes are the default for external side effects.
- Execution contracts define allowed files, forbidden files, commands, tests, rollback notes, and secret-handling rules before any future execution.

Important local defaults:

```text
GITHUB_ISSUE_CREATION_MODE=dry_run
CODEX_EXECUTION_MODE=disabled
```

For the dry-run executor demo, set:

```text
CODEX_EXECUTION_MODE=dry_run
```

Do not commit `.env` or `.revealth/`.

## Intentionally Not Implemented in v0.1

The following are deliberately blocked or not implemented:

- live Codex execution
- repository file mutation by agents
- automatic Git branch creation
- automatic pull request creation
- production deployment
- live GitHub issue creation without approved configuration
- autonomous billing or sales workflows
- customer-facing automation
- unsupervised execution beyond dry-run/preflight states

## Useful Commands

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
docker compose ps
Invoke-RestMethod -Method GET -Uri http://localhost:4000/health
Invoke-RestMethod -Method GET -Uri http://localhost:4100/health
```

More detailed runbooks:

- [Demo runbook](docs/demo-runbook.md)
- [Codespaces bootstrap](docs/codespaces-bootstrap.md)
- [Architecture consolidation review](docs/architecture-consolidation-review.md)
- [System state machine](docs/system-state-machine.md)
- [Execution readiness gate](docs/execution-readiness-gate.md)
- [Executor service](docs/executor-service.md)
