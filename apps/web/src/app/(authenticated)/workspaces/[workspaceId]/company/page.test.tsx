import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ControlPlaneDashboard } from "../../../../../lib/api-client";
import { CompanyCommandCenterView } from "./company-command-center-view";

const dashboard: ControlPlaneDashboard = {
  workspace: {
    id: "workspace-1",
    name: "Demo Workspace",
    status: "active",
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z",
  },
  services: {
    api: { status: "ok" },
    executor: { status: "ok" },
    temporal: { status: "configured", address: "temporal:7233", namespace: "default", taskQueue: "revealth-v01" },
  },
  readiness: {
    executionMode: "dry_run",
    repoClean: true,
    currentBranch: "codex/demo",
    protectedBranchWarning: null,
    repoStatus: {
      status: "ok",
      data: {
        currentBranch: "codex/demo",
        isClean: true,
        changedFiles: [],
        untrackedFiles: [],
        stagedFiles: [],
        warning: null,
        recommendedNextAction: "Ready.",
      },
    },
    latestPreflightStatus: "passed",
    latestPreflightErrorCode: null,
    readyForLiveExecution: false,
  },
  lineage: [],
  workflowRuns: [{ id: "workflow-1", workflowType: "intake", status: "completed", inputJson: {}, outputJson: {}, createdAt: "2026-05-24T00:00:00.000Z", completedAt: "2026-05-24T00:00:01.000Z" }],
  workflowStatusCounts: { completed: 1 },
  artifacts: [{ id: "artifact-1", workspaceId: "workspace-1", artifactType: "project_brief", version: 1, status: "approved", schemaVersion: "v1", contentJson: {}, createdAt: "2026-05-24T00:00:00.000Z" }],
  artifactStatusCounts: { approved: 1 },
  approvals: [{ id: "approval-1", artifactId: "artifact-2", artifactVersion: 1, status: "pending", createdAt: "2026-05-24T00:00:00.000Z" }],
  approvalStatusCounts: { pending: 1 },
  executionRuns: [],
  executionRunStatusCounts: {},
  auditEvents: [{ id: "audit-1", action: "workflow.started", actorType: "system", actorId: "worker", status: "success", eventJson: {}, createdAt: "2026-05-24T00:00:00.000Z" }],
  branchPreparationPlans: [],
  workforceScalingPlans: [],
  githubIssues: [],
  agentAssignments: [
    { id: "assignment-1", workspaceId: "workspace-1", agentId: "product_manager", role: "Product Manager Agent", currentTask: "Planning your project", assignedArtifactId: null, status: "working", startedAt: "2026-05-24T00:00:00.000Z", completedAt: null },
    { id: "assignment-2", workspaceId: "workspace-1", agentId: "backend_developer", role: "Backend Developer Agent", currentTask: "Reviewing API tasks", assignedArtifactId: null, status: "working", startedAt: "2026-05-24T00:00:00.000Z", completedAt: null },
  ],
  activatedWorkforceAssignments: [],
  agentMessages: [
    { id: "message-1", workspaceId: "workspace-1", agentId: "product_manager", agentRole: "Product Manager Agent", messageType: "update", relatedArtifactId: null, relatedWorkflowRunId: null, visibility: "client_visible", message: "We are reviewing the project plan.", createdAt: "2026-05-24T00:00:00.000Z" },
    { id: "message-2", workspaceId: "workspace-1", agentId: "qa", agentRole: "QA Agent", messageType: "review", relatedArtifactId: null, relatedWorkflowRunId: null, visibility: "internal", message: "Checking acceptance criteria.", createdAt: "2026-05-24T00:00:00.000Z" },
  ],
  clientVisibleAgentMessages: [
    { id: "message-1", workspaceId: "workspace-1", agentId: "product_manager", agentRole: "Product Manager Agent", messageType: "update", relatedArtifactId: null, relatedWorkflowRunId: null, visibility: "client_visible", message: "We are reviewing the project plan.", createdAt: "2026-05-24T00:00:00.000Z" },
  ],
  workforceDispatches: [
    { id: "dispatch-1", workspaceId: "workspace-1", taskId: "11111111-1111-4111-8111-111111111111", assignedAgentId: "backend_developer", assignedAgentRole: "Backend Developer Agent", assignmentReason: "Reviewing API integration requirements", estimatedComplexity: "medium", status: "in_progress", startedAt: "2026-05-24T00:00:00.000Z", completedAt: null },
  ],
  workforceDispatchStatusCounts: { in_progress: 1 },
  recentWorkforceHandoffs: [],
  clients: [],
  leads: [],
  leadStageCounts: {},
  clientConversations: [],
  clientVisibleConversations: [{ id: "conversation-1", workspaceId: "workspace-1", clientProfileId: "client-1", agentRole: "Sales Agent", channel: "simulated_chat", visibility: "client_visible", message: "Client-safe update is ready for review.", approvalRequired: true, approvedAt: null, createdAt: "2026-05-24T00:00:00.000Z" }],
  meetingRequests: [],
  meetingRequestStatusCounts: {},
  clientCommunicationScripts: [],
  externalCommunicationPolicies: [],
  latestExternalCommunicationPolicyEvaluation: null,
  communicationDrafts: [],
  communicationDraftStatusCounts: {},
  outboundAuthorizations: [],
  outboundAuthorizationStatusCounts: {},
  outboundReviewPackages: [{ id: "review-package-1", workspaceId: "workspace-1", communicationDraftId: "draft-1", outboundAuthorizationId: "authorization-1", status: "ready_for_human_review", summary: "Review package", consentState: "unknown", blockers: ["external_send_disabled"], requiredHumanAction: "Owner reviews package.", nextSafeStep: "Keep the approved draft internal.", policyEvaluationJson: {}, externalSendEnabled: false, createdAt: "2026-05-24T00:00:00.000Z" }],
  outboundReviewPackageStatusCounts: { ready_for_human_review: 1 },
};

describe("CompanyCommandCenterView", () => {
  it("renders a non-technical AI company command center", () => {
    const html = renderToStaticMarkup(<CompanyCommandCenterView dashboard={dashboard} workspaceId="workspace-1" />);

    expect(html).toContain("Revealth AI Company Command Center");
    expect(html).toContain("Project Journey");
    expect(html).toContain("AI Team");
    expect(html).toContain("Current Work");
    expect(html).toContain("Team Discussion");
    expect(html).toContain("Client Updates");
    expect(html).toContain("Approvals Needed");
    expect(html).toContain("Next Safe Step");
    expect(html).toContain("Idea Received");
    expect(html).toContain("Ready for Approval");
    expect(html).toContain("CEO Agent");
    expect(html).toContain("CTO Agent");
    expect(html).toContain("Backend Developer Agent");
    expect(html).toContain("Waiting for owner approval");
    expect(html).toContain("Work has been divided between agents");
    expect(html).toContain("Project starts in planning");
    expect(html).toContain("Paused for approval");
    expect(html).toContain("2 minutes ago");
    expect(html).toContain("review requested");
    expect(html).toContain("No external communication, code execution, branches, pull requests, calls, or meetings");
  });
});
