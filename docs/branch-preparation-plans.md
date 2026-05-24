# Branch Preparation Plans

`branch_preparation_plan` is the governed planning artifact before any future Git branch mutation. It is intentionally inert: it previews commands and constraints, then requires human approval.

## Generate

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-user-id" = "00000000-0000-4000-8000-000000000001"
}

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/execution-runs/<RUN_ID>/branch-preparation-plans" `
  -Headers $headers `
  -Body '{}'
```

## Inspect

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/branch-preparation-plans" `
  -Headers $headers
```

## Required State

Generation requires:

- execution run status is `ready_for_live_execution`
- source `codex_execution_contract` artifact is approved
- approved contract approval exists
- executor repository status is clean
- executor current branch is not `main` or `master`

## Artifact Contents

The generated artifact includes:

- source run id
- source contract id
- recommended branch name
- base branch
- branch creation command preview
- rollback command preview
- protected branch warning
- allowed files summary
- required tests summary
- approval requirements

## Safety Rules

This step does not:

- create branches
- modify files
- execute Codex
- run shell commands
- create pull requests

The command fields are previews for human review and future governed execution only. Approval of this artifact does not authorize live code execution by itself.
