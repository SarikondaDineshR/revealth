import { describe, expect, it } from "vitest";
import { buildWorkforceScalingPlan, estimateProjectComplexity } from "./workforce-scaling-planner.js";
import { WorkforceScalingPlanService } from "./workforce-scaling-plan-service.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskBatchArtifactId = "22222222-2222-4222-8222-222222222222";
const approvalId = "33333333-3333-4333-8333-333333333333";

const taskBatch = {
  schemaVersion: "revealth.task_batch.v1" as const,
  taskBatchId: "44444444-4444-4444-8444-444444444444",
  sourceIds: [],
  tasks: [
    {
      taskId: "55555555-5555-4555-8555-555555555555",
      title: "Build dashboard UI",
      description: "Create a frontend dashboard screen for owner review.",
      type: "feature" as const,
      priority: "p1" as const,
      dependencies: [],
      acceptanceCriteria: ["Dashboard renders useful status."],
      approvalRequired: true as const,
      sourceArtifactId: taskBatchArtifactId,
    },
    {
      taskId: "66666666-6666-4666-8666-666666666666",
      title: "Add API service",
      description: "Add backend service validation and tests.",
      type: "test" as const,
      priority: "p2" as const,
      dependencies: [],
      acceptanceCriteria: ["Service validates requests."],
      approvalRequired: true as const,
      sourceArtifactId: taskBatchArtifactId,
    },
  ],
};

function createDb() {
  const state = {
    artifacts: [] as Record<string, unknown>[],
    approvals: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  };
  const taskBatchArtifact = {
    id: taskBatchArtifactId,
    workspaceId,
    artifactType: "task_batch",
    version: 1,
    status: "approved",
    contentJson: taskBatch,
    sourceArtifactIds: [],
    parentArtifactId: null,
    sourceWorkflowRunId: null,
  };
  const db = {
    artifact: {
      findFirst: async ({ where }: { where: { id?: string; artifactType?: string; parentArtifactId?: string } }) => {
        if (where.id === taskBatchArtifactId) return taskBatchArtifact;
        if (where.artifactType === "workforce_scaling_plan" && where.parentArtifactId === taskBatchArtifactId) {
          return state.artifacts[0] ?? null;
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const artifact = { id: "77777777-7777-4777-8777-777777777777", ...data };
        state.artifacts.push(artifact);
        return artifact;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...state.artifacts[0], ...data }),
    },
    approval: {
      findFirst: async () => ({ id: approvalId }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const approval = { id: "88888888-8888-4888-8888-888888888888", ...data };
        state.approvals.push(approval);
        return approval;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.audits.push(data);
        return { id: `audit-${state.audits.length}`, ...data };
      },
    },
  };
  return { db, state };
}

describe("workforce scaling planner", () => {
  it("estimates complexity and recommends roles from task mix", () => {
    expect(estimateProjectComplexity(taskBatch)).toBe("small");
    const plan = buildWorkforceScalingPlan({ taskBatch, sourceTaskBatchArtifactId: taskBatchArtifactId });

    expect(plan.projectComplexity).toBe("small");
    expect(plan.requiredRoles.map((role: { role: string }) => role.role)).toEqual(
      expect.arrayContaining(["Product Manager Agent", "Frontend Developer Agent", "Backend Developer Agent", "QA Agent"]),
    );
    expect(plan.automaticAgentCreationAllowed).toBe(false);
  });
});

describe("WorkforceScalingPlanService", () => {
  it("creates a pending approval workforce scaling plan from an approved task batch", async () => {
    const { db, state } = createDb();
    const service = new WorkforceScalingPlanService(db as never);

    const artifact = await service.generateForApprovedTaskBatch({
      workspaceId,
      taskBatchArtifactId,
      actorId: "00000000-0000-4000-8000-000000000001",
    });

    expect(artifact.status).toBe("pending_approval");
    expect(state.approvals).toHaveLength(1);
    expect(state.audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["workforce_scaling_plan.generate.requested", "workforce_scaling_plan.generated"]),
    );
  });
});
