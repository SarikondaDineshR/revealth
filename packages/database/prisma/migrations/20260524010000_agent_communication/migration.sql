CREATE TABLE "agent_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "agent_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "current_task" TEXT NOT NULL,
  "assigned_artifact_id" UUID,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "agent_id" TEXT NOT NULL,
  "agent_role" TEXT NOT NULL,
  "message_type" TEXT NOT NULL,
  "related_artifact_id" UUID,
  "related_workflow_run_id" UUID,
  "visibility" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_assignments_workspace_id_status_idx" ON "agent_assignments"("workspace_id", "status");
CREATE INDEX "agent_assignments_workspace_id_agent_id_idx" ON "agent_assignments"("workspace_id", "agent_id");
CREATE INDEX "agent_messages_workspace_id_visibility_idx" ON "agent_messages"("workspace_id", "visibility");
CREATE INDEX "agent_messages_workspace_id_message_type_idx" ON "agent_messages"("workspace_id", "message_type");
CREATE INDEX "agent_messages_workspace_id_agent_id_idx" ON "agent_messages"("workspace_id", "agent_id");

ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_assigned_artifact_id_fkey"
  FOREIGN KEY ("assigned_artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_related_artifact_id_fkey"
  FOREIGN KEY ("related_artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_related_workflow_run_id_fkey"
  FOREIGN KEY ("related_workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
