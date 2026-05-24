import { describe, expect, it } from "vitest";
import { WorkforceActivationService } from "./workforce-activation-service.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const planArtifactId = "22222222-2222-4222-8222-222222222222";
const approvalId = "33333333-3333-4333-8333-333333333333";

const planContent = {
  schemaVersion: "revealth.workforce_scaling_plan.v1",
  workforceScalingPlanId: "44444444-4444-4444-8444-444444444444",
  sourceTaskBatchArtifactId: "55555555-5555-4555-8555-555555555555",
  projectComplexity: "small",
  requiredRoles: [
    {
      role: "Frontend Developer Agent",
      recommendedAgentCount: 2,
      reason: "Prepare interface work.",
    },
    {
      role: "QA Agent",
      recommendedAgentCount: 1,
      reason: "Review acceptance criteria.",
    },
  ],
  assignmentStrategy: "Assign specialists after owner approval.",
  expectedBottlenecks: ["Owner approvals can pause progress."],
  humanReadableSummary: "This project needs a small expanded AI team.",
  approvalRequired: true,
  automaticAgentCreationAllowed: false,
  sourceIds: ["55555555-5555-4555-8555-555555555555"],
};

function createDb(input: { status?: string; existingAssignments?: Record<string, unknown>[] } = {}) {
  const state = {
    assignments: [...(input.existingAssignments ?? [])],
    audits: [] as Record<string, unknown>[],
  };
  const artifact = {
    id: planArtifactId,
    workspaceId,
    artifactType: "workforce_scaling_plan",
    version: 1,
    status: input.status ?? "approved",
    contentJson: planContent,
  };
  const db = {
    artifact: {
      findFirst: async () => artifact,
    },
    approval: {
      findFirst: async () => ({ id: approvalId }),
    },
    agentAssignment: {
      findMany: async () => state.assignments,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const assignment = {
          id: `66666666-6666-4666-8666-66666666666${state.assignments.length}`,
          ...data,
        };
        state.assignments.push(assignment);
        return assignment;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.audits.push(data);
        return { id: `audit-${state.audits.length}`, ...data };
      },
      findMany: async () => state.audits,
    },
  };
  return { db, state };
}

describe("WorkforceActivationService", () => {
  it("requires an approved workforce scaling plan", async () => {
    const { db } = createDb({ status: "pending_approval" });
    const service = new WorkforceActivationService(db as never);

    await expect(
      service.activateApprovedPlan({
        workspaceId,
        workforceScalingPlanArtifactId: planArtifactId,
        actorId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow("approved");
  });

  it("creates idempotent assignments from an approved plan", async () => {
    const { db, state } = createDb();
    const service = new WorkforceActivationService(db as never);

    const result = await service.activateApprovedPlan({
      workspaceId,
      workforceScalingPlanArtifactId: planArtifactId,
      actorId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.status).toBe("activated");
    expect(result.createdAssignments).toHaveLength(3);
    expect(state.audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["workforce.activation.requested", "workforce.activation.completed"]),
    );

    const second = await service.activateApprovedPlan({
      workspaceId,
      workforceScalingPlanArtifactId: planArtifactId,
      actorId: "00000000-0000-4000-8000-000000000001",
    });

    expect(second.status).toBe("skipped");
    expect(second.createdAssignments).toHaveLength(0);
    expect(state.assignments).toHaveLength(3);
    expect(state.audits.map((audit) => audit.action)).toContain("workforce.activation.skipped");
  });
});
