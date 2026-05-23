import { describe, expect, it } from "vitest";
import {
  assertApprovedCodexTaskPacketBatch,
  buildGitExecutionPlan,
  buildPrBodyDraft,
  resolveCodexPacketId,
} from "./git-execution-plan-planner.js";

const packet = {
  codexTaskPacketId: "codex-packet-49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
  taskId: "49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
  sourceArtifactLineage: {
    sourceTaskBatchArtifactId: "fda3ab9a-0869-4881-a81b-36e42cf82a47",
    sourceTaskBatchApprovalId: "2844a5ad-9c15-4a37-8e18-4962b3c4dd36",
    sourceWorkflowRunId: "25c6d4ca-f702-4f71-ac0f-cd2044c8cd91",
    parentArtifactId: "5a1b3e62-82ae-4721-ab0d-d173e52947d2",
    sourceArtifactIds: ["5a1b3e62-82ae-4721-ab0d-d173e52947d2"],
  },
  businessObjective: "Persist lineage metadata for downstream artifacts.",
  technicalObjective: "Implement the feature task: Implement approval-gated artifact lineage.",
  filesLikelyInvolved: ["apps/api/src/services/**/*.ts"],
  implementationConstraints: ["Do not begin code changes until approved."],
  acceptanceCriteria: ["Lineage metadata is persisted."],
  testExpectations: ["Run API typecheck.", "Run API tests."],
  branchNameRecommendation: "codex/feature-implement-approval-gated-artifact-lineage",
  prTitleRecommendation: "Implement approval-gated artifact lineage",
  rollbackNotes: "Revert only the implementation commits.",
  securityNotes: ["Do not commit secrets."],
};

const batch = {
  schemaVersion: "revealth.codex_task_packet_batch.v1" as const,
  codexTaskPacketBatchId: "47c1a8cb-5825-4543-91e0-fb3799852b52",
  sourceTaskBatchArtifactId: "fda3ab9a-0869-4881-a81b-36e42cf82a47",
  packets: [packet],
  approvalRequired: true as const,
  executionAllowed: false as const,
  branchCreationAllowed: false as const,
  pullRequestCreationAllowed: false as const,
  sourceIds: ["fda3ab9a-0869-4881-a81b-36e42cf82a47"],
};

describe("Git execution plan planner", () => {
  it("requires approved codex task packet batches", () => {
    expect(() =>
      assertApprovedCodexTaskPacketBatch({ artifactType: "codex_task_packet_batch", status: "pending_approval" }),
    ).toThrow("must be approved");
    expect(() => assertApprovedCodexTaskPacketBatch({ artifactType: "task_batch", status: "approved" })).toThrow(
      "codex_task_packet_batch",
    );
    expect(() =>
      assertApprovedCodexTaskPacketBatch({ artifactType: "codex_task_packet_batch", status: "approved" }),
    ).not.toThrow();
  });

  it("uses packet ids when present and derives stable ids for legacy packets", () => {
    expect(resolveCodexPacketId({ packet, batch })).toBe(packet.codexTaskPacketId);
    expect(resolveCodexPacketId({ packet: { ...packet, codexTaskPacketId: undefined }, batch })).toBe(
      `${"codex-packet"}-${batch.codexTaskPacketBatchId}-${packet.taskId}`,
    );
  });

  it("builds a PR body draft from packet governance details", () => {
    const body = buildPrBodyDraft(packet);

    expect(body).toContain("## Objective");
    expect(body).toContain("Lineage metadata is persisted.");
    expect(body).toContain("Do not commit secrets.");
  });

  it("generates inert Git plans from approved packet batches", () => {
    const plan = buildGitExecutionPlan({
      batch,
      sourceCodexTaskPacketBatchArtifactId: "47c1a8cb-5825-4543-91e0-fb3799852b52",
      requiredReviewers: ["human-owner"],
    });

    expect(plan.schemaVersion).toBe("revealth.git_execution_plan.v1");
    expect(plan.plans).toHaveLength(1);
    expect(plan.branchCreationAllowed).toBe(false);
    expect(plan.pullRequestCreationAllowed).toBe(false);
    expect(plan.codeExecutionAllowed).toBe(false);
    expect(plan.plans[0]?.mergeGateChecklist).toContain("Human owner approves the pull request before merge.");
  });
});
