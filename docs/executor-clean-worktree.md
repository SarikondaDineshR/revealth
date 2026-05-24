# Executor Clean Worktree Readiness

Revealth separates the governance plane from the execution plane. The API decides whether a governed action is allowed. The executor reports whether the repository is clean enough for future execution. It does not create branches, commits, pull requests, or mutate Git state.

## Readiness Endpoints

Executor direct:

```bash
curl http://localhost:4100/executor/repo/status
```

API proxy:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-user-id" = "00000000-0000-4000-8000-000000000001"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "http://localhost:4000/workspaces/<WORKSPACE_ID>/codex/executor/repo-status" `
  -Headers $headers
```

The response includes:

- current branch
- clean or dirty state
- changed files
- untracked files
- staged files
- warning when the executor is on `main` or `master`
- recommended next action

## Check Git Status Manually

```bash
git branch --show-current
git status --short
git status --porcelain=v1
```

Use `git status --short` for humans. Use `git status --porcelain=v1` when comparing against the executor output.

## Commit Safe Changes

Review every changed file before staging:

```bash
git status --short
git diff
git diff --staged
```

Stage only intentional source, schema, configuration, and documentation changes:

```bash
git add apps/executor packages/contracts apps/api docs infra docker-compose.yml .env.example
git status --short
git commit -m "chore: add executor repository status readiness"
```

Never use `git add .` unless you have already reviewed the full status output and confirmed no secrets, local state, or generated runtime artifacts are included.

## Stash Temporary Changes

Use stash when a change is useful locally but should not be committed yet:

```bash
git status --short
git stash push -m "temporary local executor validation notes"
git status --short
```

Include untracked files only when you have verified they are safe to store in Git's stash:

```bash
git stash push --include-untracked -m "temporary local files"
```

Restore later with:

```bash
git stash list
git stash pop
```

## Clean Generated Artifacts

Remove generated execution metadata only when it is no longer needed for inspection:

```bash
rm -rf .revealth/execution-runs/<RUN_ID>
```

On Windows PowerShell:

```powershell
Remove-Item -LiteralPath ".revealth/execution-runs/<RUN_ID>" -Recurse -Force
```

Before deleting anything recursively, verify the exact path:

```bash
pwd
ls .revealth/execution-runs
```

## Never Commit Local Runtime State

Never commit:

- `.env`
- `.env.*`
- `.revealth/`
- `node_modules/`
- local logs
- local Docker volumes or database dumps
- credentials, tokens, private keys, or provider secrets

Safe environment documentation belongs in `.env.example`. Real values belong only in local environment files or secret managers.

## Recommended Human Flow

1. Inspect executor readiness:

   ```bash
   curl http://localhost:4100/executor/repo/status
   ```

2. If dirty, inspect Git:

   ```bash
   git status --short
   git diff
   ```

3. Commit safe intentional changes or stash temporary work.

4. Re-run readiness.

5. Continue to governed preflight only when the response is clean and not on a protected base branch.

Live execution remains unimplemented. Clean worktree readiness is only an observation layer for future execution safety.
