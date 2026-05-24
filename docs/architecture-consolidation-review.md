# Revealth v0.1 Architecture Consolidation Review

Date: 2026-05-23

This review freezes the current architecture before live execution. It inventories the implemented system and identifies the stabilization work required before Revealth is allowed to mutate repositories.

## Architecture Inventory

### Services

- `apps/web`: Next.js App Router frontend for workspaces, artifacts, approvals, audit, and settings.
- `apps/api`: Fastify governance API. Owns approval enforcement, artifact generation, GitHub dry-run publishing, Codex execution run state, executor proxying, and audit writes.
- `apps/workers`: Temporal worker. Owns durable planning workflows and agent-driven artifact generation.
- `apps/executor`: Fastify execution-plane boundary. Owns repository status/preflight observation and execution workspace manifest creation only.
- `packages/contracts`: Zod schemas and shared TypeScript contract types.
- `packages/database`: Prisma client, repository helpers, schema, migrations, seed.
- `packages/model-providers`: local/OpenAI/Anthropic provider abstraction for worker-side agents.

### Docker Services

- `postgres`: `pgvector/pgvector:pg16`, host port `5433`.
- `temporal`: `temporalio/auto-setup:1.25.2`, host port `7233`.
- `temporal-ui`: `temporalio/ui:2.31.2`, host port `8080`.
- `api`: Fastify API, host port `4000`.
- `worker`: Temporal worker.
- `executor`: execution-plane repo observer, host port `4100`, mounts repo at `/workspace`.

### Databases And Tables

- `users`
- `workspaces`
- `workflow_runs`
- `artifacts`
- `approvals`
- `agent_runs`
- `tasks`
- `github_connections`
- `github_issue_drafts`
- `github_issues`
- `codex_execution_runs`
- `memory_entries`
- `audit_logs`

### Temporal Workflows

- `intakeWorkflow`: idea to `project_brief`.
- `productPlanWorkflow`: project brief to product plan; present but not part of current governed chain.
- `sdlcPlanWorkflow`: approved project brief to `sdlc_plan`.
- `taskGenerationWorkflow`: approved SDLC plan to `task_batch`.
- `githubIssueDraftWorkflow`: approved task batch to `github_issue_batch`.

### Workflow Chain

Current governed chain:

```text
idea
  -> project_brief
  -> sdlc_plan
  -> task_batch
  -> github_issue_batch
  -> github dry-run records
  -> codex_task_packet_batch
  -> git_execution_plan
  -> codex_execution_contract
  -> codex_execution_run
  -> ready_for_live_execution
  -> branch_preparation_plan
```

Automated approval continuation exists for:

- `project_brief` approval starts `sdlc_plan`.
- `sdlc_plan` approval starts `task_generation`.
- `task_batch` approval starts `github_issue_drafts`.

Manual API generation exists for:

- `codex_task_packet_batch`
- `git_execution_plan`
- `codex_execution_contract`
- `codex_execution_run`
- `branch_preparation_plan`

### Artifact Types

- `project_brief`
- `product_plan`
- `architecture_plan`
- `sdlc_plan`
- `task_batch`
- `github_issue_batch`
- `codex_task_packet_batch`
- `git_execution_plan`
- `codex_execution_contract`
- `branch_preparation_plan`

Note: `product_plan` and `architecture_plan` are defined in contracts/schema but not part of the verified v0.1 primary chain.

### Approval States

- `pending`
- `approved`
- `rejected`
- `revision_requested`
- `expired`
- `superseded`

### Artifact States

- `draft`
- `pending_approval`
- `approved`
- `rejected`
- `superseded`

### Execution Run States

- `queued`
- `ready_for_live_execution`
- `running`
- `completed_dry_run`
- `failed`
- `cancelled`

### Workflow Run States

- `queued`
- `running`
- `waiting_for_approval`
- `completed`
- `failed`
- `blocked`

### API Routes

Core:

- `GET /health`
- `POST /workspaces`
- `GET /workspaces`
- `GET /workspaces/:workspaceId`
- `GET /workspaces/:workspaceId/audit-events`

Artifacts:

- `GET /workspaces/:workspaceId/artifacts`
- `GET /workspaces/:workspaceId/artifacts/:artifactId`
- `POST /workspaces/:workspaceId/artifacts`
- `GET /workspaces/:workspaceId/artifacts/:artifactId/lineage`

Approvals:

