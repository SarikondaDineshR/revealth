# Revealth v0.1 Development Standards

## Branching Strategy

- `main` is always deployable.
- Feature branches use `feat/<github-issue-number>-short-description`.
- Fix branches use `fix/<github-issue-number>-short-description`.
- Documentation branches use `docs/<github-issue-number>-short-description`.
- No code change should merge without a linked GitHub issue.

## Commit Conventions

Use Conventional Commits:

- `feat: add workspace creation API`
- `fix: enforce approval state transition`
- `chore: update prisma migration`
- `docs: add workflow runbook`
- `test: cover task batch schema validation`

## Migration Conventions

- One migration per coherent schema change.
- Migration names use `YYYYMMDDHHMMSS_description`.
- Migrations must be reviewed before staging deployment.
- Destructive migrations require a written rollback plan.
- Application code must tolerate mixed old/new data during prototype deploys.

## Schema Versioning Conventions

- Every persisted JSON artifact includes `schemaVersion`.
- Breaking schema changes increment the artifact schema suffix, for example `revealth.task_batch.v2`.
- Agents must declare the schema version they were asked to produce.
- Backend validation is the source of truth, not prompt instructions.

## Prompt Versioning Conventions

- Prompt IDs use `<agent>.<purpose>.v<number>`.
- Every `AgentRun` stores `promptVersion`, `modelProvider`, and `modelName`.
- Prompt changes that affect output shape require fixture tests.
- Prompts must forbid side effects unless the workflow explicitly allows them.

