# Revealth v0.1 Execution Blueprint

## Purpose

This execution blueprint converts the Revealth v0.1 PRD into an implementation-grade roadmap for engineers and AI agents.

Revealth v0.1 must be built as a reliable internal prototype first: a governed planning system that converts a software idea into structured project artifacts, SDLC plans, approval-gated task batches, GitHub issue drafts, memory records, and audit logs.

The build order optimizes for:

- Fastest path to a working internal prototype
- Reliability before scale
- Modular architecture
- Low operational complexity in v0.1
- Human approval before external side effects
- Structured JSON outputs for every workflow

## Recommended Stack Decisions

| Layer | Decision | Rationale |
| --- | --- | --- |
| Frontend | Next.js, React, TypeScript | Fast product iteration, server/client flexibility, strong ecosystem |
| Backend | Node.js, TypeScript, Fastify or NestJS | Type-safe services, JSON-first APIs, good orchestration integration |
| Database | PostgreSQL | Durable relational foundation for artifacts, approvals, audit logs, and tasks |
| ORM | Prisma | Fast schema iteration, typed client, migration workflow |
| Orchestration | Temporal | Durable workflows, retries, timeouts, approval waits, long-running agent jobs |
| Vector Memory | pgvector | Low-complexity semantic memory inside PostgreSQL for v0.1 |
| Model Layer | OpenAI/Anthropic abstraction layer | Provider flexibility, centralized policy enforcement, prompt versioning |
| GitHub | GitHub App or OAuth integration | Controlled repository access and issue creation |
| Containers | Docker, Docker Compose | Local parity for API, workers, database, Temporal |
| Frontend Hosting | Vercel | Fast deployment for Next.js |
| Backend Hosting | AWS ECS/Fargate or Render/Fly.io for prototype | Managed runtime for API and workers |
| Database Hosting | Managed PostgreSQL | Reduced operational burden |
| Observability | OpenTelemetry, structured logs, Sentry | Trace workflows and agent failures early |

## Core Build Principle

Build the smallest trustworthy operating loop first:

```text
Idea intake -> structured artifact -> approval -> SDLC plan -> approval -> task batch -> approval -> GitHub issue draft -> audit trail
```

No autonomous deployment, no autonomous code execution, no billing automation, no customer-facing automation.

## Exact Build Order

1. Monorepo foundation
2. Shared TypeScript contracts and JSON schemas
3. Database schema and migrations
4. Backend API shell
5. Audit logging service
6. Artifact service
7. Approval service
8. Workspace service
9. Model provider abstraction
10. Basic agent execution interface
11. Temporal local environment
12. Intake workflow
13. Product planning workflow
14. SDLC planning workflow
15. Task generation workflow
16. Memory write and retrieval layer
17. Frontend founder console shell
18. Artifact review UI
19. Approval UI
20. Task batch review UI
21. GitHub issue draft generation
22. GitHub issue creation behind approval
23. Observability hardening
24. Security hardening
25. Internal deployment
26. End-to-end prototype testing

## System Implementation Phases

### Phase 0: Engineering Foundation

Goal: Create the repo, typing standards, schemas, local runtime, and CI baseline.

Deliverables:

- Monorepo with `apps` and `packages`
- TypeScript configuration
- Package manager setup
- Linting, formatting, and test runner
- Shared schema package
- Docker Compose for PostgreSQL and Temporal
- Initial CI workflow

Exit criteria:

- Developers can run API, web app, database, and Temporal locally
- Shared contracts compile
- CI runs lint, typecheck, and tests

### Phase 1: Data Spine

Goal: Implement the durable backbone for workspaces, artifacts, approvals, workflow runs, agent runs, tasks, GitHub issue drafts, memory, and audit logs.

Deliverables:

- Prisma schema
- Initial migrations
- Repository/data access layer
- Audit write path
- Artifact versioning
- Approval state transitions

Exit criteria:

- Every controlled entity persists to PostgreSQL
- Audit logging exists before agent workflows
- Approval state machine prevents invalid transitions

### Phase 2: API Foundation

Goal: Expose backend services for workspace creation, artifact review, approvals, workflows, and audit viewing.

Deliverables:

- Workspace routes
- Artifact routes
- Approval routes
- Workflow routes
- Audit routes
- Error format standard
- Request validation

Exit criteria:

- APIs validate input using shared schemas
- APIs return consistent error envelopes
- API contracts are documented through OpenAPI

### Phase 3: Agent And Model Layer

Goal: Build the controlled agent execution interface before implementing agent behavior.

Deliverables:

- Model provider abstraction
- Prompt template versioning
- Agent request/response envelope
- JSON schema validation for agent outputs
- Retry and failure policy
- Agent run persistence

Exit criteria:

- Agents cannot write canonical memory directly
- Invalid JSON outputs fail closed
- Every agent run has an audit record

### Phase 4: Temporal Workflow Loop

Goal: Implement durable planning workflows with approval waits.