- `GET /workspaces/:workspaceId/approvals`
- `POST /workspaces/:workspaceId/approvals`
- `POST /workspaces/:workspaceId/approvals/:approvalId/approve`
- `POST /workspaces/:workspaceId/approvals/:approvalId/reject`
- `POST /workspaces/:workspaceId/approvals/:approvalId/request-revision`

Workflows:

- `POST /workspaces/:workspaceId/workflows/intake`
- `POST /workspaces/:workspaceId/workflows/product-plan`
- `POST /workspaces/:workspaceId/workflows/sdlc-plan`
- `POST /workspaces/:workspaceId/workflows/task-generation`
- `POST /workspaces/:workspaceId/workflows/github-issue-drafts`
- `GET /workspaces/:workspaceId/workflows/:workflowRunId`

GitHub:

- `GET /workspaces/:workspaceId/github/connections`
- `POST /workspaces/:workspaceId/github/connections`
- `GET /workspaces/:workspaceId/github/issues`
- `POST /workspaces/:workspaceId/artifacts/:artifactId/github-issues`

Codex/governed execution:

- `GET /workspaces/:workspaceId/codex/task-packet-batches`
- `POST /workspaces/:workspaceId/artifacts/:taskBatchArtifactId/codex-task-packets`
- `POST /workspaces/:workspaceId/codex/task-batches/:taskBatchArtifactId/task-packet-batches`
- `GET /workspaces/:workspaceId/git/execution-plans`
- `GET /workspaces/:workspaceId/codex/git-execution-plans`
- `POST /workspaces/:workspaceId/artifacts/:codexTaskPacketBatchArtifactId/git-execution-plans`
- `POST /workspaces/:workspaceId/codex/task-packet-batches/:codexTaskPacketBatchArtifactId/git-execution-plans`
- `GET /workspaces/:workspaceId/codex/execution-contracts`
- `POST /workspaces/:workspaceId/artifacts/:gitExecutionPlanArtifactId/codex-execution-contracts`
- `POST /workspaces/:workspaceId/codex/git-execution-plans/:gitExecutionPlanArtifactId/execution-contracts`
- `GET /workspaces/:workspaceId/codex/execution-runs`
- `GET /workspaces/:workspaceId/codex/execution-runs/:runId`
- `GET /workspaces/:workspaceId/codex/execution-runs/:runId/inspection`
- `POST /workspaces/:workspaceId/artifacts/:contractArtifactId/codex-execution-runs`
- `POST /workspaces/:workspaceId/codex/execution-contracts/:contractArtifactId/execution-runs`
- `POST /workspaces/:workspaceId/codex/execution-runs/:runId/cancel`
- `POST /workspaces/:workspaceId/codex/execution-runs/:runId/start`
- `POST /workspaces/:workspaceId/codex/execution-runs/:runId/preflight`
- `POST /workspaces/:workspaceId/codex/execution-runs/:runId/mark-ready`
- `POST /workspaces/:workspaceId/codex/execution-runs/:runId/cleanup`
- `GET /workspaces/:workspaceId/codex/executor/repo-status`
- `GET /workspaces/:workspaceId/codex/branch-preparation-plans`
- `POST /workspaces/:workspaceId/codex/execution-runs/:runId/branch-preparation-plans`
- `GET /workspaces/:workspaceId/control-plane`

Executor internal:

- `GET /health`
- `GET /executor/repo/status`
- `POST /executor/runs/:runId/preflight`

### Audit Event Types

Observed event names:

- `workspace.created`
- `artifact.created`
- `approval.created`
- `approval.approved`
- `approval.rejected`
- `approval.revision_requested`
- `approval.transition.completed`
- `workflow.started`
- `workflow.chain.started`
- `agent.completed`
- `github.repository_connection.configured`
- `github.issue.create.attempted`
- `github.issue.create.succeeded`
- `github.issue.create.failed`
- `github.issue.create.skipped`
- `codex.task_packet_batch.generate.requested`
- `codex.task_packet_batch.generate.skipped`
- `codex.task_packet_batch.generated`
- `git.execution_plan.generate.requested`
- `git.execution_plan.generate.skipped`
- `git.execution_plan.generated`
- `codex.execution_contract.generate.requested`
- `codex.execution_contract.generate.skipped`
- `codex.execution_contract.generated`
- `codex.execution_run.queued`
- `codex.execution_run.create.skipped`
- `codex.execution_run.validated`
- `codex.execution_run.start.blocked`
- `codex.execution_run.dry_run.started`
- `codex.execution_run.dry_run.completed`
- `codex.execution_run.live.blocked`
- `codex.execution_run.preflight.started`
- `codex.execution_run.preflight.passed`
- `codex.execution_run.preflight.failed`
- `codex.execution_run.mark_ready.failed`
- `codex.execution_run.ready_for_live_execution`
- `codex.execution_run.cancelled`
- `codex.execution_workspace.cleaned`
- `branch_preparation_plan.generate.requested`
- `branch_preparation_plan.generate.skipped`
- `branch_preparation_plan.generated`

