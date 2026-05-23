CREATE TABLE "codex_execution_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "contract_artifact_id" UUID NOT NULL,
  "source_git_execution_plan_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "branch_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "allowed_files" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "forbidden_files" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowed_commands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "forbidden_commands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "required_tests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "execution_logs" JSONB NOT NULL DEFAULT '[]',
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),

  CONSTRAINT "codex_execution_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "codex_execution_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "codex_execution_runs_idempotency_key_key"
  ON "codex_execution_runs"("idempotency_key");

CREATE INDEX "codex_execution_runs_workspace_id_contract_artifact_id_idx"
  ON "codex_execution_runs"("workspace_id", "contract_artifact_id");

CREATE INDEX "codex_execution_runs_workspace_id_status_idx"
  ON "codex_execution_runs"("workspace_id", "status");