Deliverables:

- Intake workflow
- Product planning workflow
- SDLC planning workflow
- Task generation workflow
- Approval wait activities
- Retry policies
- Workflow status tracking

Exit criteria:

- A workflow can pause for approval and resume
- Failed agent runs can be retried safely
- Workflow state is queryable from the UI

### Phase 5: Founder Console

Goal: Build a minimal but serious internal UI for project planning and approval.

Deliverables:

- Project dashboard
- Project intake screen
- Artifact review screen
- Approval decision controls
- Task batch review screen
- Audit timeline
- Workflow status panel

Exit criteria:

- A founder can submit an idea and review generated artifacts
- A founder can approve, reject, or request revision
- A founder can inspect the audit trail

### Phase 6: GitHub Draft Integration

Goal: Convert approved task batches into GitHub issue drafts and optionally create issues after explicit approval.

Deliverables:

- GitHub connection model
- Issue draft mapper
- Issue creation approval gate
- Issue creation service
- GitHub result persistence

Exit criteria:

- No issue is created without explicit approval
- Created issues link back to source tasks
- GitHub side effects are fully audited

### Phase 7: Internal Deployment And Hardening

Goal: Deploy the internal prototype with observability, security controls, and operational documentation.

Deliverables:

- Vercel frontend deployment
- API and worker deployment
- Managed PostgreSQL
- Secrets management
- Error monitoring
- Runbooks
- Security checklist completion

Exit criteria:

- Internal users can run the full v0.1 loop in production-like infrastructure
- Logs, traces, and audit events are available
- Critical failure risks have mitigation coverage

## Engineering Priorities

1. Typed schemas before agent behavior
2. Audit logging before workflow expansion
3. Approval enforcement before GitHub integration
4. Artifact versioning before memory retrieval
5. Local prototype before cloud deployment
6. Structured outputs before prompt refinement
7. Manual review before any external mutation

## Dependency Graph

```mermaid
flowchart TD
    A["Monorepo Setup"] --> B["Shared Contracts"]
    B --> C["Prisma Schema"]
    C --> D["Database Migrations"]
    D --> E["Audit Service"]
    D --> F["Artifact Service"]
    D --> G["Approval Service"]
    E --> H["Workflow Run Service"]
    F --> H
    G --> H
    B --> I["Model Provider Layer"]
    I --> J["Agent Runtime"]
    H --> K["Temporal Workflows"]
    J --> K
    K --> L["Frontend Workflow UI"]
    F --> L
    G --> L
    E --> L
    K --> M["Task Generation"]
    M --> N["GitHub Issue Drafts"]
    G --> O["Approved GitHub Creation"]
    N --> O
```

## Service Implementation Order

1. Shared contracts package
2. Database package
3. Audit service
4. Artifact service
5. Approval service
6. Workspace service
7. Workflow service
8. Agent runtime service
9. Memory service
10. GitHub integration service
11. Notification service, optional for v0.1

## Infrastructure Setup Order

1. Local Node.js and package manager
2. Monorepo workspace
3. Docker Compose network
4. PostgreSQL container
5. Temporal server container
6. Temporal UI container
7. API service container
8. Worker service container
9. Web app local dev server
10. Managed PostgreSQL staging database
11. Vercel frontend staging
12. AWS or prototype backend hosting
13. Secrets manager
14. Observability sinks

## Database Migration Order

1. `users`
2. `workspaces`
3. `workflow_runs`
4. `artifacts`
5. `approvals`
6. `agent_runs`
7. `audit_logs`
8. `tasks`
9. `github_connections`
10. `github_issue_drafts`
11. `github_issues`
12. `memory_entries`
13. `vector_embeddings`

Reasoning: identity and workspace ownership must exist first, followed by workflow state, artifact storage, approval control, auditability, task generation, integrations, and finally semantic memory.

## Agent Development Order

1. Agent runtime shell
2. JSON schema validator
3. Model provider adapter
4. Prompt template registry
5. Intake Agent
6. Product Strategy Agent
7. SDLC Orchestration Agent
8. Task Generation Agent
9. Technical Architecture Agent
10. Memory Agent
11. Audit Agent checks
12. Approval Agent logic

Implementation note: the Approval Agent should not make approval decisions. It manages approval state and routes decisions made by authorized humans.

## Frontend Development Order

1. App shell and authenticated layout
2. Workspace list
3. New project intake screen
4. Workspace dashboard
5. Workflow status panel
6. Artifact viewer
7. Approval controls
8. Task batch viewer
9. GitHub issue draft viewer
10. Audit timeline
11. Settings and GitHub connection screen

## API Implementation Order

1. Health check
2. Auth session endpoint
3. Workspace CRUD
4. Artifact create/list/read
5. Approval create/transition
6. Workflow start/status
7. Agent run status
8. Audit list/read
9. Task batch list/read
10. GitHub connection
11. GitHub issue draft generation
12. GitHub issue creation

