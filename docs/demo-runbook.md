# Revealth v0.1 Demo Runbook

This runbook brings Revealth up as a governed local demo environment and verifies the full dry-run orchestration chain. It does not enable live Codex execution, create Git branches, create pull requests, or write real GitHub issues.

## Safety Defaults

- `CODEX_EXECUTION_MODE` must be `dry_run` for the executor smoke test.
- `GITHUB_ISSUE_CREATION_MODE` must remain `dry_run` unless a human explicitly approves real GitHub side effects.
- `.env` and `.revealth/` must never be committed.
- The executor may create metadata manifests only. It must not modify source files or mutate Git.

## One-Command Bootstrap

From the repository root:

```powershell
corepack pnpm demo:bootstrap
```

The script performs:

1. Creates `.env` from `.env.example` when `.env` does not exist.
2. Installs workspace dependencies.
3. Starts Docker Compose services.
4. Runs Prisma generate, deploy, and seed.
5. Checks API and executor health.

If `.env` already exists, confirm these values before the demo:

```powershell
Select-String -Path .env -Pattern "DATABASE_URL|CODEX_EXECUTION_MODE|GITHUB_ISSUE_CREATION_MODE|DEMO_WORKSPACE_ID"
```

Expected local database URL for host-run Prisma commands:

```text
DATABASE_URL=postgresql://revealth:revealth@127.0.0.1:5433/revealth?schema=public
```

## Service Health Checks

```powershell
docker compose ps
Invoke-RestMethod -Method GET -Uri http://localhost:4000/health
Invoke-RestMethod -Method GET -Uri http://localhost:4100/health
```

Expected API response shape:

```json
{
  "data": {
    "status": "ok"
  },
  "error": null
}
```

The Docker services should include:

- `postgres`
- `temporal`
- `temporal-ui`
- `api`
- `worker`
- `executor`

Temporal UI is available at:

```text
http://localhost:8080
```

The web app is available at:

```text
http://localhost:3000
```

## Demo Seed Workspace

The seed script creates a stable demo workspace:

```text
11111111-1111-4111-8111-111111111111
```

Open it in the dashboard:

```text
http://localhost:3000/workspaces/11111111-1111-4111-8111-111111111111/control-plane
```

## Full Smoke Test

Set dry-run execution mode, restart the API if needed, then run:

```powershell
corepack pnpm demo:smoke
```

The smoke test performs:

1. Create a new workspace.
2. Run intake workflow.
3. Approve `project_brief`.
4. Approve `sdlc_plan`.
5. Approve `task_batch`.
6. Generate and approve `github_issue_batch`.
7. Create dry-run GitHub issue records.
8. Generate and approve `codex_task_packet_batch`.
9. Generate and approve `git_execution_plan`.
10. Generate and approve `codex_execution_contract`.
11. Create a queued execution run.
12. Run the dry-run executor lifecycle.
13. Inspect the control-plane aggregation endpoint.

Expected final lines:

```text
Smoke test passed.
Workspace: <workspace-id>
Control plane: http://localhost:3000/workspaces/<workspace-id>/control-plane
```

## Manual Control-Plane Verification

After the smoke test, inspect the generated workspace:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-user-id" = "00000000-0000-4000-8000-000000000001"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/<workspace-id>/control-plane" `
  -Headers $headers
```

Confirm:

- Lineage includes `project_brief -> sdlc_plan -> task_batch -> github_issue_batch -> codex_task_packet_batch -> git_execution_plan -> codex_execution_contract -> execution_run`.
- Execution run status is `completed_dry_run`.
- GitHub issue records have `dryRun: true`.
- Executor status is reported.
- Audit events include approval, GitHub dry-run, and Codex dry-run actions.

## Troubleshooting

If health checks fail:

```powershell
docker compose logs api --tail=80
docker compose logs worker --tail=80
docker compose logs executor --tail=80
docker compose logs temporal --tail=80
```

If Prisma cannot connect from the host, confirm `DATABASE_URL` uses `127.0.0.1:5433`, not the Docker service hostname.

If the dry-run executor is blocked, confirm:

```powershell
Select-String -Path .env -Pattern "CODEX_EXECUTION_MODE"
docker compose up -d --build api
```

If the control plane reports a dirty repository, inspect without mutating Git:

```powershell
git status --short
Invoke-RestMethod -Method GET -Uri http://localhost:4100/executor/repo/status
```

Do not clean, reset, stash, branch, or commit automatically during a demo unless the human owner explicitly approves it.
