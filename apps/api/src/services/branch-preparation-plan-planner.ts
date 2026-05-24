import { randomUUID } from "node:crypto";
import type { CodexExecutionRun } from "@prisma/client";
import type { BranchPreparationPlan, ExecutorRepoStatus } from "@revealth/contracts";

export function assertRunReadyForBranchPreparation(run: Pick<CodexExecutionRun, "status">): void {
  if (run.status !== "ready_for_live_execution") {
    throw Object.assign(new Error("Branch preparation requires a ready_for_live_execution run."), {
      statusCode: 409,
      code: "CODEX_EXECUTION_RUN_NOT_READY_FOR_LIVE_EXECUTION",
    });
  }
}

export function assertExecutorRepoReadyForBranchPreparation(repoStatus: ExecutorRepoStatus): void {
  if (!repoStatus.isClean) {
    throw Object.assign(new Error("Branch preparation requires a clean executor worktree."), {
      statusCode: 409,
      code: "CODEX_EXECUTOR_WORKTREE_NOT_CLEAN",
    });
  }
  if (repoStatus.currentBranch === "main" || repoStatus.currentBranch === "master") {
    throw Object.assign(new Error("Branch preparation cannot be generated from a protected branch."), {
      statusCode: 409,
      code: "CODEX_EXECUTOR_ON_PROTECTED_BRANCH",
    });
  }
}

export function buildBranchPreparationPlan(input: {
  run: Pick<
    CodexExecutionRun,
    "id" | "contractArtifactId" | "branchName" | "allowedFiles" | "requiredTests"
  >;
  repoStatus: ExecutorRepoStatus;
}): BranchPreparationPlan {
  const protectedBranchWarning =
    input.repoStatus.currentBranch === "main" || input.repoStatus.currentBranch === "master"
      ? "Protected base branch detected. Branch creation must not proceed from this branch."
      : null;

  return {
    schemaVersion: "revealth.branch_preparation_plan.v1",
    branchPreparationPlanId: randomUUID(),
    sourceRunId: input.run.id,
    sourceContractId: input.run.contractArtifactId,
    recommendedBranchName: input.run.branchName,
    baseBranch: input.repoStatus.currentBranch,
    branchCreationCommandPreview: `git switch -c ${input.run.branchName} ${input.repoStatus.currentBranch}`,
    rollbackCommandPreview: `git switch ${input.repoStatus.currentBranch} && git branch -D ${input.run.branchName}`,
    protectedBranchWarning,
    allowedFilesSummary: input.run.allowedFiles,
    requiredTestsSummary: input.run.requiredTests,
    approvalRequirements: [
      "Human owner must approve this branch preparation plan before any branch creation is allowed.",
      "Branch creation remains disabled in v0.1 until a separate live execution implementation is approved.",
      "No code execution, pull request creation, or external side effect is authorized by this plan.",
    ],
    approvalRequired: true,
    branchCreationAllowed: false,
    codeExecutionAllowed: false,
    pullRequestCreationAllowed: false,
    sourceIds: [input.run.contractArtifactId],
  };
}
