import { describe, expect, it } from "vitest";
import type { ExecutorRepoStatus } from "@revealth/contracts";
import {
  assertExecutorRepoReadyForBranchPreparation,
  assertRunReadyForBranchPreparation,
  buildBranchPreparationPlan,
} from "./branch-preparation-plan-planner.js";
import { BranchPreparationPlanService } from "./branch-preparation-plan-service.js";

const workspaceId = "7c2eae1b-0f75-4f3e-9d29-9e816fb324f0";
const contractArtifactId = "a5d711bd-88a8-4826-b793-3b2fbad2d3d2";
const runId = "4df2f40d-bc30-407d-b1a7-20b43fe58ce2";
const approvalId = "9eddb8ff-f968-42c8-80f7-7e8d1986a7a2";

const cleanFeatureRepo: ExecutorRepoStatus = {
  currentBranch: "codex/base-ready",
  isClean: true,
  changedFiles: [],
  untrackedFiles: [],
  stagedFiles: [],
  warning: null,
  recommendedNextAction: "ready_for_preflight",
};

function readyRun(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    workspaceId,
    contractArtifactId,
    sourceGitExecutionPlanId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
    branchName: "codex/feature-test",
    status: "ready_for_live_execution",
    allowedFiles: ["apps/api/src/", "packages/contracts/src/"],
    requiredTests: ["corepack pnpm --filter @revealth/api test"],
    ...overrides,
  };
}

function approvedContract(status = "approved") {
  return {
    id: contractArtifactId,
    workspaceId,
    artifactType: "codex_execution_contract",
    version: 1,
    status,
    contentJson: {
      schemaVersion: "revealth.codex_execution_contract.v1",
      codexExecutionContractId: "b9e5528b-2c06-436b-9b76-73d37c5d8f91",
      sourceGitExecutionPlanArtifactId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
      contracts: [
        {
          sourceGitExecutionPlanId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
          sourceCodexPacketId: "codex-packet-49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
          sourceTaskId: "49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
          exactAllowedFilesOrDirectories: ["apps/api/src/"],
          forbiddenFiles: [".env", ".git/"],
          allowedCommands: ["corepack pnpm --filter @revealth/api test"],
          forbiddenCommands: ["git push", "git reset --hard"],
          requiredTests: ["corepack pnpm --filter @revealth/api test"],
          maxExecutionScope: "single approved Git execution plan only",
          branchName: "codex/feature-test",
          rollbackInstructions: "Revert only implementation commits.",
          prRequirements: {
            title: "Implement test",
            bodyMustInclude: ["Tests"],
            requiredReviewers: ["human-owner"],
            mergeGateChecklist: ["Human owner approves the pull request before merge."],
          },
          humanApprovalRequirements: ["Human owner must approve execution."],
          secretHandlingRules: ["Do not read .env files."],
          securityConstraints: ["No external side effects."],
        },
      ],
      approvalRequired: true,
      codeExecutionAllowed: false,
      branchCreationAllowed: false,
      pullRequestCreationAllowed: false,
      sourceIds: ["e9c253cc-2a49-4f02-b760-0c8f7445e606"],
    },
  };
}

function createDb() {
  const state = {
    run: readyRun(),
    artifact: approvedContract(),
    existingArtifact: null as Record<string, unknown> | null,
    approval: { id: approvalId },
    artifacts: [] as Record<string, unknown>[],
    approvals: [] as Record<string, unknown>[],
    auditLogs: [] as Record<string, unknown>[],
  };

  return {
    state,
    db: {
      codexExecutionRun: {
        findFirst: async () => state.run,
      },
      artifact: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          if (where.artifactType === "branch_preparation_plan") return state.existingArtifact;
          if (where.artifactType === "branch_preparation_plan" || where.orderBy) return null;
          return state.artifact;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const artifact = { id: "2a181496-5e7d-4e52-ad2d-c5a445f97858", createdAt: new Date(), ...data };
          state.artifacts.push(artifact);
          return artifact;
        },
        update: async ({ data }: { data: Record<string, unknown> }) => ({ ...state.artifacts[0], ...data }),
      },
      approval: {
        findFirst: async () => state.approval,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const approval = { id: "d6654544-3f4d-4234-b947-8a5993da6b0a", ...data };
          state.approvals.push(approval);
          return approval;
        },
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.auditLogs.push(data);
          return data;
        },
      },
    },
  };
}

describe("branch preparation plan planner", () => {
  it("requires ready_for_live_execution runs", () => {
    expect(() => assertRunReadyForBranchPreparation({ status: "queued" })).toThrow("ready_for_live_execution");
    expect(() => assertRunReadyForBranchPreparation({ status: "ready_for_live_execution" })).not.toThrow();
  });

  it("requires a clean non-protected executor repo", () => {
    expect(() => assertExecutorRepoReadyForBranchPreparation({ ...cleanFeatureRepo, isClean: false })).toThrow("clean");
    expect(() => assertExecutorRepoReadyForBranchPreparation({ ...cleanFeatureRepo, currentBranch: "main" })).toThrow(
      "protected",
    );
    expect(() => assertExecutorRepoReadyForBranchPreparation(cleanFeatureRepo)).not.toThrow();
  });

  it("builds inert branch command previews", () => {
    const plan = buildBranchPreparationPlan({ run: readyRun(), repoStatus: cleanFeatureRepo });

    expect(plan.schemaVersion).toBe("revealth.branch_preparation_plan.v1");
    expect(plan.branchCreationCommandPreview).toBe("git switch -c codex/feature-test codex/base-ready");
    expect(plan.rollbackCommandPreview).toBe("git switch codex/base-ready && git branch -D codex/feature-test");
    expect(plan.branchCreationAllowed).toBe(false);
    expect(plan.codeExecutionAllowed).toBe(false);
    expect(plan.pullRequestCreationAllowed).toBe(false);
  });
});

describe("BranchPreparationPlanService", () => {
  it("generates a pending approval branch preparation plan for a ready run", async () => {
    const { db, state } = createDb();
    const service = new BranchPreparationPlanService(db as never);

    const artifact = await service.generateForReadyRun({
      workspaceId,
      runId,
      actorId: "owner",
      repoStatus: cleanFeatureRepo,
    });

    expect(artifact.status).toBe("pending_approval");
    expect(state.approvals).toHaveLength(1);
    expect(state.auditLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining(["branch_preparation_plan.generate.requested", "branch_preparation_plan.generated"]),
    );
  });
});