## Testing Strategy

### Unit Tests

Focus areas:

- Schema validation
- Approval state transitions
- Artifact versioning
- Error envelope generation
- Agent response parsing
- GitHub issue draft mapping

### Integration Tests

Focus areas:

- API route validation
- Prisma repository behavior
- Audit writes on controlled actions
- Approval-gated workflow progression
- Temporal activity retries

### Workflow Tests

Focus areas:

- Intake to project brief
- Product plan approval wait
- SDLC plan generation after approval
- Task batch generation after approval
- GitHub issue draft generation after task approval

### End-To-End Tests

Focus areas:

- Founder creates workspace
- Founder submits idea
- System generates draft artifact
- Founder approves artifact
- System generates task batch
- Founder reviews audit trail

### Agent Output Tests

Focus areas:

- Agent output conforms to JSON schema
- Missing acceptance criteria fails validation
- Unsupported side effect requests are blocked
- Hallucinated state transitions are rejected

## Deployment Strategy

### Local

- Docker Compose for PostgreSQL, Temporal, Temporal UI
- API and worker run locally with hot reload
- Next.js runs locally

### Staging

- Vercel for frontend
- Managed PostgreSQL
- Backend API on AWS ECS/Fargate, Fly.io, Render, or Railway for prototype speed
- Temporal Cloud or self-hosted Temporal on AWS when ready
- Secrets managed outside environment files

### Production-Like Internal Prototype

- One staging environment used by internal users
- Manual database migration approval
- Manual deployment approval
- No public customer access
- GitHub issue creation disabled by default until tested behind approval

Deployment gates:

- Typecheck passes
- Unit and integration tests pass
- Prisma migration reviewed
- Required environment variables present
- Health checks pass
- Rollback path documented

## Observability Strategy

### Logs

Use structured JSON logs everywhere.

Required fields:

- `timestamp`
- `level`
- `service`
- `workspace_id`
- `workflow_run_id`
- `agent_run_id`
- `request_id`
- `actor_type`
- `action`
- `status`
- `error_code`

### Traces

Trace:

- API requests
- Temporal workflow runs
- Temporal activities
- Agent model calls
- Database writes
- GitHub integration calls

### Metrics

Track:

- Workflow success rate
- Agent schema validation failure rate
- Approval wait time
- Audit write failure rate
- Task generation rejection rate
- GitHub issue creation success rate
- Model provider latency and error rate

### Error Monitoring

Use Sentry or equivalent for:

- API exceptions
- Frontend exceptions
- Worker failures
- Unhandled promise rejections

## Security Implementation Checklist

- Use OAuth or managed auth provider for identity
- Enforce workspace-level authorization on every API route
- Store secrets outside source control
- Encrypt GitHub tokens at rest
- Never pass raw secrets into model prompts
- Validate all request bodies with shared schemas
- Validate all agent outputs before persistence
- Use append-oriented audit logs
- Require approval IDs for controlled external side effects
- Invalidate stale approvals when artifact versions change
- Use least-privilege GitHub scopes
- Rate-limit workflow starts and model calls
- Sanitize user-provided content before rendering
- Log security-relevant events
- Separate draft artifacts from approved canonical artifacts

## Monorepo Setup

Use `pnpm` workspaces for low install overhead, strong workspace linking, and good monorepo ergonomics.

Top-level tooling:

- TypeScript
- ESLint
- Prettier
- Vitest
- Prisma
- Turbo, optional after repo grows

## Package Management

Recommended:

- Package manager: `pnpm`
- Node version: active LTS
- Lockfile committed
- Shared scripts at repo root

Required root scripts:

```json
{
  "scripts": {
    "dev": "pnpm --parallel dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "db:migrate": "pnpm --filter @revealth/database db:migrate",
    "db:studio": "pnpm --filter @revealth/database db:studio"
  }
}
```

## TypeScript Standards

- Enable `strict`
- Use explicit return types on exported functions
- Avoid `any`
- Use discriminated unions for state machines
- Keep shared DTOs in `packages/contracts`
- Validate runtime data with Zod or JSON Schema
- Infer TypeScript types from schemas where practical

## Schema Validation Standards

- Every workflow input has a schema
- Every workflow output has a schema
- Every agent response has a schema
- Every API request body has a schema
- Every persisted JSON artifact has a schema version
- Schema validation failures must produce structured errors

Recommended format:

```json
{
  "schema_version": "revealth.artifact.task_batch.v1",
  "data": {}
}
```

## API Contract Strategy

- API contracts live in `packages/contracts`
- Use OpenAPI generated from route schemas
- Frontend consumes typed API clients
- Backend rejects unknown or invalid payloads
- Breaking changes require schema version increments

Standard API response:

```json
{
  "data": {},
  "error": null,
  "request_id": "uuid"
}
```