### Environment Variables

Application:

- `NODE_ENV`
- `APP_ENV`
- `APP_URL`
- `API_URL`
- `API_HOST`
- `API_PORT`
- `LOG_LEVEL`
- `NEXT_PUBLIC_API_URL`

Database:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`

Auth/local owner:

- `LOCAL_OWNER_ID`
- `LOCAL_OWNER_EMAIL`

Temporal:

- `TEMPORAL_ADDRESS`
- `TEMPORAL_NAMESPACE`
- `TEMPORAL_TASK_QUEUE`

Model providers:

- `MODEL_PROVIDER`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEFAULT_PLANNING_MODEL`
- `DEFAULT_REVIEW_MODEL`

GitHub:

- `GITHUB_TOKEN`
- `GITHUB_DEFAULT_REPOSITORY`
- `GITHUB_ISSUE_CREATION_MODE`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_WEBHOOK_SECRET`

Codex/executor:

- `CODEX_EXECUTION_MODE`
- `EXECUTOR_URL`
- `EXECUTOR_HOST`
- `EXECUTOR_PORT`
- `EXECUTOR_REPOSITORY_PATH`

Security/observability:

- `ENCRYPTION_KEY`
- `COOKIE_SECRET`
- `SENTRY_DSN`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_SERVICE_NAME`

## Findings

### Duplicate Logic

- Repository path/command validation exists in both `apps/api/src/services/codex-execution-adapter.ts` and `apps/executor/src/safety.ts`.
- Execution workspace manifest writing exists in both API adapter dry-run code and executor preflight code.
- Approval-backed artifact generation repeats the same pattern across Codex task packets, Git execution plans, execution contracts, and branch preparation plans.
- Workflow start logic exists both in route handlers and `WorkflowChainService`.

### Inconsistent Naming

- Route groups mix `/artifacts/:id/...`, `/codex/...`, `/git/...`, and `/github/...` patterns.
- Artifact action names mix dot namespaces (`codex.execution_contract.*`) and underscore artifact names (`branch_preparation_plan.*`).
- Workflow type names differ from Temporal workflow names: `task_generation` vs `taskGenerationWorkflow`, `github_issue_drafts` vs `githubIssueDraftWorkflow`.
- `github_issue_batch` artifact produces `github_issues` records; route naming says `github-issues`, not `github-issue-batch`.

### Dead Or Underused Code

- `product_plan` and `architecture_plan` schemas are not part of the verified v0.1 chain.
- `GitHubIssueDraft` table exists but the current governed publishing path primarily uses `github_issue_batch` artifacts and `github_issues` records.
- `MemoryEntry` and `pgvector` are scaffolded but not yet integrated into active planning decisions.
- `productPlanWorkflow` exists but is not chained from approvals in the current workflow chain.

### Missing Tests

- Route-level tests are thin; most tests cover services/planners.
- End-to-end tests over API plus Temporal plus worker are manual, not automated.
- Executor API route tests are service-focused, not HTTP-level.
- Web UI has no visible tests.
- Approval chain coverage exists for core transitions but should be expanded for branch preparation approval.

### Missing Validation

- Prisma stores statuses as strings, so database-level status enforcement is absent.
- Many artifact lineage invariants are service-level only, not database constraints.
- `WorkflowRun.workflowType` and `Artifact.artifactType` are strings in the database.
- `AuditLog.action` is unconstrained free text.
- API route params are mostly manually cast rather than consistently parsed by Zod.

### Missing Audit Coverage

- Executor direct endpoints do not write audit events because executor has no database access by design; API proxy usage is auditable indirectly only when paired with API actions.
- Read-only route calls generally are not audited.
- Failed route validation is logged by Fastify but not always represented as domain audit events.
- `branch_preparation_plan.generate` has success/skip audit, but rejection due to precondition failure currently relies on error response rather than a domain audit event.

