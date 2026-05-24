# Ready For Live Execution Workflow

This guide documents the manual developer steps needed before Revealth can mark a Codex execution run `ready_for_live_execution` and generate a governed `branch_preparation_plan`.

Revealth must not create branches, commit changes, modify files, execute Codex, or create pull requests in this flow. The human owner performs Git hygiene manually. Revealth only observes state, records approvals, and creates reviewable planning artifacts.

## Prerequisites

Set the API headers once:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-user-id" = "00000000-0000-4000-8000-000000000001"
}

$workspaceId = "<WORKSPACE_ID>"
$runId = "<CODEX_EXECUTION_RUN_ID>"
```

Use the existing verified workspace/run when testing the current local stack:

```powershell
$workspaceId = "adf86f51-9a00-4d1a-9657-d9e329b14600"
$runId = "f0b56529-187f-4ad4-b545-401b60ea15d9"
```

## 1. Commit Current Implementation Changes

Review the working tree:

```powershell
git status --short
git diff
git diff --staged
```

Confirm secrets and local runtime state are not staged:

```powershell
git diff -- .env
git status --short .env .revealth
```

Stage intentional source, schema, Docker, and docs changes only:

```powershell
git add .env.example .gitignore docker-compose.yml infra/docker apps packages docs pnpm-lock.yaml
git status --short
git diff --staged
```

Commit after review:

```powershell
git commit -m "chore: add governed executor readiness workflow"
```

Do not commit:

```text
.env
.env.*
.revealth/
node_modules/
credentials
tokens
private keys
local database dumps
```

## 2. Create A Safe Development Branch Manually

Create and switch to a human-controlled development branch:

```powershell
git switch -c codex/manual-readiness-validation
```

Verify the branch:

```powershell
git branch --show-current
git status --short
```

The branch must not be `main` or `master`.

## 3. Restart Executor So It Sees The New Branch

The executor reads the mounted repository. Restart it after switching branches:

```powershell
docker compose up -d executor
docker compose logs executor --tail=30
```

Confirm it is running:

```powershell
docker compose ps
Invoke-RestMethod -Method GET -Uri http://localhost:4100/health
```

## 4. Verify Repo Status Through Executor

Check the executor's repository view:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri http://localhost:4100/executor/repo/status |
  ConvertTo-Json -Depth 8
```

Expected readiness shape:

```text
currentBranch: codex/manual-readiness-validation
isClean: true
changedFiles: []
untrackedFiles: []
stagedFiles: []
warning: null
recommendedNextAction: ready_for_preflight
```

You can also verify through the API proxy:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/executor/repo-status" `
  -Headers $headers |
  ConvertTo-Json -Depth 8
```

Stop here if:

```text
isClean: false
currentBranch: main
currentBranch: master
recommendedNextAction: review_and_commit_or_stash_changes
```

## 5. Run Preflight

Run preflight through the API:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/execution-runs/$runId/preflight" `
  -Headers $headers `
  -Body '{}' |
  ConvertTo-Json -Depth 10
```

Expected:

```text
passed: true
blockers: []
nextAllowedAction: start_dry_run
```

Stop here if preflight returns blockers.

## 6. Mark Run Ready

Mark the run ready only after repo status and preflight are clean:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/execution-runs/$runId/mark-ready" `
  -Headers $headers `
  -Body '{}' |
  ConvertTo-Json -Depth 10
```

Expected:

```text
readiness.passed: true
data.status: ready_for_live_execution
readiness.nextAllowedAction: wait_for_live_execution_implementation
readiness.liveExecutionImplemented: false
```

Inspect the run:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/execution-runs/$runId/inspection" `
  -Headers $headers |
  ConvertTo-Json -Depth 10
```

Expected:

```text
readiness.isReadyForFutureLiveExecution: true
readiness.liveExecutionImplemented: false
sideEffects.filesModified: false
sideEffects.branchCreated: false
sideEffects.pullRequestCreated: false
```

## 7. Generate Branch Preparation Plan

Generate the governed branch planning artifact:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/execution-runs/$runId/branch-preparation-plans" `
  -Headers $headers `
  -Body '{}' |
  ConvertTo-Json -Depth 10
```

Expected:

```text
artifactType: branch_preparation_plan
status: pending_approval
contentJson.branchCreationAllowed: false
contentJson.codeExecutionAllowed: false
contentJson.pullRequestCreationAllowed: false
```

List plans:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/branch-preparation-plans" `
  -Headers $headers |
  ConvertTo-Json -Depth 10
```

Save the returned artifact id and approval id for the approval step.

## 8. Approve Branch Preparation Plan

Get pending approvals:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/$workspaceId/approvals" `
  -Headers $headers |
  ConvertTo-Json -Depth 10
```

Find the approval where:

```text
artifactId = <BRANCH_PREPARATION_PLAN_ARTIFACT_ID>
status = pending
```

Approve it:

```powershell
$branchPreparationApprovalId = "<BRANCH_PREPARATION_PLAN_APPROVAL_ID>"

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:4000/workspaces/$workspaceId/approvals/$branchPreparationApprovalId/approve" `
  -Headers $headers `
  -Body '{ "decisionNotes": "Approved branch preparation plan. Branch creation remains disabled until live execution is implemented and separately approved." }' |
  ConvertTo-Json -Depth 10
```

Verify the artifact is approved:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/$workspaceId/codex/branch-preparation-plans" `
  -Headers $headers |
  ConvertTo-Json -Depth 10
```

Expected:

```text
artifactType: branch_preparation_plan
status: approved
branchCreationAllowed: false
codeExecutionAllowed: false
pullRequestCreationAllowed: false
```

## Safety Boundary

This workflow does not authorize live execution.

Even after approval:

- no branch is created by Revealth
- no files are modified by Revealth
- no shell command preview is executed
- no Codex execution starts
- no pull request is opened

The approved `branch_preparation_plan` only makes the future branch creation step explicit, reviewable, and auditable.
