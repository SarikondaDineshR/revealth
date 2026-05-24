import { describe, expect, it } from "vitest";
import { CodexExecutionRunService } from "./codex-execution-run-service.js";
import type { CodexPreflightReport } from "./codex-execution-adapter.js";
import type { ExecutorRepoStatus } from "@revealth/contracts";

const workspaceId = "7c2eae1b-0f75-4f3e-9d29-9e816fb324f0";
const contractArtifactId = "a5d711bd-88a8-4826-b793-3b2fbad2d3d2";
const runId = "4df2f40d-bc30-407d-b1a7-20b43fe58ce2";
const approvalId = "9eddb8ff-f968-42c8-80f7-7e8d1986a7a2";

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

function queuedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    workspaceId,
    contractArtifactId,
    sourceGitExecutionPlanId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
    idempotencyKey: "key",
    branchName: "codex/feature-test",
    status: "queued",
    allowedFiles: ["apps/api/src/"],
    forbiddenFiles: [".env", ".git/"],
    allowedCommands: ["corepack pnpm --filter @revealth/api test"],
    forbiddenCommands: ["git push", "git reset --hard"],
    requiredTests: ["corepack pnpm --filter @revealth/api test"],
    executionLogs: [],
    executionWorkspaceManifestPath: ".revealth/execution-runs/run/manifest.json",
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

function createDb(input: {
  run?: Record<string, unknown>;
  artifact?: Record<string, unknown>;
  approval?: Record<string, unknown> | null;
}) {
  const state = {
    run: input.run ?? queuedRun(),
    artifact: input.artifact ?? approvedContract(),
    approval: input.approval === undefined ? { id: approvalId } : input.approval,
    auditLogs: [] as Record<string, unknown>[],
  };

  return {
    state,
    db: {
      codexExecutionRun: {
        findFirst: async () => state.run,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          state.run = { ...state.run, ...data, updatedAt: new Date() };
          return state.run;
        },
      },
      artifact: {
        findFirst: async () => state.artifact,
      },
      approval: {
        findFirst: async () => state.approval,
      },
      auditLog: {
        findMany: async () => state.auditLogs,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.auditLogs.push(data);
          return data;
        },
      },
    },
  };
}

const passingPreflight: CodexPreflightReport = {
  passed: true,
  checks: [],
  blockers: [],
  warnings: [],
  nextAllowedAction: "start_dry_run",
};

const cleanFeatureRepo: ExecutorRepoStatus = {
  currentBranch: "codex/feature-test",
  isClean: true,
  changedFiles: [],
  untrackedFiles: [],
  stagedFiles: [],
  warning: null,
  recommendedNextAction: "ready_for_preflight",
};

describe("CodexExecutionRunService readiness gate", () => {
  it("marks queued runs ready when all readiness checks pass", async () => {
    const { db, state } = createDb({});
    const service = new CodexExecutionRunService(db as never);

    const result = await service.markReady({
      workspaceId,
      runId,
      actorId: "owner",
      preflight: passingPreflight,
      repoStatus: cleanFeatureRepo,
      executionMode: "dry_run",
    });

    expect(result.readiness.passed).toBe(true);
    expect(result.data.status).toBe("ready_for_live_execution");
    expect(state.auditLogs.some((log) => log.action === "codex.execution_run.ready_for_live_execution")).toBe(true);
  });

  it("keeps status unchanged and returns blockers when worktree is dirty", async () => {
    const { db, state } = createDb({});
    const service = new CodexExecutionRunService(db as never);

    const result = await service.markReady({
      workspaceId,
      runId,
      actorId: "owner",
      preflight: { ...passingPreflight, passed: false, blockers: ["CODEX_GIT_WORKTREE_DIRTY"] },
      repoStatus: { ...cleanFeatureRepo, isClean: false, changedFiles: ["apps/api/src/routes/codex.ts"] },
      executionMode: "dry_run",
    });

    expect(result.readiness.passed).toBe(false);
    expect(result.readiness.blockers).toEqual(
      expect.arrayContaining(["CODEX_PREFLIGHT_NOT_PASSED", "CODEX_EXECUTOR_WORKTREE_NOT_CLEAN"]),
    );
    expect(state.run.status).toBe("queued");
    expect(state.auditLogs.some((log) => log.action === "codex.execution_run.mark_ready.failed")).toBe(true);
  });

  it("blocks readiness on protected base branches", async () => {
    const { db, state } = createDb({});
    const service = new CodexExecutionRunService(db as never);

    const result = await service.markReady({
      workspaceId,
      runId,
      actorId: "owner",
      preflight: passingPreflight,
      repoStatus: { ...cleanFeatureRepo, currentBranch: "main", warning: "base branch" },
      executionMode: "dry_run",
    });

    expect(result.readiness.blockers).toContain("CODEX_EXECUTOR_ON_PROTECTED_BRANCH");
    expect(state.run.status).toBe("queued");
  });

  it("blocks readiness when execution mode is disabled", async () => {
    const { db } = createDb({});
    const service = new CodexExecutionRunService(db as never);

    const result = await service.markReady({
      workspaceId,
      runId,
      actorId: "owner",
      preflight: passingPreflight,
      repoStatus: cleanFeatureRepo,
      executionMode: "disabled",
    });

    expect(result.readiness.blockers).toContain("CODEX_EXECUTION_DISABLED");
  });
});
