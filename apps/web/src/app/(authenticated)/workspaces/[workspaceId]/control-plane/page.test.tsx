import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ControlPlaneDashboard } from "../../../../../lib/api-client";
import { ControlPlaneDashboardView } from "./control-plane-view";

const dashboard: ControlPlaneDashboard = {
  workspace: {
    id: "workspace-1",
    name: "Revealth Demo Workspace",
    status: "active",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
  },
  services: {
    api: { status: "ok" },
    executor: { status: "ok" },
    temporal: {
      status: "ok",
      address: "temporal:7233",
      namespace: "default",
      taskQueue: "revealth-v01",
    },
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
        recommendedNextAction: "Run preflight.",
      },
    },
    latestPreflightStatus: "passed",
    latestPreflightErrorCode: null,
    readyForLiveExecution: true,
  },
  lineage: [
    {
      key: "project_brief",
      label: "project_brief",
      artifactId: "artifact-project-brief",
      status: "approved",
      version: 1,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
    {
      key: "codex_execution_contract",
      label: "codex_execution_contract",
      artifactId: "artifact-contract",
      status: "approved",
      version: 1,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  workflowRuns: [
    {
      id: "workflow-1",
      workflowType: "intake",
      status: "completed",
      inputJson: {},
      outputJson: {},
      createdAt: "2026-05-23T00:00:00.000Z",
      completedAt: "2026-05-23T00:00:01.000Z",
    },
  ],
  workflowStatusCounts: { completed: 1 },
  artifacts: [
    {
      id: "artifact-contract",
      artifactType: "codex_execution_contract",
      version: 1,
      status: "approved",
      schemaVersion: "1.0.0",
      contentJson: {},
      createdAt: "2026-05-23T00:00:00.000Z",
    },
    {
      id: "artifact-client-script",
      artifactType: "client_communication_script",
      version: 1,
      status: "pending_approval",
      schemaVersion: "revealth.client_communication_script.v1",
      contentJson: {
        targetClient: { name: "Ada Lovelace", company: "Analytical Engines LLC" },
        objective: "Prepare a safe discovery conversation.",
        externalCommunicationAllowed: false,
      },
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  artifactStatusCounts: { approved: 1 },
  approvals: [
    {
      id: "approval-1",
      artifactId: "artifact-contract",
      artifactVersion: 1,
      status: "approved",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  approvalStatusCounts: { approved: 1 },
  executionRuns: [
    {
      id: "run-1",
      contractArtifactId: "artifact-contract",
      sourceGitExecutionPlanId: "artifact-git-plan",
      branchName: "codex/demo",
      status: "completed_dry_run",
      allowedFiles: ["apps/api/src/**"],
      forbiddenFiles: [".env"],
      requiredTests: ["corepack pnpm --filter @revealth/api test"],
      executionWorkspaceManifestPath: ".revealth/execution-runs/run-1/manifest.json",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  executionRunStatusCounts: { completed_dry_run: 1 },
  auditEvents: [
    {
      id: "audit-1",
      action: "codex.execution_run.dry_run.completed",
      actorType: "system",
      actorId: "executor",
      status: "success",
      eventJson: {},
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  branchPreparationPlans: [],
  workforceScalingPlans: [
    {
      id: "artifact-workforce-plan",
      artifactType: "workforce_scaling_plan",
      version: 1,
      status: "pending_approval",
      schemaVersion: "revealth.workforce_scaling_plan.v1",
      contentJson: {
        projectComplexity: "medium",
        humanReadableSummary: "This looks like a medium project. Revealth recommends 5 AI team members.",
        requiredRoles: [
          {
            role: "Product Manager Agent",
            recommendedAgentCount: 1,
            reason: "Keeps the work tied to user outcomes.",
          },
        ],
        expectedBottlenecks: ["Owner approvals can pause progress."],
      },
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  githubIssues: [{ id: "issue-1", title: "Draft issue", status: "dry_run", dryRun: true, repository: "draft/repo" }],
  agentAssignments: [
    {
      id: "assignment-1",
      workspaceId: "workspace-1",
      agentId: "product_manager",
      role: "Product Manager Agent",
      currentTask: "Planning your project",
      assignedArtifactId: null,
      status: "working",
      startedAt: "2026-05-23T00:00:00.000Z",
      completedAt: null,
    },
  ],
  activatedWorkforceAssignments: [
    {
      id: "assignment-2",
      workspaceId: "workspace-1",
      agentId: "qa",
      role: "QA Agent",
      currentTask: "Reviewing quality and acceptance criteria",
      assignedArtifactId: "artifact-workforce-plan",
      status: "working",
      startedAt: "2026-05-23T00:00:00.000Z",
      completedAt: null,
    },
  ],
  agentMessages: [
    {
      id: "message-1",
      workspaceId: "workspace-1",
      agentId: "product_manager",
      agentRole: "Product Manager Agent",
      messageType: "update",
      relatedArtifactId: null,
      relatedWorkflowRunId: null,
      visibility: "client_visible",
      message: "Planning your project.",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  clientVisibleAgentMessages: [
    {
      id: "message-1",
      workspaceId: "workspace-1",
      agentId: "product_manager",
      agentRole: "Product Manager Agent",
      messageType: "update",
      relatedArtifactId: null,
      relatedWorkflowRunId: null,
      visibility: "client_visible",
      message: "Planning your project.",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  workforceDispatches: [
    {
      id: "dispatch-1",
      workspaceId: "workspace-1",
      taskId: "task-1",
      assignedAgentId: "backend_developer",
      assignedAgentRole: "Backend Developer Agent",
      assignmentReason: "Best matched to API task.",
      estimatedComplexity: "medium",
      status: "in_progress",
      startedAt: "2026-05-23T00:00:00.000Z",
      completedAt: null,
    },
  ],
  workforceDispatchStatusCounts: { in_progress: 1 },
  recentWorkforceHandoffs: [
    {
      id: "message-2",
      workspaceId: "workspace-1",
      agentId: "backend_developer",
      agentRole: "Backend Developer Agent",
      messageType: "handoff",
      relatedArtifactId: "artifact-task-batch",
      relatedWorkflowRunId: null,
      visibility: "internal",
      message: "Backend Developer Agent handed off next review to QA Agent.",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  clients: [
    {
      id: "client-1",
      workspaceId: "workspace-1",
      name: "Ada Lovelace",
      company: "Analytical Engines LLC",
      email: "ada@example.com",
      phone: null,
      status: "lead",
      source: "demo",
      notes: "Interested in governed software planning.",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  leads: [
    {
      id: "lead-1",
      workspaceId: "workspace-1",
      clientProfileId: "client-1",
      clientProfile: {
        id: "client-1",
        workspaceId: "workspace-1",
        name: "Ada Lovelace",
        company: "Analytical Engines LLC",
        email: "ada@example.com",
        phone: null,
        status: "lead",
        source: "demo",
        notes: "Interested in governed software planning.",
        createdAt: "2026-05-23T00:00:00.000Z",
      },
      title: "Password manager MVP",
      needSummary: "Needs safe planning before security implementation.",
      budgetRange: null,
      urgency: "medium",
      stage: "discovery",
      ownerAgentRole: "Sales Agent",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  leadStageCounts: { discovery: 1 },
  clientConversations: [
    {
      id: "conversation-1",
      workspaceId: "workspace-1",
      clientProfileId: "client-1",
      clientProfile: {
        id: "client-1",
        workspaceId: "workspace-1",
        name: "Ada Lovelace",
        company: "Analytical Engines LLC",
        email: "ada@example.com",
        phone: null,
        status: "lead",
        source: "demo",
        notes: "Interested in governed software planning.",
        createdAt: "2026-05-23T00:00:00.000Z",
      },
      agentRole: "Sales Agent",
      channel: "simulated_chat",
      visibility: "client_visible",
      message: "Drafting a safe discovery update for approval.",
      approvalRequired: true,
      approvedAt: null,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  clientVisibleConversations: [
    {
      id: "conversation-1",
      workspaceId: "workspace-1",
      clientProfileId: "client-1",
      agentRole: "Sales Agent",
      channel: "simulated_chat",
      visibility: "client_visible",
      message: "Drafting a safe discovery update for approval.",
      approvalRequired: true,
      approvedAt: null,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  meetingRequests: [
    {
      id: "meeting-1",
      workspaceId: "workspace-1",
      clientProfileId: "client-1",
      requestedByAgentRole: "Customer Success Agent",
      purpose: "Simulated discovery review",
      proposedTime: null,
      status: "pending_approval",
      consentRequired: true,
      externalJoinEnabled: false,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
  meetingRequestStatusCounts: { pending_approval: 1 },
  clientCommunicationScripts: [
    {
      id: "artifact-client-script",
      artifactType: "client_communication_script",
      version: 1,
      status: "pending_approval",
      schemaVersion: "revealth.client_communication_script.v1",
      contentJson: {
        targetClient: { name: "Ada Lovelace", company: "Analytical Engines LLC" },
        objective: "Prepare a safe discovery conversation.",
        externalCommunicationAllowed: false,
      },
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  ],
};

describe("ControlPlaneDashboardView", () => {
  it("renders the core operational sections and readiness indicators", () => {
    const html = renderToStaticMarkup(
      <ControlPlaneDashboardView dashboard={dashboard} workspaceId={dashboard.workspace.id} />,
    );

    expect(html).toContain("Control Plane");
    expect(html).toContain("Demo Status");
    expect(html).toContain("Readiness Summary");
    expect(html).toContain("Lineage");
    expect(html).toContain("AI Team");
    expect(html).toContain("Recommended AI Team Scaling");
    expect(html).toContain("Activated AI Team");
    expect(html).toContain("Live AI Work Dispatch");
    expect(html).toContain("Current Team Activity");
    expect(html).toContain("Recent Team Handoffs");
    expect(html).toContain("Client Pipeline");
    expect(html).toContain("Lead Discovery");
    expect(html).toContain("Client Communication Feed");
    expect(html).toContain("Meeting Requests");
    expect(html).toContain("Sales/Support Script Drafts");
    expect(html).toContain("Analytical Engines LLC");
    expect(html).toContain("No external joining");
    expect(html).toContain("QA Agent");
    expect(html).toContain("Who Is Working On What");
    expect(html).toContain("Agent Communication Feed");
    expect(html).toContain("Client-visible Updates");
    expect(html).toContain("Product Manager Agent");
    expect(html).toContain("This looks like a medium project");
    expect(html).toContain("Approval Queue");
    expect(html).toContain("Executor Health");
    expect(html).toContain("Temporal Workflow Status");
    expect(html).toContain("Execution Runs");
    expect(html).toContain("Execution Run Inspection");
    expect(html).toContain("Audit Timeline");
    expect(html).toContain("status:success");
    expect(html).toContain("ready_for_live_execution");
    expect(html).toContain("completed_dry_run");
    expect(html).toContain("demo smoke path complete");
  });
});
