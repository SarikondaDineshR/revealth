CREATE TABLE "outbound_review_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "communication_draft_id" UUID NOT NULL,
    "outbound_authorization_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "consent_state" TEXT NOT NULL,
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_human_action" TEXT NOT NULL,
    "next_safe_step" TEXT NOT NULL,
    "policy_evaluation_json" JSONB NOT NULL,
    "external_send_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_review_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbound_review_packages_workspace_id_outbound_authorization_id_key" ON "outbound_review_packages"("workspace_id", "outbound_authorization_id");
CREATE INDEX "outbound_review_packages_workspace_id_status_idx" ON "outbound_review_packages"("workspace_id", "status");
CREATE INDEX "outbound_review_packages_workspace_id_communication_draft_id_idx" ON "outbound_review_packages"("workspace_id", "communication_draft_id");

ALTER TABLE "outbound_review_packages" ADD CONSTRAINT "outbound_review_packages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_review_packages" ADD CONSTRAINT "outbound_review_packages_communication_draft_id_fkey" FOREIGN KEY ("communication_draft_id") REFERENCES "communication_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_review_packages" ADD CONSTRAINT "outbound_review_packages_outbound_authorization_id_fkey" FOREIGN KEY ("outbound_authorization_id") REFERENCES "outbound_authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
