ALTER TABLE "github_connections"
  ALTER COLUMN "installation_id" DROP NOT NULL,
  ADD COLUMN "token_source" TEXT NOT NULL DEFAULT 'env',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "github_connections_workspace_id_repository_key"
  ON "github_connections"("workspace_id", "repository");

ALTER TABLE "github_issues"
  ADD COLUMN "source_artifact_id" UUID,
  ADD COLUMN "source_approval_id" UUID,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "github_node_id" TEXT,
  ADD COLUMN "dry_run" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "github_issues"
SET
  "source_artifact_id" = "task_id",
  "idempotency_key" = CONCAT("workspace_id"::TEXT, ':legacy:', "task_id"::TEXT, ':', "repository"),
  "title" = CONCAT('Legacy GitHub issue for task ', "task_id"::TEXT)
WHERE "source_artifact_id" IS NULL;

ALTER TABLE "github_issues"
  ALTER COLUMN "source_artifact_id" SET NOT NULL,
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL;

CREATE UNIQUE INDEX "github_issues_idempotency_key_key"
  ON "github_issues"("idempotency_key");

CREATE INDEX "github_issues_workspace_id_source_artifact_id_idx"
  ON "github_issues"("workspace_id", "source_artifact_id");

CREATE INDEX "github_issues_workspace_id_task_id_idx"
  ON "github_issues"("workspace_id", "task_id");
