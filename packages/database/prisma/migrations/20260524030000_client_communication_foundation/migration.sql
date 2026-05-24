CREATE TABLE "client_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "client_profile_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "need_summary" TEXT NOT NULL,
  "budget_range" TEXT,
  "urgency" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "owner_agent_role" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "client_profile_id" UUID NOT NULL,
  "agent_role" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "approval_required" BOOLEAN NOT NULL DEFAULT true,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "client_profile_id" UUID NOT NULL,
  "requested_by_agent_role" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "proposed_time" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "consent_required" BOOLEAN NOT NULL DEFAULT true,
  "external_join_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meeting_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_profiles_workspace_id_status_idx" ON "client_profiles"("workspace_id", "status");
CREATE INDEX "client_leads_workspace_id_stage_idx" ON "client_leads"("workspace_id", "stage");
CREATE INDEX "client_leads_workspace_id_client_profile_id_idx" ON "client_leads"("workspace_id", "client_profile_id");
CREATE INDEX "client_conversations_workspace_id_visibility_idx" ON "client_conversations"("workspace_id", "visibility");
CREATE INDEX "client_conversations_workspace_id_channel_idx" ON "client_conversations"("workspace_id", "channel");
CREATE INDEX "client_conversations_workspace_id_client_profile_id_idx" ON "client_conversations"("workspace_id", "client_profile_id");
CREATE INDEX "meeting_requests_workspace_id_status_idx" ON "meeting_requests"("workspace_id", "status");
CREATE INDEX "meeting_requests_workspace_id_client_profile_id_idx" ON "meeting_requests"("workspace_id", "client_profile_id");

ALTER TABLE "client_profiles"
  ADD CONSTRAINT "client_profiles_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_leads"
  ADD CONSTRAINT "client_leads_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_leads"
  ADD CONSTRAINT "client_leads_client_profile_id_fkey"
  FOREIGN KEY ("client_profile_id") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_conversations"
  ADD CONSTRAINT "client_conversations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_conversations"
  ADD CONSTRAINT "client_conversations_client_profile_id_fkey"
  FOREIGN KEY ("client_profile_id") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meeting_requests"
  ADD CONSTRAINT "meeting_requests_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meeting_requests"
  ADD CONSTRAINT "meeting_requests_client_profile_id_fkey"
  FOREIGN KEY ("client_profile_id") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
