import fs from "node:fs/promises";
import path from "node:path";
import type { ExecutorCheck } from "@revealth/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { SandboxedCodexExecutionAdapter } from "./codex-execution-adapter.js";

const workspaceId = "7c2eae1b-0f75-4f3e-9d29-9e816fb324f0";
const contractArtifactId = "a5d711bd-88a8-4826-b793-3b2fbad2d3d2";
const runId = "4df2f40d-bc30-407d-b1a7-20b43fe58ce2";
const approvalId = "9eddb8ff-f968-42c8-80f7-7e8d1986a7a2";
const repoRoot = path.resolve(process.cwd(), "../..");

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
    executionWorkspaceManifestPath: null,
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
        findUnique: async () => state.run,
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
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.auditLogs.push(data);
          return data;
        },
      },
    },
  };
}

function createExecutorClient(report: {
  passed?: boolean;
  blockers?: string[];
  nextAllowedAction?: "start_dry_run" | "resolve_blockers" | "set_CODEX_EXECUTION_MODE_dry_run_for_validation" | "live_execution_blocked_not_implemented";
  checks?: ExecutorCheck[];
} = {}) {
  return {
    async preflight() {
      const blockers = report.blockers ?? [];
      return {
        passed: report.passed ?? blockers.length === 0,
        checks: report.checks ?? [
          {
            name: "workspace.manifest",
            passed: true,
            code: "CODEX_EXECUTION_MANIFEST_CREATED",
            message: "Execution workspace manifest can be created.",
            severity: "info",
            metadata: { manifestPath: `.revealth/execution-runs/${runId}/manifest.json` },
          },
        ],
        blockers,
        warnings: [],
        nextAllowedAction: report.nextAllowedAction ?? (blockers.length === 0 ? "start_dry_run" : "resolve_blockers"),
      };
    },
  };
}