Standard API error:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request failed validation.",
    "details": {}
  },
  "request_id": "uuid"
}
```

## Environment Variable Strategy

- Maintain `.env.example`
- Do not commit `.env`
- Prefix frontend-exposed variables with `NEXT_PUBLIC_`
- Validate required env vars at service startup
- Separate local, staging, and production values
- Use secrets manager in deployed environments

## Logging Standards

- Use structured JSON logs
- Never log secrets, tokens, or raw provider responses containing sensitive data
- Include correlation IDs
- Include workflow and agent IDs when available
- Log business events through audit logs, not only application logs

## Error Handling Standards

- Fail closed on missing approval
- Fail closed on invalid agent JSON
- Fail closed on failed audit writes for controlled workflows
- Return typed errors from services
- Avoid leaking provider internals to users
- Preserve recoverable error metadata for retries

Error categories:

- `VALIDATION_ERROR`
- `AUTHORIZATION_ERROR`
- `APPROVAL_REQUIRED`
- `STALE_APPROVAL`
- `SCHEMA_VALIDATION_FAILED`
- `AGENT_OUTPUT_INVALID`
- `MODEL_PROVIDER_ERROR`
- `AUDIT_WRITE_FAILED`
- `GITHUB_INTEGRATION_ERROR`
- `WORKFLOW_BLOCKED`

## Retry Strategy

Retry:

- Transient model provider errors
- Temporal activity timeouts
- GitHub rate-limited calls when safe
- Vector indexing failures

Do not automatically retry:

- Approval rejections
- Authorization failures
- Schema-invalid user inputs
- Invalid state transitions
- External side effects unless idempotency is guaranteed

Recommended policy:

- Exponential backoff
- Max 3 attempts for model calls
- Max 5 attempts for internal activities
- Idempotency keys for GitHub issue creation
- Dead-letter queue for unrecoverable async tasks

## Queue Strategy

Use Temporal as the primary queue and durable workflow engine for v0.1.

Use Temporal for:

- Agent planning workflows
- Approval waits
- Retryable activities
- GitHub issue creation activities
- Memory indexing activities

Avoid adding a separate queue such as BullMQ or SQS until there is a clear workload that Temporal should not own.

## Recommended Initial Repository Bootstrap

### Exact Folder Structure

```text
revealth/
  apps/
    web/
      src/
        app/
          (authenticated)/
            workspaces/
              page.tsx
              [workspaceId]/
                page.tsx
                artifacts/
                  [artifactId]/
                    page.tsx
                tasks/
                  page.tsx
                audit/
                  page.tsx
            settings/
              page.tsx
          api/
          layout.tsx
          page.tsx
        components/
          layout/
          approvals/
          artifacts/
          tasks/
          audit/
        lib/
          api-client.ts
          auth.ts
          routes.ts
    api/
      src/
        server.ts
        app.ts
        config/
          env.ts
          logger.ts
        modules/
          workspaces/
          artifacts/
          approvals/
          workflows/
          audit/
          github/
          memory/
        plugins/
          auth.ts
          request-id.ts
          error-handler.ts
    workers/
      src/
        worker.ts
        workflows/
          intake.workflow.ts
          product-plan.workflow.ts
          sdlc-plan.workflow.ts
          task-generation.workflow.ts
          github-issue.workflow.ts
        activities/
          agents.activities.ts
          artifacts.activities.ts
          approvals.activities.ts
          audit.activities.ts
          github.activities.ts
          memory.activities.ts
        agents/
          runtime.ts
          prompts/
            intake.prompt.ts
            product-strategy.prompt.ts
            sdlc-orchestration.prompt.ts
            task-generation.prompt.ts
  packages/
    contracts/
      src/
        artifacts/
        approvals/
        agents/
        workflows/
        tasks/
        github/
        errors/
        index.ts
    database/
      prisma/
        schema.prisma
        migrations/
      src/
        client.ts
        repositories/
    model-providers/
      src/
        index.ts
        provider.ts
        openai.ts
        anthropic.ts
    config/
      tsconfig/
      eslint/
    ui/
      src/
  infra/
    docker/
      Dockerfile.api
      Dockerfile.worker
    docker-compose.yml
  docs/
    product/
      Revealth_v0.1_PRD.md
      Revealth_v0.1_Execution_Blueprint.md
    architecture/
    runbooks/
  .github/
    workflows/
      ci.yml
