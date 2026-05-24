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
    expect(html).toContain("Who Is Working On What");
    expect(html).toContain("Agent Communication Feed");
    expect(html).toContain("Client-visible Updates");
    expect(html).toContain("Product Manager Agent");
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