### Artifact Lineage Risks

- Most generated artifacts set parent/source approval/model/prompt fields, but manual `POST /artifacts` can create artifacts without strong lineage policy.
- `branch_preparation_plan` uses the contract artifact as parent and stores run id inside content; there is no direct DB relation to `codex_execution_runs`.
- Downstream artifacts generated outside Temporal have `sourceWorkflowRunId: null`, which is accurate but should be treated as a different lineage class.
- `product_plan` and `architecture_plan` lineage expectations are undefined for the current chain.

### Route Inconsistencies

- Generation routes are split between artifact-centered routes and execution-run-centered routes.
- `GET /workspaces/:workspaceId/git/execution-plans` is outside `/codex` while related Codex routes are inside `/codex`.
- Executor status is proxied under `/codex/executor/repo-status`, while executor direct endpoint is `/executor/repo/status`.
- `POST /execution-runs/:runId/start` can only dry-run/live-block but name reads broader than its current behavior.

### Type And Schema Drift Risks

- Contracts build output can become stale because app tsconfigs override root path mappings and resolve package `dist` declarations.
- Status values are duplicated between Zod enums, tests, service string literals, and database strings.
- Artifact type enum must be updated whenever a new artifact generator is added.
- Docker image builds depend on generated package output and can expose stale contract issues later than local tests.

## Highest Technical Debt Areas

1. Stringly typed status and artifact/workflow types in Prisma.
2. Duplicated safety validation between API and executor.
3. Repeated artifact-generation service boilerplate.
4. Manual route param parsing.
5. Mixed route naming and resource boundaries.
6. Manual E2E verification instead of automated stack tests.
7. Sparse UI tests.
8. Unintegrated MemoryEntry/pgvector architecture.
9. Temporal workflow failure handling is basic.
10. No single source of truth for audit action names.

## Highest Security Risk Areas

1. Future live executor could accidentally receive secrets through mounted workspace/environment.
2. Command allowlist/denylist matching is string/pattern based and needs hardening before execution.
3. Repository mount gives executor visibility into the full workspace.
4. GitHub token path exists; live mode must enforce least privilege and dry-run defaults.
5. `.env` and `.revealth` must remain ignored and explicitly forbidden.
6. API authentication is local-owner based and not production-grade.
7. Audit logs are append-only by convention but not enforced by database permissions.
8. No secret redaction pipeline for execution logs beyond Fastify header redaction.

## Highest Scaling Bottlenecks

1. Single Postgres backs app data and Temporal in local Compose.
2. Artifact content is JSON in one table without typed projections.
3. Audit logs can grow quickly with no retention/index strategy beyond table scans.
4. Workflow chain starts Temporal clients per request.
5. Executor preflight calls shell commands synchronously per request.
6. No queue between API and future executor jobs yet.
7. Web pages call API directly without caching strategy.

## Highest Operational Risks

1. Docker/network instability slows local validation.
2. Contract `dist` staleness can break Docker or app builds.
3. Manual approval/test flows are easy to run out of order.
4. No automated smoke test that proves API/worker/Temporal/Postgres together.
5. Readiness depends on clean Git state, but current development often happens on `main`.
6. Executor direct endpoints bypass API audit if used outside the proxy.

## Top 10 Stabilization Tasks Before Live Execution

1. Introduce centralized constants/enums for artifact types, workflow types, run statuses, approval statuses, and audit actions.
2. Move path and command safety validation into one shared package used by API and executor.
3. Add automated end-to-end smoke tests for the full governed chain through API and Temporal.
4. Add database constraints or lookup tables for statuses and known types.
5. Normalize route structure for generated artifacts and execution resources.
6. Add route-level tests for approvals, execution runs, executor proxy, and branch preparation plans.
7. Create a base `GovernedArtifactGenerationService` helper to reduce generation boilerplate and standardize audit/lineage.
8. Add a formal audit event registry and test coverage requiring audit events for all state-changing routes.
9. Split executor job queue design from API request/response lifecycle before live execution.
10. Add production auth/authorization boundaries before any external side effect can be live.

## Recommendation

Do not implement live execution until tasks 1, 2, 3, 6, 8, and 9 are complete. The current system is strong for governed planning, dry-run validation, and auditability, but live repository mutation needs tighter type discipline, automated E2E checks, and a stricter executor boundary.
