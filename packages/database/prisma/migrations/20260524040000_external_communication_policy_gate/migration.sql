CREATE TABLE "external_communication_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "client_profile_id" UUID,
  "lead_id" UUID,
  "allowed_channel" TEXT NOT NULL,
  "consent_state" TEXT NOT NULL,
  "client_approved" BOOLEAN NOT NULL DEFAULT false,
  "lead_approved" BOOLEAN NOT NULL DEFAULT false,
  "owner_approval_required" BOOLEAN NOT NULL DEFAULT true,
  "audit_required" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_communication_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "external_communication_policies_workspace_id_allowed_channel_idx"
  ON "external_communication_policies"("workspace_id", "allowed_channel");

CREATE INDEX "external_communication_policies_workspace_id_client_profile_id_idx"
  ON "external_communication_policies"("workspace_id", "client_profile_id");

CREATE INDEX "external_communication_policies_workspace_id_lead_id_idx"
  ON "external_communication_policies"("workspace_id", "lead_id");

ALTER TABLE "external_communication_policies"
  ADD CONSTRAINT "external_communication_policies_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