```

### First Services To Implement

1. `AuditService`
2. `ArtifactService`
3. `ApprovalService`
4. `WorkspaceService`
5. `WorkflowService`
6. `AgentRuntimeService`
7. `MemoryService`
8. `GitHubIssueDraftService`

### First Database Tables

1. `users`
2. `workspaces`
3. `workflow_runs`
4. `artifacts`
5. `approvals`
6. `agent_runs`
7. `audit_logs`
8. `tasks`
9. `github_issue_drafts`
10. `memory_entries`

### First APIs

```text
GET    /health
POST   /workspaces
GET    /workspaces
GET    /workspaces/:workspaceId
POST   /workspaces/:workspaceId/workflows/intake
GET    /workspaces/:workspaceId/workflows/:workflowRunId
GET    /workspaces/:workspaceId/artifacts
GET    /workspaces/:workspaceId/artifacts/:artifactId
POST   /workspaces/:workspaceId/approvals
POST   /workspaces/:workspaceId/approvals/:approvalId/approve
POST   /workspaces/:workspaceId/approvals/:approvalId/reject
POST   /workspaces/:workspaceId/approvals/:approvalId/request-revision
GET    /workspaces/:workspaceId/tasks
POST   /workspaces/:workspaceId/github/issue-drafts
GET    /workspaces/:workspaceId/audit-events
```

### First UI Screens

1. Workspace list
2. New workspace and project intake
3. Workspace dashboard
4. Workflow status
5. Artifact review
6. Approval decision panel
7. Task batch review
8. Audit timeline
9. GitHub issue draft review

### First Workflows

1. `IntakeWorkflow`
2. `ProductPlanWorkflow`
3. `SdlcPlanWorkflow`
4. `TaskGenerationWorkflow`
5. `GitHubIssueDraftWorkflow`

## Initial .env Structure

```dotenv
# App
NODE_ENV=development
APP_ENV=local
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://revealth:revealth@localhost:5432/revealth
DIRECT_DATABASE_URL=postgresql://revealth:revealth@localhost:5432/revealth

# Auth
AUTH_PROVIDER=clerk
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
JWT_ISSUER=
JWT_AUDIENCE=

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=revealth-v01

# Model Providers
MODEL_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEFAULT_PLANNING_MODEL=
DEFAULT_REVIEW_MODEL=

# GitHub
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Security
ENCRYPTION_KEY=
COOKIE_SECRET=

# Observability
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=revealth-api
```

## Recommended Docker Architecture

```mermaid
flowchart LR
    WEB["Next.js Web"] --> API["API Service"]
    API --> PG["PostgreSQL + pgvector"]
    API --> TEMP["Temporal Server"]
    WORKER["Worker Service"] --> TEMP
    WORKER --> PG
    WORKER --> MODEL["Model Providers"]
    WORKER --> GH["GitHub API"]
    TEMP --> TEMPDB["Temporal Persistence"]
    OBS["Observability"] --> API
    OBS --> WORKER
