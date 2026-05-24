# Execution Readiness Gate

Revealth separates a queued Codex execution run from a run that is safe enough for future live execution. The readiness gate is still not live execution. It only records that all current safety checks passed.

## Endpoint

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-user-id" = "00000000-0000-4000-8000-000000000001"
}

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/mark-ready" `
  -Headers $headers `
  -Body '{}'
```

## Required Checks

The API marks a run `ready_for_live_execution` only when:

- the run is still `queued`
- the `codex_execution_contract` artifact is approved
- approved contract approval exists
- contract schema is valid
- preflight passes
- executor worktree is clean
- executor is not on `main` or `master`
- forbidden file rules exist
- required tests are present
- `CODEX_EXECUTION_MODE` is not `disabled`
- `CODEX_EXECUTION_MODE=live` is still blocked because live execution is not implemented

## Failure Behavior

If any check fails:

- the run status is unchanged
- blockers are returned
- `codex.execution_run.mark_ready.failed` is written to audit logs
- no files are modified
- no branch is created
- no pull request is created
- Codex is not called

Example failure while the repository is dirty:

```text
readiness.passed: false
readiness.blockers:
  CODEX_GIT_WORKTREE_DIRTY
  CODEX_EXECUTOR_WORKTREE_NOT_CLEAN
  CODEX_PREFLIGHT_NOT_PASSED
```

## Success Behavior

If all checks pass:

- run status becomes `ready_for_live_execution`
- `codex.execution_run.ready_for_live_execution` is written to audit logs
- inspection reports readiness state
- next allowed action remains waiting for live execution implementation

The status means:

```text
safe enough to execute later, after live execution is implemented and separately approved
```

It does not mean:

```text
execute now
```

## Inspection

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/inspection" `
  -Headers $headers
```

Inspection includes:

- current status
- contract snapshot
- execution logs
- audit event summary
- side effect flags
- readiness state

## Clean-State Flow

1. Check executor repo status:

   ```powershell
   Invoke-RestMethod -Method GET -Uri http://localhost:4100/executor/repo/status
   ```

2. Resolve dirty worktree state manually:

   ```bash
   git status --short
   git diff
   git add <safe-files>
   git commit -m "..."
   ```

3. Ensure future execution is not on `main` or `master`.

4. Run preflight.

5. Run mark-ready.

Live execution remains intentionally unimplemented.
