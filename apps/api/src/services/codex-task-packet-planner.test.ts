import { describe, expect, it } from "vitest";
import {
  assertApprovedTaskBatch,
  buildCodexTaskPacketBatch,
  inferLikelyFiles,
  recommendBranchName,
} from "./codex-task-packet-planner.js";

const task = {
  taskId: "49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
  title: "Implement approval-gated artifact lineage",
  description: "Persist lineage metadata for downstream artifacts and block invalid workflow chaining.",
  type: "feature" as const,
  priority: "p1" as const,
  dependencies: [],
  acceptanceCriteria: ["Lineage metadata is persisted.", "Invalid workflow chaining is blocked."],
  approvalRequired: true as const,
  sourceArtifactId: "fda3ab9a-0869-4881-a81b-36e42cf82a47",
};

describe("Codex task packet planner", () => {
  it("requires approved task batches", () => {
    expect(() => assertApprovedTaskBatch({ artifactType: "task_batch", status: "pending_approval" })).toThrow(
      "must be approved",
    );
    expect(() => assertApprovedTaskBatch({ artifactType: "github_issue_batch", status: "approved" })).toThrow(
      "task_batch",
    );
    expect(() => assertApprovedTaskBatch({ artifactType: "task_batch", status: "approved" })).not.toThrow();
  });

  it("recommends a scoped Codex branch name", () => {
    expect(recommendBranchName(task)).toBe("codex/feature-implement-approval-gated-artifact-lineage");
  });

  it("infers likely repository files from task content", () => {
    expect(inferLikelyFiles(task)).toEqual(
      expect.arrayContaining([
        "apps/workers/src/workflows/**/*.ts",
        "apps/workers/src/activities/**/*.ts",
        "packages/database/prisma/schema.prisma",
      ]),
    );
  });

  it("generates one packet per approved task with execution disabled", () => {
    const batch = buildCodexTaskPacketBatch({
      taskBatch: {
        schemaVersion: "revealth.task_batch.v1",
        taskBatchId: "fda3ab9a-0869-4881-a81b-36e42cf82a47",
        tasks: [task],
        sourceIds: ["5a1b3e62-82ae-4721-ab0d-d173e52947d2"],
      },
      sourceTaskBatchArtifactId: "fda3ab9a-0869-4881-a81b-36e42cf82a47",
      sourceTaskBatchApprovalId: "2844a5ad-9c15-4a37-8e18-4962b3c4dd36",
      sourceWorkflowRunId: "25c6d4ca-f702-4f71-ac0f-cd2044c8cd91",
      parentArtifactId: "5a1b3e62-82ae-4721-ab0d-d173e52947d2",
      sourceArtifactIds: ["5a1b3e62-82ae-4721-ab0d-d173e52947d2"],
    });

    expect(batch.schemaVersion).toBe("revealth.codex_task_packet_batch.v1");
    expect(batch.packets).toHaveLength(1);
    expect(batch.executionAllowed).toBe(false);
    expect(batch.branchCreationAllowed).toBe(false);
    expect(batch.pullRequestCreationAllowed).toBe(false);
    expect(batch.packets[0]?.sourceArtifactLineage.sourceTaskBatchApprovalId).toBe(
      "2844a5ad-9c15-4a37-8e18-4962b3c4dd36",
    );
  });
});
