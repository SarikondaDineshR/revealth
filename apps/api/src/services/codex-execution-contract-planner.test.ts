import { describe, expect, it } from "vitest";
import {
  assertApprovedGitExecutionPlan,
  buildCodexExecutionContract,
  buildCodexExecutionContractItem,
  inferAllowedPaths,
} from "./codex-execution-contract-planner.js";

const planItem = {
  sourceCodexPacketId: "codex-packet-49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
  sourceTaskId: "49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
  branchName: "codex/feature-implement-approval-gated-artifact-lineage",
  commitStrategy: "Use one focused implementation commit.",
  prTitle: "Implement approval-gated artifact lineage",
  prBodyDraft: "## Technical Plan\nUpdate API services, workflow validation, database schema, and contracts.",
  requiredTests: ["Run API typecheck.", "Run API tests."],
  requiredReviewers: ["human-owner"],
  rollbackPlan: "Revert only the implementation commits.",
  mergeGateChecklist: ["Human owner approves the pull request before merge."],
};

const gitPlan = {
  schemaVersion: "revealth.git_execution_plan.v1" as const,
  gitExecutionPlanId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
  sourceCodexTaskPacketBatchArtifactId: "47c1a8cb-5825-4543-91e0-fb3799852b52",
  plans: [planItem],
  approvalRequired: true as const,
  branchCreationAllowed: false as const,
  pullRequestCreationAllowed: false as const,
  codeExecutionAllowed: false as const,
  sourceIds: ["47c1a8cb-5825-4543-91e0-fb3799852b52"],
};

describe("Codex execution contract planner", () => {
  it("requires approved git execution plans", () => {
    expect(() => assertApprovedGitExecutionPlan({ artifactType: "git_execution_plan", status: "pending_approval" })).toThrow(
      "must be approved",
    );
    expect(() => assertApprovedGitExecutionPlan({ artifactType: "codex_task_packet_batch", status: "approved" })).toThrow(
      "git_execution_plan",
    );
    expect(() => assertApprovedGitExecutionPlan({ artifactType: "git_execution_plan", status: "approved" })).not.toThrow();
  });

  it("infers exact allowed directories from plan text", () => {
    expect(inferAllowedPaths(planItem)).toEqual(
      expect.arrayContaining(["apps/api/src/", "packages/database/prisma/", "packages/contracts/src/"]),
    );
  });

  it("builds strict command and secret handling constraints", () => {
    const contract = buildCodexExecutionContractItem({
      plan: planItem,
      sourceGitExecutionPlanId: gitPlan.gitExecutionPlanId,
      maxExecutionScope: "single approved Git execution plan only",
    });

    expect(contract.allowedCommands).toContain("corepack pnpm --filter @revealth/api test");
    expect(contract.forbiddenCommands).toContain("git push");
    expect(contract.forbiddenFiles).toContain(".env");
    expect(contract.secretHandlingRules.join(" ")).toContain("Do not read");
  });

  it("generates an inert approval-gated execution contract", () => {
    const contract = buildCodexExecutionContract({
      plan: gitPlan,
      sourceGitExecutionPlanArtifactId: gitPlan.gitExecutionPlanId,
      maxExecutionScope: "single approved Git execution plan only",
    });

    expect(contract.schemaVersion).toBe("revealth.codex_execution_contract.v1");
    expect(contract.contracts).toHaveLength(1);
    expect(contract.approvalRequired).toBe(true);
    expect(contract.codeExecutionAllowed).toBe(false);
    expect(contract.branchCreationAllowed).toBe(false);
    expect(contract.pullRequestCreationAllowed).toBe(false);
  });
});
