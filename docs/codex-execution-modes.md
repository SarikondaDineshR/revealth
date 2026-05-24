# Codex Execution Modes

Revealth uses `CODEX_EXECUTION_MODE` to keep coding execution explicitly gated.

## `disabled`

Default mode. Starting a Codex execution run returns `CODEX_EXECUTION_DISABLED`.

- No repository files are modified.
- No branches are created.
- No pull requests are created.
- The run remains `queued`.
- Audit events record the blocked start attempt.

## `dry_run`

Validation-only mode for approved execution contracts.

- Requires a queued execution run created from an approved `codex_execution_contract`.
- Validates allowed files, forbidden files, allowed commands, and forbidden commands.
- Rejects absolute paths, path traversal, forbidden file matches, forbidden command matches, and file entries outside allowed directories.
- Creates metadata only at `.revealth/execution-runs/<RUN_ID>/manifest.json`.
- Transitions `queued -> running -> completed_dry_run`.
- Stores execution logs on the run.
- Stores the execution workspace manifest path on the run.
- Writes audit events for validation, dry-run start, and dry-run completion.
- Does not run shell commands.
- Does not call Codex.
- Does not modify files, create branches, create commits, or open pull requests.

## `live`

Reserved for a future explicit enablement path. The current adapter blocks live execution with
`CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED`.

Live execution must not be enabled until Revealth has separate approval gates for branch creation,
command execution, pull request creation, test evidence, and rollback review.

## Local Verification

Disabled mode:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/start" `
  -Headers $headers `
  -Body '{}'
```

Expected: `CODEX_EXECUTION_DISABLED`, with the run still `queued`.

Dry-run mode:

```powershell
# Set CODEX_EXECUTION_MODE=dry_run in .env, then restart the API.
docker compose build api
docker compose up -d api

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/start" `
  -Headers $headers `
  -Body '{}'

Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/inspection" `
  -Headers $headers
```

Expected: `completed_dry_run`, execution logs present, audit summary present, and side-effect
flags all `false`.

Cleanup:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/cleanup" `
  -Headers $headers `
  -Body '{}'
```

Cleanup is allowed only for `completed_dry_run`, `failed`, and `cancelled` runs. It removes only the
`.revealth/execution-runs/<RUN_ID>/` metadata directory and clears the stored manifest path.

## Live Preflight

Preflight is the final safety checkpoint before any future live repository modification path.

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/preflight" `
  -Headers $headers `
  -Body '{}'
```

The report includes:

- `passed`
- `checks[]`
- `blockers[]`
- `warnings[]`
- `nextAllowedAction`

Preflight verifies the queued run, approved contract, execution mode, git state, required tools,
required tests, allowed paths, forbidden paths, allowed commands, forbidden command enforcement,
manifest creation, and audit logging.

`CODEX_EXECUTION_MODE=live` still returns a blocker:

```text
CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED
```

Preflight may create or refresh only the execution metadata manifest. It must not create branches,
modify source files, call Codex, create commits, or open pull requests.
