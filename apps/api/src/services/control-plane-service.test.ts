import { describe, expect, it } from "vitest";
import { buildGovernedLineage, ControlPlaneService, countByStatus } from "./control-plane-service.js";

function artifact(input: { id: string; artifactType: string; version: number; status: string; createdAt?: Date }) {
  return {
    id: input.id,
    artifactType: input.artifactType,
    version: input.version,
    status: input.status,
    createdAt: input.createdAt ?? new Date("2026-05-23T00:00:00.000Z"),
  } as never;
}

describe("control-plane service helpers", () => {
  it("counts statuses deterministically", () => {
    expect(countByStatus([{ status: "queued" }, { status: "queued" }, { status: "failed" }])).toEqual({
      queued: 2,
      failed: 1,
    });
  });

  it("builds governed lineage with latest artifact versions and execution run state", () => {
    const lineage = buildGovernedLineage(
      [
        artifact({ id: "brief-v1", artifactType: "project_brief", version: 1, status: "superseded" }),
        artifact({ id: "brief-v2", artifactType: "project_brief", version: 2, status: "approved" }),
        artifact({ id: "tasks", artifactType: "task_batch", version: 1, status: "pending_approval" }),
      ],
      [
        {
          id: "run-1",
          status: "ready_for_live_execution",
          createdAt: new Date("2026-05-23T00:00:00.000Z"),
        } as never,
      ],
    );

    expect(lineage.map((node) => node.key)).toEqual([
      "project_brief",
      "sdlc_plan",
      "task_batch",
      "github_issue_batch",
      "codex_task_packet_batch",
      "git_execution_plan",
      "codex_execution_contract",
      "execution_run",
    ]);
    expect(lineage[0]).toMatchObject({ artifactId: "brief-v2", status: "approved", version: 2 });
    expect(lineage[1]).toMatchObject({ artifactId: null, status: "missing" });
    expect(lineage[7]).toMatchObject({ artifactId: "run-1", status: "ready_for_live_execution" });
  });
});

