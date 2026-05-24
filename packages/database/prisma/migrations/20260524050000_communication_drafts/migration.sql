CREATE TABLE "communication_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "client_profile_id" UUID NOT NULL,
  "lead_id" UUID,
  "script_artifact_id" UUID,
  "channel" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "policy_evaluation_json" JSONB NOT NULL,
  "created_by_agent_role" TEXT NOT NULL,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communication_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "communication_drafts_workspace_id_status_idx" ON "communication_drafts"("workspace_id", "status");
CREATE INDEX "communication_drafts_workspace_id_client_profile_id_idx" ON "communication_drafts"("workspace_id", "client_profile_id");
CREATE INDEX "communication_drafts_workspace_id_lead_id_idx" ON "communication_drafts"("workspace_id", "lead_id");

ALTER TABLE "communication_drafts"
  ADD CONSTRAINT "communication_drafts_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "communication_drafts"
  ADD CONSTRAINT "communication_drafts_client_profile_id_fkey"
  FOREIGN KEY ("client_profile_id") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
