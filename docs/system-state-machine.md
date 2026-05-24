# Revealth v0.1 System State Machine

This document defines the current v0.1 state machines for artifacts, approvals, execution runs, and workflow runs. It is descriptive of the current implementation and should be treated as the stabilization reference before live execution work begins.

## Artifact State Machine

States:

- `draft`
- `pending_approval`
- `approved`
- `rejected`
- `superseded`

```mermaid
stateDiagram-v2
  [*] --> draft: artifact created
  draft --> pending_approval: approval created
  pending_approval --> approved: human approves
  pending_approval --> rejected: human rejects
  pending_approval --> draft: revision requested
  approved --> superseded: newer approved version or manual supersede
  rejected --> draft: regenerated replacement
  superseded --> [*]
```

Current notes:

- Most governed generators create `draft`, create an approval, then update to `pending_approval`.
- Approval decisions are executed through `ApprovalService`.
- Downstream workflow chaining happens only after selected artifact types become `approved`.
- `superseded` exists in contracts but is not consistently automated.

## Approval State Machine

States:

- `pending`
- `approved`
- `rejected`
- `revision_requested`
- `expired`
- `superseded`

```mermaid
stateDiagram-v2
  [*] --> pending: approval created
  pending --> approved: approve
  pending --> rejected: reject
  pending --> revision_requested: request revision
  pending --> expired: expiry policy
  pending --> superseded: replaced by newer artifact approval
  approved --> [*]
  rejected --> [*]
  revision_requested --> [*]
  expired --> [*]
  superseded --> [*]
```

Current notes:

- `approve`, `reject`, and `request-revision` are implemented as routes.
- `expired` and `superseded` are defined states but not fully automated.
- Approval decisions write audit events and update artifact state.
- Stale approval protection exists around artifact version checks.

## Workflow Run State Machine

States:

- `queued`
- `running`
- `waiting_for_approval`
- `completed`
- `failed`
- `blocked`

```mermaid
stateDiagram-v2
  [*] --> queued: API creates workflow_run
  queued --> running: Temporal workflow starts
  running --> waiting_for_approval: artifact persisted and approval pending
  waiting_for_approval --> completed: workflow output recorded
  running --> completed: workflow output recorded
  running --> failed: workflow/activity error
  running --> blocked: governance or lineage gate blocks
  failed --> [*]
  blocked --> [*]
  completed --> [*]
```

Current notes:

- Workflows generally mark `running`, persist an artifact, create approval, then mark `completed`.
- `waiting_for_approval` exists in contracts but workflows often complete after creating an approval instead of staying waiting.
- Approval continuation is handled outside Temporal by the API `WorkflowChainService`.
- Failure/blocked handling should be made more explicit before live execution.

## Codex Execution Run State Machine

States:

- `queued`
- `ready_for_live_execution`
- `running`
- `completed_dry_run`
- `failed`
- `cancelled`

```mermaid
stateDiagram-v2
  [*] --> queued: approved codex_execution_contract creates run
  queued --> cancelled: human cancels before running
  queued --> running: dry-run start when CODEX_EXECUTION_MODE=dry_run
  running --> completed_dry_run: dry-run completes without side effects
  running --> failed: dry-run failure
  queued --> ready_for_live_execution: mark-ready passes
  queued --> queued: mark-ready fails with blockers
  ready_for_live_execution --> [*]: live execution not implemented
  completed_dry_run --> [*]
  failed --> [*]
  cancelled --> [*]
```

Current notes:

- `ready_for_live_execution` is an eligibility state only.
- Live execution remains unimplemented and must remain blocked.
- `start` currently supports dry-run lifecycle and live-mode blocking.
- Cleanup is allowed only for `completed_dry_run`, `failed`, and `cancelled`.
- `ready_for_live_execution` should not imply branch creation, PR creation, or code execution.

## Governed Planning Chain

```mermaid
flowchart TD
  A["raw project idea"] --> B["intakeWorkflow"]
  B --> C["project_brief: pending_approval"]
  C --> D{"human approval"}
  D -->|approved| E["sdlcPlanWorkflow"]
  E --> F["sdlc_plan: pending_approval"]
  F --> G{"human approval"}
  G -->|approved| H["taskGenerationWorkflow"]
  H --> I["task_batch: pending_approval"]
  I --> J{"human approval"}
  J -->|approved| K["githubIssueDraftWorkflow"]
  K --> L["github_issue_batch: pending_approval"]
  L --> M{"human approval"}
  M -->|approved| N["GitHub issue records: dry_run"]
  I --> O["codex_task_packet_batch"]
  O --> P{"human approval"}
  P --> Q["git_execution_plan"]
  Q --> R{"human approval"}
  R --> S["codex_execution_contract"]
  S --> T{"human approval"}
  T --> U["codex_execution_run: queued"]
  U --> V["preflight + repo status"]
  V --> W["ready_for_live_execution"]
  W --> X["branch_preparation_plan: pending_approval"]
  X --> Y{"human approval"}
  Y --> Z["future branch creation not implemented"]
```

## Execution Safety Gate

```mermaid
flowchart TD
  A["codex_execution_run: queued"] --> B["approved contract check"]
  B --> C["API preflight"]
  C --> D["executor repo status"]
  D --> E{"all checks pass?"}
  E -->|no| F["return blockers; status unchanged"]
  E -->|yes| G["status: ready_for_live_execution"]
  G --> H["branch_preparation_plan can be generated"]
  H --> I["approval required"]
  I --> J["live execution still blocked"]
```

Required checks for `ready_for_live_execution`:

- approved `codex_execution_contract`
- successful preflight
- clean executor worktree
- current branch is not `main` or `master`
- forbidden files are defined
- required tests are defined
- `CODEX_EXECUTION_MODE` is not `disabled`
- live execution remains unimplemented

## Branch Preparation Plan State

`branch_preparation_plan` is an artifact and follows the artifact state machine:

```mermaid
stateDiagram-v2
  [*] --> draft: generated from ready execution run
  draft --> pending_approval: approval created
  pending_approval --> approved: human approves
  pending_approval --> rejected: human rejects
  pending_approval --> draft: revision requested
  approved --> [*]: future branch creation still not implemented
```

Approval of `branch_preparation_plan` means only:

```text
the future branch creation step has been reviewed
```

It does not mean:

```text
create a branch
execute Codex
modify files
open a pull request
```

## State Machine Gaps To Stabilize

- `waiting_for_approval` is defined but not consistently used as a durable waiting workflow state.
- `expired` and `superseded` approval states need explicit transition policies.
- `superseded` artifact state needs automatic version-aware handling.
- `ready_for_live_execution` should be blocked from `start` until live execution is implemented with a separate executor job model.
- All status transitions should eventually move behind centralized transition functions.