describe("ControlPlaneService aggregation", () => {
  it("aggregates workspace operations, readiness, executor, and Temporal state", async () => {
    const workspace = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Demo",
      status: "active",
      createdAt: new Date("2026-05-23T00:00:00.000Z"),
      updatedAt: new Date("2026-05-23T00:00:00.000Z"),
    };
    const db = {
      workspace: { findUnique: async () => workspace },
      workflowRun: {
        findMany: async () => [{ id: "workflow-1", workflowType: "intake", status: "completed", createdAt: new Date() }],
      },
      artifact: {
        findMany: async () => [
          artifact({ id: "brief", artifactType: "project_brief", version: 1, status: "approved" }),
          artifact({ id: "branch-plan", artifactType: "branch_preparation_plan", version: 1, status: "pending_approval" }),
          artifact({ id: "workforce-plan", artifactType: "workforce_scaling_plan", version: 1, status: "pending_approval" }),
          artifact({ id: "client-script", artifactType: "client_communication_script", version: 1, status: "pending_approval" }),
        ],
      },
      approval: { findMany: async () => [{ id: "approval-1", status: "pending", createdAt: new Date() }] },
      codexExecutionRun: {
        findMany: async () => [
          { id: "run-1", status: "ready_for_live_execution", createdAt: new Date("2026-05-23T00:00:00.000Z") },
        ],
      },
      auditLog: {
        findMany: async () => [
          {
            id: "audit-1",
            action: "codex.execution_run.preflight.passed",
            status: "success",
            errorCode: null,
            createdAt: new Date(),
          },
          {
            id: "audit-2",
            action: "external_communication_policy.evaluated",
            status: "blocked",
            errorCode: null,
            createdAt: new Date(),
          },
        ],
      },
      gitHubIssue: { findMany: async () => [{ id: "issue-1", status: "dry_run", dryRun: true }] },
      agentAssignment: {
        findMany: async () => [
          {
            id: "assignment-1",
            agentId: "product_manager",
            role: "Product Manager Agent",
            currentTask: "Planning your project",
            status: "working",
            assignedArtifactId: null,
          },
          {
            id: "assignment-2",
            agentId: "qa",
            role: "QA Agent",
            currentTask: "Reviewing quality and acceptance criteria",
            status: "working",
            assignedArtifactId: "workforce-plan",
          },
        ],
      },
      agentMessage: {
        findMany: async () => [
          {
            id: "message-1",
            agentId: "product_manager",
            agentRole: "Product Manager Agent",
            messageType: "update",
            visibility: "client_visible",
            message: "Planning your project.",
          },
          {
            id: "message-2",
            agentId: "backend_developer",
            agentRole: "Backend Developer Agent",
            messageType: "handoff",
            visibility: "internal",
            message: "Backend Developer Agent handed off next review to QA Agent.",
          },
        ],
      },
      workforceDispatch: {
        findMany: async () => [
          {
            id: "dispatch-1",
            taskId: "task-1",
            assignedAgentId: "backend_developer",
            assignedAgentRole: "Backend Developer Agent",
            assignmentReason: "Best matched to API task.",
            estimatedComplexity: "medium",
            status: "in_progress",
            startedAt: new Date(),
            completedAt: null,
          },
        ],
      },
      clientProfile: {
        findMany: async () => [
          {
            id: "client-1",
            name: "Ada Lovelace",
            company: "Analytical Engines LLC",
            status: "lead",
            source: "demo",
            notes: "Demo client.",
          },
        ],
      },
      clientLead: {
        findMany: async () => [
          {
            id: "lead-1",
            clientProfileId: "client-1",
            title: "Password manager MVP",
            needSummary: "Needs safe planning before security implementation.",
            urgency: "medium",
            stage: "discovery",
            ownerAgentRole: "Sales Agent",
          },
        ],
      },
      clientConversation: {
        findMany: async () => [
          {
            id: "conversation-1",
            clientProfileId: "client-1",
            agentRole: "Sales Agent",
            channel: "simulated_chat",
            visibility: "client_visible",
            message: "Drafting a safe discovery update for approval.",
          },
        ],
      },
      meetingRequest: {
        findMany: async () => [
          {
            id: "meeting-1",
            clientProfileId: "client-1",
            requestedByAgentRole: "Customer Success Agent",
            purpose: "Simulated discovery review",
            status: "pending_approval",
            externalJoinEnabled: false,
          },
        ],
      },
      externalCommunicationPolicy: {
        findMany: async () => [
          {
            id: "policy-1",
            allowedChannel: "email_draft",
            consentState: "unknown",
            clientApproved: false,
            leadApproved: false,
            ownerApprovalRequired: true,
            auditRequired: true,
            status: "active",
            notes: "Blocked until consent and approvals exist.",
          },
        ],
      },
    };
    const service = new ControlPlaneService(
      db as never,
      {
        EXECUTOR_URL: "http://executor:4100",
        CODEX_EXECUTION_MODE: "dry_run",
        TEMPORAL_ADDRESS: "temporal:7233",
        TEMPORAL_NAMESPACE: "default",
        TEMPORAL_TASK_QUEUE: "revealth-v01",
      },
      {
        repoStatus: async () => ({
          currentBranch: "codex/demo",
          isClean: true,
          changedFiles: [],
          untrackedFiles: [],
          stagedFiles: [],
          warning: null,
          recommendedNextAction: "ready_for_preflight",
        }),
      },
      async () => ({ status: "ok", data: { service: "revealth-executor" } }),
    );

    const dashboard = await service.getWorkspaceDashboard(workspace.id);

    expect(dashboard.workspace.name).toBe("Demo");
    expect(dashboard.services.executor.status).toBe("ok");
    expect(dashboard.readiness.repoClean).toBe(true);
    expect(dashboard.readiness.readyForLiveExecution).toBe(true);
    expect(dashboard.readiness.latestPreflightStatus).toBe("passed");
    expect(dashboard.branchPreparationPlans).toHaveLength(1);
    expect(dashboard.workforceScalingPlans).toHaveLength(1);
    expect(dashboard.activatedWorkforceAssignments).toHaveLength(1);
    expect(dashboard.agentAssignments).toHaveLength(2);
    expect(dashboard.clientVisibleAgentMessages).toHaveLength(1);
    expect(dashboard.workforceDispatches).toHaveLength(1);
    expect(dashboard.workforceDispatchStatusCounts).toEqual({ in_progress: 1 });
    expect(dashboard.recentWorkforceHandoffs).toHaveLength(1);
    expect(dashboard.clients).toHaveLength(1);
    expect(dashboard.leads).toHaveLength(1);
    expect(dashboard.leadStageCounts).toEqual({ discovery: 1 });
    expect(dashboard.clientVisibleConversations).toHaveLength(1);
    expect(dashboard.meetingRequests).toHaveLength(1);
    expect(dashboard.meetingRequestStatusCounts).toEqual({ pending_approval: 1 });
    expect(dashboard.clientCommunicationScripts).toHaveLength(1);
    expect(dashboard.externalCommunicationPolicies).toHaveLength(1);
    expect(dashboard.latestExternalCommunicationPolicyEvaluation?.status).toBe("blocked");
    expect(dashboard.workflowStatusCounts).toEqual({ completed: 1 });
  });
});
