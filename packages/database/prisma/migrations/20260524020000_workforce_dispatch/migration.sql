CREATE TABLE "workforce_dispatches" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id"),
  "task_id" UUID NOT NULL,
  "assigned_agent_id" TEXT NOT NULL,
  "assigned_agent_role" TEXT NOT NULL,
  "assignment_reason" TEXT NOT NULL,
  "estimated_complexity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "workforce_dispatches_workspace_task_unique" ON "workforce_dispatches"("workspace_id", "task_id");
CREATE INDEX "workforce_dispatches_workspace_status_idx" ON "workforce_dispatches"("workspace_id", "status");
CREATE INDEX "workforce_dispatches_workspace_agent_idx" ON "workforce_dispatches"("workspace_id", "assigned_agent_id");
