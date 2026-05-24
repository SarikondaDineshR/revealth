# Live Execution Environment Strategy

Revealth must not let the API container directly modify the repository. The API is the governance plane: approvals, contracts, audit, lineage, and state transitions. Live code execution belongs in a separate execution plane with stricter isolation.

## Options Compared

### 1. API Container Executes Directly

The API container would run Git commands, invoke Codex, modify files, run tests, and potentially open PRs.

Benefits:

- Lowest implementation complexity.
- No extra service or job handoff.
- Direct access to run state and database.

Risks:

- Mixes governance and mutation in one process.
- Exposes API runtime secrets to code execution.
- Makes command allowlisting and filesystem isolation harder.
- A compromised execution path could affect the API service.
- Difficult to reason about cleanup, timeouts, and process isolation.
- Poor fit for future multi-tenant operation.

Verdict: Not recommended. Useful only for throwaway local experiments, not Revealth v0.1.

### 2. Separate Executor Container With Mounted Repo

A dedicated executor service receives approved execution jobs, prepares an isolated workspace under `.revealth/execution-runs/<runId>/`, creates a branch in that workspace, applies future Codex changes, runs allowed commands, captures logs and diffs, then reports back to the API.

Benefits:

- Separates governance plane from execution plane.
- Can run with reduced environment variables and no API secrets.
- Easier to enforce allowlisted commands and path boundaries.
- Can impose CPU, memory, network, and timeout limits.
- Can be rebuilt or destroyed independently.
- Works locally and in Codespaces with Docker Compose.

Risks:

- Requires job handoff and status synchronization.
- Mounted repo must be handled carefully to avoid accidental mutation of `main`.
- Needs explicit cleanup policy.
- Still requires careful secret hygiene if GitHub operations are eventually enabled.

Verdict: Recommended for v0.1 dry-run and first controlled live prototype.

### 3. GitHub Codespaces or GitHub Actions Executor

Revealth schedules execution in a cloud GitHub environment, using ephemeral Codespaces or Actions runners to clone the repo, create branches, run Codex, run tests, and produce PR artifacts.

Benefits:

- Stronger isolation from the API host.
- Native GitHub authentication and branch/PR workflows.
- Ephemeral runners reduce residue.
- Good fit for cloud-native operation.
- Easier to scale later.

Risks:

- More operational complexity.
- Harder local developer loop.
- Requires GitHub App or token design before live use.
- GitHub Actions logs and artifacts require careful secret redaction.
- Codespaces automation APIs add product and permissions complexity.

Verdict: Best long-term direction, but too much operational surface for the next v0.1 implementation step.

## Recommendation

Use a separate executor container with an isolated execution workspace for v0.1.

The API remains the system of record and approval authority. The executor is a narrow worker that can only act on an approved `codex_execution_run` with an approved `codex_execution_contract`. In early implementation, the executor should support preflight and dry-run only. Live execution remains blocked until branch creation, Codex invocation, diff capture, test execution, and PR creation each have explicit gates.

## Executor Responsibilities

The executor service should eventually:

- Pull a queued `codex_execution_run`.
- Load the approved execution contract.
- Prepare `.revealth/execution-runs/<runId>/`.
- Clone the repository or prepare an isolated mounted workspace.
- Create a branch only after a branch-creation approval gate.
- Apply Codex-generated changes later, after live execution is explicitly enabled.
- Enforce allowed files and forbidden files before and after changes.
- Run only allowed commands.
- Enforce forbidden command blocking.
- Run required tests.
- Capture stdout, stderr, exit codes, timestamps, and duration.
- Collect a structured diff artifact.
- Mark run status transitions.
- Open a PR only after separate human approval.
- Clean up execution workspace after terminal states.

## Security Boundaries

The executor must run with the smallest possible authority.

- No application database write credentials unless mediated through API endpoints or a narrow service token.
- No model provider keys in general environment unless the specific run requires them.
- No production secrets.
- No `.env` reads.
- No access to billing, deployment, sales, or customer-facing credentials.
- Allowed files must be repository-relative.
- Absolute paths are rejected.
- Path traversal is rejected.
- Forbidden file globs are enforced before and after execution.
- Commands must match an allowlist exactly or through approved templates.
- Forbidden commands are checked before execution.
- Shell metacharacters require explicit policy before support.
- Network access should default to disabled for live execution unless approved.
- Each command must have a timeout.
- Total run duration must have a timeout.
- Logs must be captured and redacted before persistence.
- Workspace cleanup must run for completed, failed, and cancelled runs.

## Architecture Changes Needed

### Executor Service

Add `apps/executor` as a dedicated Node.js service.

Initial responsibilities:

- Poll or receive execution jobs.
- Run preflight in an isolated runtime.
- Write execution workspace manifests.
- Report status and logs back to the API.

Future responsibilities:

- Create branches.
- Invoke Codex.
- Apply patches.
- Run tests.
- Produce diff artifacts.
- Request PR approval.

### Job Queue

v0.1 can use Temporal for durable orchestration:

- `CodexExecutionWorkflow`
- Activities:
  - `preflightExecutionRun`
  - `prepareExecutionWorkspace`
  - `validateExecutionContract`
  - `collectExecutionManifest`
  - future `runAllowedCommand`
  - future `collectDiffArtifact`

Temporal is preferable to a database polling loop because Revealth already uses Temporal and execution needs durable status transitions.

### Execution Workspace

Use:

```text
.revealth/
  execution-runs/
    <runId>/
      manifest.json
      logs/
      diff/
      workspace/
```

In dry-run:

- Create only `manifest.json`.
- Do not clone.
- Do not copy repo.
- Do not create branch.

In future live mode:

- Use `workspace/` as the mutable checkout.
- Keep the main repo untouched.
- Produce `diff/summary.json` and patch artifacts.

### Run Status Updates

Current statuses:

- `queued`
- `running`
- `completed_dry_run`
- `failed`
- `cancelled`

Future statuses should be added only when needed:

- `preflight_passed`
- `awaiting_branch_approval`
- `awaiting_pr_approval`
- `completed_with_pr_draft`

### Audit Events

Add or continue using events such as:

- `codex.execution_run.preflight.started`
- `codex.execution_run.preflight.passed`
- `codex.execution_run.preflight.failed`
- `codex.execution_workspace.prepared`
- `codex.execution_workspace.cleaned`
- future `codex.execution_branch.created`
- future `codex.execution_command.started`
- future `codex.execution_command.completed`
- future `codex.execution_diff.created`
- future `codex.execution_pr.drafted`

### Artifact Diffs

Future live execution should produce a new artifact type:

```text
codex_execution_diff
```

It should include:

- run ID
- contract artifact ID
- branch name
- changed files
- diff summary
- test results
- risk notes
- rollback notes
- PR draft metadata
- approval requirement

## Recommended Next Implementation Step

Implement `apps/executor` as a separate dry-run/preflight-only service.

Scope:

- Add executor package and Docker service.
- Give it no production secrets.
- Connect it to Temporal or a narrow API job endpoint.
- Move preflight execution from API-process-local logic into the executor service.
- Keep API as the owner of approvals, audit logs, and run state.
- Keep live execution blocked.

Acceptance criteria:

- API can enqueue or start an executor preflight job.
- Executor creates only `.revealth/execution-runs/<runId>/manifest.json`.
- Executor reports structured preflight results to API.
- API persists logs and audit events.
- No source files are modified.
- No branch is created.
- No PR is created.
- Live mode still returns `CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED`.