```

Local Docker services:

- `postgres`
- `temporal`
- `temporal-ui`
- `api`
- `worker`

Recommended local `docker-compose.yml` responsibilities:

- Create one network
- Mount PostgreSQL data volume
- Expose PostgreSQL on `5432`
- Expose Temporal on `7233`
- Expose Temporal UI on `8080`
- Run API on `4000`
- Run worker with same environment as API

## Initial API Routes

### Workspace Routes

- `POST /workspaces`
- `GET /workspaces`
- `GET /workspaces/:workspaceId`
- `PATCH /workspaces/:workspaceId`

### Workflow Routes

- `POST /workspaces/:workspaceId/workflows/intake`
- `POST /workspaces/:workspaceId/workflows/product-plan`
- `POST /workspaces/:workspaceId/workflows/sdlc-plan`
- `POST /workspaces/:workspaceId/workflows/task-generation`
- `GET /workspaces/:workspaceId/workflows/:workflowRunId`

### Artifact Routes

- `GET /workspaces/:workspaceId/artifacts`
- `GET /workspaces/:workspaceId/artifacts/:artifactId`
- `POST /workspaces/:workspaceId/artifacts/:artifactId/submit-for-approval`

### Approval Routes

- `GET /workspaces/:workspaceId/approvals`
- `POST /workspaces/:workspaceId/approvals/:approvalId/approve`
- `POST /workspaces/:workspaceId/approvals/:approvalId/reject`
- `POST /workspaces/:workspaceId/approvals/:approvalId/request-revision`

### Task Routes

- `GET /workspaces/:workspaceId/tasks`
- `GET /workspaces/:workspaceId/task-batches/:taskBatchId`

### GitHub Routes

- `POST /workspaces/:workspaceId/github/connect`
- `POST /workspaces/:workspaceId/github/issue-drafts`
- `POST /workspaces/:workspaceId/github/issue-drafts/:issueDraftBatchId/submit-for-approval`
- `POST /workspaces/:workspaceId/github/issue-drafts/:issueDraftBatchId/create`

### Audit Routes

- `GET /workspaces/:workspaceId/audit-events`
- `GET /workspaces/:workspaceId/audit-events/:auditLogId`

## Initial Temporal Workflows

### IntakeWorkflow

Inputs:

- `workspace_id`
- `owner_id`
- `raw_project_idea`

Activities:

1. Create workflow audit event
2. Run Intake Agent
3. Validate project brief JSON
4. Persist draft artifact
5. Create approval request
6. Write audit event

Output:

- Draft project brief artifact
- Pending approval

### ProductPlanWorkflow

Inputs:

- `workspace_id`
- `project_brief_artifact_id`

Activities:

1. Verify source artifact approval
2. Retrieve canonical memory
3. Run Product Strategy Agent
4. Validate product plan JSON
5. Persist draft artifact
6. Create approval request
7. Write audit event

Output:

- Draft product plan artifact
- Pending approval

### SdlcPlanWorkflow

Inputs:

- `workspace_id`
- `product_plan_artifact_id`
- `architecture_artifact_id`, optional

Activities:

1. Verify required approvals
2. Retrieve source artifacts
3. Run SDLC Orchestration Agent
4. Validate SDLC plan JSON
5. Persist draft artifact
6. Create approval request
7. Write audit event

Output:

- Draft SDLC plan artifact
- Pending approval

### TaskGenerationWorkflow

Inputs:

- `workspace_id`
- `sdlc_plan_artifact_id`

Activities:

1. Verify SDLC plan approval
2. Run Task Generation Agent
3. Validate task batch JSON
4. Reject tasks without acceptance criteria
5. Persist task batch artifact
6. Create task records in draft state
7. Create approval request
8. Write audit event

Output:

- Draft task batch
- Pending approval

### GitHubIssueDraftWorkflow

Inputs:

- `workspace_id`
- `task_batch_artifact_id`
- `repository`

Activities:

1. Verify task batch approval
2. Map tasks to GitHub issue drafts
3. Validate issue draft payloads
4. Persist issue draft artifact
5. Create approval request
6. Write audit event

Output:

- GitHub issue draft batch
- Pending approval

## Initial Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id         String      @id @default(uuid()) @db.Uuid
  email      String      @unique
  name       String?
  workspaces Workspace[]
  approvals  Approval[]  @relation("ApprovalApprover")
  createdAt  DateTime    @default(now())
}

model Workspace {
  id          String        @id @default(uuid()) @db.Uuid
  ownerId     String        @db.Uuid
  name        String
  status      String
  owner       User          @relation(fields: [ownerId], references: [id])
  artifacts   Artifact[]
  approvals   Approval[]
  workflows   WorkflowRun[]
  agentRuns   AgentRun[]
  tasks       Task[]
  auditLogs   AuditLog[]
  memory      MemoryEntry[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model WorkflowRun {
  id          String      @id @default(uuid()) @db.Uuid
  workspaceId String      @db.Uuid
  workflowType String
  status      String
  inputJson   Json
  outputJson  Json?
  workspace   Workspace   @relation(fields: [workspaceId], references: [id])
  agentRuns   AgentRun[]
  auditLogs   AuditLog[]
  createdAt   DateTime    @default(now())
  completedAt DateTime?
}

model Artifact {
  id                String      @id @default(uuid()) @db.Uuid
  workspaceId       String      @db.Uuid
  artifactType      String
  version           Int
  status            String
  schemaVersion     String
  contentJson       Json
  sourceArtifactIds String[]    @db.Uuid
  workspace         Workspace   @relation(fields: [workspaceId], references: [id])
  approvals         Approval[]
  tasks             Task[]
  createdAt         DateTime    @default(now())

  @@unique([workspaceId, artifactType, version])
}

model Approval {
  id              String      @id @default(uuid()) @db.Uuid
  workspaceId     String      @db.Uuid
  artifactId      String      @db.Uuid
  artifactVersion Int
  status          String
  approverId      String?     @db.Uuid
  decisionNotes   String?
  workspace       Workspace   @relation(fields: [workspaceId], references: [id])
  artifact        Artifact    @relation(fields: [artifactId], references: [id])
  approver        User?       @relation("ApprovalApprover", fields: [approverId], references: [id])
  auditLogs       AuditLog[]
  decidedAt       DateTime?
  createdAt       DateTime    @default(now())
}

model AgentRun {
  id             String       @id @default(uuid()) @db.Uuid
  workspaceId    String       @db.Uuid
  workflowRunId  String       @db.Uuid
  agentName      String
  status         String
  inputJson      Json
  outputJson     Json?
  modelProvider  String?
  modelName      String?
  promptVersion  String?
  errorJson      Json?
  workspace      Workspace    @relation(fields: [workspaceId], references: [id])
  workflowRun    WorkflowRun  @relation(fields: [workflowRunId], references: [id])
  auditLogs      AuditLog[]
  createdAt      DateTime     @default(now())
  completedAt    DateTime?
}

model Task {
  id                 String      @id @default(uuid()) @db.Uuid
  workspaceId        String      @db.Uuid
  sourceArtifactId   String      @db.Uuid
  title              String
  description        String
  taskType           String
  priority           String
  status             String
  acceptanceCriteria Json
  dependencies       String[]    @db.Uuid
  workspace          Workspace   @relation(fields: [workspaceId], references: [id])
  sourceArtifact     Artifact    @relation(fields: [sourceArtifactId], references: [id])
  issueDrafts        GitHubIssueDraft[]
  createdAt          DateTime    @default(now())
}

model GitHubIssueDraft {
  id            String    @id @default(uuid()) @db.Uuid
  workspaceId   String    @db.Uuid
  taskId        String    @db.Uuid
  repository    String
  title         String
  body          String
  labels        String[]
  milestone     String?
  assignees     String[]
  status        String
  task          Task      @relation(fields: [taskId], references: [id])
  createdAt     DateTime  @default(now())
}

model MemoryEntry {
  id             String     @id @default(uuid()) @db.Uuid
  workspaceId    String     @db.Uuid
  sourceType     String
  sourceId       String     @db.Uuid
  memoryType     String
  status         String
  content        String
  metadataJson   Json
  embedding      Unsupported("vector")?
  workspace      Workspace  @relation(fields: [workspaceId], references: [id])
  createdAt      DateTime   @default(now())
}

model AuditLog {
  id                String       @id @default(uuid()) @db.Uuid
  workspaceId       String       @db.Uuid
  workflowRunId     String?      @db.Uuid
  agentRunId        String?      @db.Uuid
  actorType         String
  actorId           String
  action            String
  sourceArtifactIds String[]     @db.Uuid
  targetArtifactIds String[]     @db.Uuid
  inputHash         String?
  outputHash        String?
  approvalId        String?      @db.Uuid
  status            String
  errorCode         String?
  eventJson         Json
  workspace         Workspace    @relation(fields: [workspaceId], references: [id])
  workflowRun       WorkflowRun? @relation(fields: [workflowRunId], references: [id])
  agentRun          AgentRun?    @relation(fields: [agentRunId], references: [id])
  approval          Approval?    @relation(fields: [approvalId], references: [id])
  createdAt         DateTime     @default(now())
}
```

