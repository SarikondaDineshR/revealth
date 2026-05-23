# Revealth v0.1 Local Bootstrap

## Prerequisites

- Node.js 20 or newer
- Docker Desktop
- Corepack

This repository pins pnpm through `packageManager`. On machines where the global pnpm shim is unavailable, use `corepack pnpm`.

## Exact Bootstrap Commands

From the repository root:

```powershell
Copy-Item .env.example .env
corepack pnpm install
docker compose up -d postgres temporal temporal-ui
corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm db:seed
```

The root `.env` is loaded automatically by all database scripts, even when pnpm executes them from `packages/database`. Host-run Prisma commands use `127.0.0.1:5433`, while Docker-internal API and worker containers override `DATABASE_URL` to `postgres:5432`.

## Exact Order To Run Services

Terminal 1:

```powershell
docker compose up -d postgres temporal temporal-ui
```

Terminal 2:

```powershell
corepack pnpm --filter @revealth/api dev
```

Terminal 3:

```powershell
corepack pnpm --filter @revealth/workers dev
```

Terminal 4:

```powershell
corepack pnpm --filter @revealth/web dev
```

Service URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Temporal UI: `http://localhost:8080`
- PostgreSQL for host-run Prisma commands: `127.0.0.1:5433`

## Verification Commands

```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

## Exact First API Request

Health check:

```powershell
Invoke-RestMethod -Method GET -Uri http://localhost:4000/health
```

Expected successful response:

```json
{
  "data": {
    "status": "ok",
    "service": "revealth-api",
    "timestamp": "2026-05-22T00:00:00.000Z"
  },
  "error": null,
  "requestId": "generated-request-id"
}
```

First database-backed request:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri http://localhost:4000/workspaces `
  -Headers @{ "Content-Type" = "application/json"; "x-user-id" = "00000000-0000-4000-8000-000000000001" } `
  -Body '{ "name": "Revealth Internal Prototype" }'
```

Expected successful response shape:

```json
{
  "data": {
    "id": "workspace-uuid",
    "ownerId": "00000000-0000-4000-8000-000000000001",
    "name": "Revealth Internal Prototype",
    "status": "active",
    "createdAt": "2026-05-22T00:00:00.000Z",
    "updatedAt": "2026-05-22T00:00:00.000Z"
  },
  "error": null,
  "requestId": "generated-request-id"
}
```

## First End-To-End Workflow Request

After API, worker, database, and Temporal are running:

```powershell
$workspace = Invoke-RestMethod `
  -Method POST `
  -Uri http://localhost:4000/workspaces `
  -Headers @{ "Content-Type" = "application/json"; "x-user-id" = "00000000-0000-4000-8000-000000000001" } `
  -Body '{ "name": "Revealth Intake Test" }'

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/$($workspace.data.id)/workflows/intake" `
  -Headers @{ "Content-Type" = "application/json"; "x-user-id" = "00000000-0000-4000-8000-000000000001" } `
  -Body '{ "rawProjectIdea": "Build Revealth v0.1 as an autonomous AI software company operating system focused only on planning, SDLC orchestration, task generation, audit logging, and approval workflows." }'
```

Expected outcome:

- API returns a queued workflow run.
- Worker creates a draft `project_brief` artifact.
- Worker creates a pending approval.
- Audit events are visible at `/workspaces/:workspaceId/audit-events`.
- Temporal UI shows the completed `intakeWorkflow` waiting through persisted application state.
