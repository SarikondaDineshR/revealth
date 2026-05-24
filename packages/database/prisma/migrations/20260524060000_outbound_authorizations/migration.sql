CREATE TABLE "outbound_authorizations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "communication_draft_id" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "consent_state" TEXT NOT NULL,
  "owner_approval_id" UUID NOT NULL,
  "policy_evaluation_json" JSONB NOT NULL,
  "external_send_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbound_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbound_authorizations_workspace_id_status_idx"
  ON "outbound_authorizations"("workspace_id", "status");

CREATE INDEX "outbound_authorizations_workspace_id_communication_draft_id_idx"
  ON "outbound_authorizations"("workspace_id", "communication_draft_id");

ALTER TABLE "outbound_authorizations"
  ADD CONSTRAINT "outbound_authorizations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "outbound_authorizations"
  ADD CONSTRAINT "outbound_authorizations_communication_draft_id_fkey"
  FOREIGN KEY ("communication_draft_id") REFERENCES "communication_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