## Initial Frontend Navigation Map

```mermaid
flowchart TD
    A["/"] --> B["/workspaces"]
    B --> C["/workspaces/new"]
    B --> D["/workspaces/:workspaceId"]
    D --> E["Overview"]
    D --> F["Artifacts"]
    D --> G["Approvals"]
    D --> H["Tasks"]
    D --> I["GitHub Drafts"]
    D --> J["Audit Timeline"]
    D --> K["Settings"]
    F --> L["/workspaces/:workspaceId/artifacts/:artifactId"]
```

Primary navigation:

- Workspaces
- Current workspace overview
- Artifacts
- Approvals
- Tasks
- GitHub drafts
- Audit
- Settings

## Initial Agent Prompt Contract Templates

### Shared System Contract

```text
You are an agent inside Revealth, an autonomous AI software company operating system.

You must produce only structured JSON matching the provided schema.
Do not invent technical facts.
Mark uncertain information as an assumption or open question.
Do not request or perform external side effects.
Do not bypass approval requirements.
Every task must include acceptance criteria.
Every output must reference source artifact IDs when provided.
```

### Intake Agent Template

```text
Agent: IntakeAgent
Prompt version: intake.v1

Objective:
Convert the user's raw software idea into a structured project brief.

Inputs:
{{raw_project_idea}}
{{workspace_context}}

Required output schema:
{{project_brief_schema}}

Rules:
- Preserve the user's intent.
- Extract business goals, target users, constraints, assumptions, open questions, and risks.
- Do not propose implementation tasks yet.
- Return JSON only.
```

### Product Strategy Agent Template

```text
Agent: ProductStrategyAgent
Prompt version: product_strategy.v1

Objective:
Create a product plan from the approved or draft project brief according to the workflow policy.

Inputs:
{{project_brief_artifact}}
{{canonical_memory}}

Required output schema:
{{product_plan_schema}}

Rules:
- Define mission, personas, MVP scope, out-of-scope boundaries, and success metrics.
- Label assumptions clearly.
- Do not expand beyond v0.1 planning scope unless placed in roadmap fields.
- Return JSON only.
```

### SDLC Orchestration Agent Template

```text
Agent: SdlcOrchestrationAgent
Prompt version: sdlc_orchestration.v1

Objective:
Transform approved planning artifacts into an SDLC plan with phases, milestones, dependencies, approval gates, and exit criteria.

Inputs:
{{product_plan_artifact}}
{{architecture_artifact_optional}}
{{risk_register}}

Required output schema:
{{sdlc_plan_schema}}

Rules:
- Every phase must have exit criteria.
- Every controlled phase must require approval.
- Do not include autonomous deployment, production code execution, billing, sales, or customer-facing automation in v0.1.
- Return JSON only.
```

### Task Generation Agent Template

```text
Agent: TaskGenerationAgent
Prompt version: task_generation.v1

Objective:
Generate GitHub-ready task records from an approved SDLC plan.

Inputs:
{{sdlc_plan_artifact}}
{{product_plan_artifact}}
{{technical_constraints}}

Required output schema:
{{task_batch_schema}}

Rules:
- Every task must have acceptance criteria.
- Every task must have a type, priority, dependencies, and source artifact reference.
- Do not create tasks for production deployment, autonomous code execution, billing automation, or sales automation.
- Return JSON only.
```

