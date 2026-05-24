# Executor Service

`apps/executor` is Revealth's execution-plane boundary. It performs dry-run/preflight checks against a repository workspace without allowing the API container to inspect Git state or modify the repository directly.

## Scope

The executor currently supports only:

```text
POST /executor/runs/:runId/preflight
```

It does not:

- modify source files
- create branches
- create commits
- call Codex
- open pull requests
- run arbitrary task commands

## Responsibilities

The executor validates:

- `git` exists
- `node` exists
- `pnpm` exists
- repository workspace is available
- current branch is readable
- working tree cleanliness is readable
- required tests are defined
- allowed files are repository-relative and safe
- forbidden files are enforced
- allowed commands are nonempty
- forbidden commands are enforced

It creates only:

```text
.revealth/execution-runs/<runId>/manifest.json
```

## Docker Compose

The executor is mounted with the repository at `/workspace`:

```yaml
executor:
  environment:
    EXECUTOR_REPOSITORY_PATH: /workspace
  volumes:
    - .:/workspace
```

The API calls it through:

```text
EXECUTOR_URL=http://executor:4100
```

Local host access is available at:

```text
http://localhost:4100/health
```

## Expected Preflight Behavior

In an uncommitted development tree, preflight should fail with:

```text
CODEX_GIT_WORKTREE_DIRTY
```

That is intentional. Live execution must never start from a dirty repository. The executor can still create the manifest metadata needed for audit and inspection.

`CODEX_EXECUTION_MODE=live` still produces:

```text
CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED
```

Live execution remains blocked.