describe("Sandboxed Codex execution adapter", () => {
  afterEach(async () => {
    await fs.rm(`.revealth/execution-runs/${runId}`, { recursive: true, force: true });
    await fs.rm(path.join(repoRoot, `.revealth/execution-runs/${runId}`), { recursive: true, force: true });
  });

  it("cannot start without an approved execution contract", async () => {
    const { db } = createDb({ artifact: approvedContract("pending_approval") });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_EXECUTION_CONTRACT_NOT_APPROVED",
    });
  });

  it("cannot start a cancelled run", async () => {
    const { db } = createDb({ run: queuedRun({ status: "cancelled" }) });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_EXECUTION_RUN_CANCELLED",
    });
  });

  it("disabled mode blocks execution", async () => {
    const { db, state } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "disabled" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_EXECUTION_DISABLED",
    });
    expect(state.run.status).toBe("queued");
    expect(state.auditLogs.some((log) => log.action === "codex.execution_run.start.blocked")).toBe(true);
  });

  it("dry_run completes safely and writes audit events", async () => {
    const { db, state } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    const completed = await adapter.executeDryRun(runId);

    expect(completed.status).toBe("completed_dry_run");
    expect(completed.startedAt).toBeInstanceOf(Date);
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.executionWorkspaceManifestPath).toBe(`.revealth/execution-runs/${runId}/manifest.json`);
    expect(JSON.stringify(completed.executionLogs)).toContain("No repository files were copied, modified, or branched");
    expect(state.auditLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "codex.execution_run.validated",
        "codex.execution_run.dry_run.started",
        "codex.execution_run.dry_run.completed",
      ]),
    );
  });

  it("forbidden command validation blocks unsafe snapshots", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedCommands: ["git push"],
        forbiddenCommands: ["git push"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_FORBIDDEN_COMMAND_CONFLICT",
    });
  });

  it("rejects command shell control operators", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedCommands: ["corepack pnpm test && git push"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_UNSAFE_COMMAND_OPERATOR_REJECTED",
    });
  });

  it("rejects allowed file wildcards", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedFiles: ["apps/api/src/**/*.ts"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_ALLOWED_FILE_WILDCARD_REJECTED",
    });
  });

  it("rejects execution runs when the approved contract snapshot drifts", async () => {
    const { db } = createDb({
      run: queuedRun({
        branchName: "codex/drifted",
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_CONTRACT_SNAPSHOT_MISMATCH",
    });
  });

  it("rejects absolute paths", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedFiles: ["/etc/passwd"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_ABSOLUTE_PATH_REJECTED",
    });
  });

  it("rejects path traversal", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedFiles: ["apps/api/src/", "../outside.ts"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_PATH_TRAVERSAL_REJECTED",
    });
  });

  it("rejects files outside allowed directories", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedFiles: ["apps/api/src/", "packages/contracts/src/index.ts"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_FILE_OUTSIDE_ALLOWED_DIRECTORIES",
    });
  });

  it("rejects allowed files matching forbidden file patterns", async () => {
    const { db } = createDb({
      run: queuedRun({
        allowedFiles: ["apps/api/src/", "apps/api/src/client-secret.ts"],
        forbiddenFiles: ["**/*secret*"],
      }),
    });
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.executeDryRun(runId)).rejects.toMatchObject({
      code: "CODEX_FORBIDDEN_FILE_CONFLICT",
    });
  });

  it("cleans up only terminal execution workspaces", async () => {
    const { db, state } = createDb({
      run: queuedRun({
        status: "completed_dry_run",
        executionWorkspaceManifestPath: `.revealth/execution-runs/${runId}/manifest.json`,
      }),
    });
    const manifestPath = path.join(repoRoot, `.revealth/execution-runs/${runId}/manifest.json`);
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, "{}\n", "utf8");
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    const cleaned = await adapter.cleanupWorkspace(runId);

    expect(cleaned.executionWorkspaceManifestPath).toBeNull();
    await expect(fs.stat(manifestPath)).rejects.toThrow();
    expect(state.auditLogs.some((log) => log.action === "codex.execution_workspace.cleaned")).toBe(true);
  });

  it("blocks cleanup for nonterminal runs", async () => {
    const { db } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" });

    await expect(adapter.cleanupWorkspace(runId)).rejects.toMatchObject({
      code: "CODEX_EXECUTION_RUN_NOT_CLEANABLE",
    });
  });

  it("preflight passes in dry_run mode with a clean repository", async () => {
    const { db, state } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(db as never, { CODEX_EXECUTION_MODE: "dry_run" }, createExecutorClient());

    const report = await adapter.preflight(runId);

    expect(report.passed).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.nextAllowedAction).toBe("start_dry_run");
    expect(state.run.executionWorkspaceManifestPath).toBe(`.revealth/execution-runs/${runId}/manifest.json`);
    expect(JSON.stringify(state.run.executionLogs)).toContain("Codex preflight passed");
    expect(state.auditLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "codex.execution_run.preflight.started",
        "codex.execution_run.preflight.passed",
      ]),
    );
  });

  it("preflight fails when the repository is dirty", async () => {
    const { db } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(
      db as never,
      { CODEX_EXECUTION_MODE: "dry_run" },
      createExecutorClient({
        passed: false,
        blockers: ["CODEX_GIT_WORKTREE_DIRTY"],
        checks: [
          {
            name: "git.clean",
            passed: false,
            code: "CODEX_GIT_WORKTREE_DIRTY",
            message: "Git worktree has uncommitted files.",
            severity: "blocker",
          },
        ],
      }),
    );

    const report = await adapter.preflight(runId);

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_GIT_WORKTREE_DIRTY");
    expect(report.nextAllowedAction).toBe("resolve_blockers");
  });

  it("preflight fails in disabled mode", async () => {
    const { db } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(
      db as never,
      { CODEX_EXECUTION_MODE: "disabled" },
      createExecutorClient({
        passed: false,
        blockers: ["CODEX_EXECUTION_DISABLED"],
        nextAllowedAction: "set_CODEX_EXECUTION_MODE_dry_run_for_validation",
      }),
    );

    const report = await adapter.preflight(runId);

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_EXECUTION_DISABLED");
    expect(report.nextAllowedAction).toBe("set_CODEX_EXECUTION_MODE_dry_run_for_validation");
  });

  it("preflight keeps live execution blocked", async () => {
    const { db } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(
      db as never,
      { CODEX_EXECUTION_MODE: "live" },
      createExecutorClient({
        passed: false,
        blockers: ["CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED"],
        nextAllowedAction: "live_execution_blocked_not_implemented",
      }),
    );

    const report = await adapter.preflight(runId);

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED");
    expect(report.nextAllowedAction).toBe("live_execution_blocked_not_implemented");
  });

  it("preflight fails when required tools are missing", async () => {
    const { db } = createDb({});
    const adapter = new SandboxedCodexExecutionAdapter(
      db as never,
      { CODEX_EXECUTION_MODE: "dry_run" },
      createExecutorClient({
        passed: false,
        blockers: ["CODEX_REQUIRED_TOOL_MISSING"],
      }),
    );

    const report = await adapter.preflight(runId);

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_REQUIRED_TOOL_MISSING");
  });
});