### Technical Architecture Agent Template

```text
Agent: TechnicalArchitectureAgent
Prompt version: technical_architecture.v1

Objective:
Produce planning-level architecture assumptions and constraints.

Inputs:
{{project_brief_artifact}}
{{product_plan_artifact}}
{{known_repository_context_optional}}

Required output schema:
{{architecture_plan_schema}}

Rules:
- Distinguish verified facts from assumptions.
- Do not claim repository details unless repository context is provided.
- Identify risks, dependencies, and implementation boundaries.
- Return JSON only.
```

## 90-Day Founder Execution Plan

### Week 1

Objective: Establish foundation and eliminate ambiguity.

Build:

- Finalize PRD and execution blueprint
- Bootstrap monorepo
- Add TypeScript, linting, formatting, and testing
- Add shared contract package
- Add Docker Compose for PostgreSQL and Temporal
- Create initial Prisma schema

Founder decisions:

- Confirm auth provider
- Confirm hosting path
- Confirm first internal user workflow

### Week 2

Objective: Build the data and governance spine.

Build:

- Workspace service
- Artifact service
- Approval service
- Audit service
- Initial migrations
- API shell and error handling
- First API tests

Founder decisions:

- Confirm approval policy language
- Confirm audit retention expectations
- Confirm GitHub integration timing

### Week 3

Objective: Implement the first planning loop.

Build:

- Model provider abstraction
- Agent runtime
- Intake Agent
- Product Strategy Agent
- Intake workflow
- Product planning workflow
- Basic founder console screens

Founder decisions:

- Review first generated project briefs
- Review first product plans
- Approve prompt tone and artifact quality

### Month 2

Objective: Complete v0.1 internal prototype loop.

Build:

- SDLC Orchestration Agent
- Task Generation Agent
- Temporal workflow approval waits
- Task batch review UI
- Audit timeline UI
- Memory entries and pgvector indexing
- GitHub issue draft generation

Founder decisions:

- Approve internal prototype readiness
- Decide whether GitHub issue creation is enabled or draft-only
- Review task quality against real projects

### Month 3

Objective: Harden for controlled internal usage.

Build:

- GitHub issue creation behind explicit approval
- Observability
- Security hardening
- Staging deployment
- End-to-end tests
- Runbooks
- Internal alpha onboarding

Founder decisions:

- Select first internal alpha users
- Approve v0.1 positioning
- Decide v0.2 repository-aware planning scope

## Critical Failure Risks During Implementation

### Overengineering Risk

Risk: The team builds an enterprise platform before proving the core planning loop.

Mitigation:

- Ship the idea-to-approved-task-batch loop first
- Avoid unnecessary microservices
- Use PostgreSQL and pgvector before adding specialized infrastructure
- Keep integrations limited to GitHub issue drafts initially

### Premature Autonomy Risk

Risk: The system performs side effects before governance is reliable.

Mitigation:

- Disable production code execution and deployment
- Require approval IDs for GitHub issue creation
- Keep customer-facing automation out of v0.1
- Fail closed on missing approval

### Prompt Chaos Risk

Risk: Prompts evolve informally and produce inconsistent artifacts.

Mitigation:

- Version all prompts
- Pair each prompt with a JSON schema
- Store prompt version on every agent run
- Test agent outputs against fixtures

### Orchestration Complexity Risk

Risk: Temporal workflows become too complex too early.

Mitigation:

- Start with five workflows only
- Keep business rules in services where possible
- Use activities for side effects
- Document workflow state transitions

### Memory Corruption Risk

Risk: Draft, stale, or rejected artifacts contaminate canonical memory.

Mitigation:

- Separate draft and canonical memory
- Require approval references for canonical writes
- Version artifacts
- Surface conflicts instead of silently merging them

### Hallucinated State Transitions

Risk: Agents suggest or assume workflow state changes that did not occur.

Mitigation:

- Agents cannot mutate workflow state directly
- Workflow state transitions occur only through backend services
- Validate requested transitions against allowed state machines
- Log all state transitions

### Approval Bypass Risks

Risk: A route, worker, or integration path creates controlled side effects without approval.

Mitigation:

- Centralize approval checks
- Require approval verification inside activities before side effects
- Add tests for forbidden transitions
- Use idempotency keys and audit records for GitHub creation

## Operational Readiness Checklist

- Monorepo builds from clean checkout
- Local Docker environment starts reliably
- Database migrations are reversible during prototype phase
- API validates all inputs
- Agent outputs validate before persistence
- Audit logs are written for controlled actions
- Approval gates block downstream workflows
- GitHub creation is disabled unless explicitly approved
- Frontend exposes artifact status and approval state clearly
- Workflow failures are visible and retryable
- Environment variables are documented
- Internal runbook exists

