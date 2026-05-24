import type { Prisma } from "@prisma/client";
import { codexExecutionContractSchema, type ExecutorRepoStatus } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
import type { CodexPreflightReport } from "./codex-execution-adapter.js";
import {
  assertApprovedCodexExecutionContract,
  assertRunCanBeCancelled,
  buildExecutionRunIdempotencyKey,
  extractRunSnapshot,
} from "./codex-execution-run-planner.js";

export class CodexExecutionRunService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async createQueuedRun(input: { workspaceId: string; contractArtifactId: string; actorId: string }) {
    const contractArtifact = await this.db.artifact.findFirst({
      where: { id: input.contractArtifactId, workspaceId: input.workspaceId },
    });
    if (!contractArtifact) {
      throw Object.assign(new Error("Codex execution contract artifact not found."), { statusCode: 404 });
    }
    assertApprovedCodexExecutionContract({
      artifactType: contractArtifact.artifactType,
      status: contractArtifact.status,
    });

    const approval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: contractArtifact.id,
        artifactVersion: contractArtifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!approval) {
      throw Object.assign(new Error("Approved Codex execution contract approval not found."), {
        statusCode: 409,
        code: "APPROVED_CODEX_EXECUTION_CONTRACT_APPROVAL_NOT_FOUND",
      });
    }

    const idempotencyKey = buildExecutionRunIdempotencyKey({
      workspaceId: input.workspaceId,
      contractArtifactId: contractArtifact.id,
    });
    const existing = await this.db.codexExecutionRun.findUnique({ where: { idempotencyKey } });
    if (existing) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "CodexExecutionRunService",
        action: "codex.execution_run.create.skipped",
        sourceArtifactIds: [contractArtifact.id],
        targetArtifactIds: [contractArtifact.id],
        approvalId: approval.id,
        status: "success",
        eventJson: {
          reason: "existing_execution_run_for_contract",
          codexExecutionRunId: existing.id,
          contractArtifactId: contractArtifact.id,
        },
      });
      return existing;
    }

    const contract = codexExecutionContractSchema.parse(contractArtifact.contentJson);
    const snapshot = extractRunSnapshot(contract);

    const run = await this.db.codexExecutionRun.create({
      data: {
        workspaceId: input.workspaceId,
        contractArtifactId: contractArtifact.id,
        sourceGitExecutionPlanId: snapshot.sourceGitExecutionPlanId,
        idempotencyKey,
        branchName: snapshot.branchName,
        status: "queued",
        allowedFiles: snapshot.allowedFiles,
        forbiddenFiles: snapshot.forbiddenFiles,
        allowedCommands: snapshot.allowedCommands,
        forbiddenCommands: snapshot.forbiddenCommands,
        requiredTests: snapshot.requiredTests,
        executionLogs: [
          {
            level: "info",
            message: "Codex execution run queued. No code execution has started.",
            at: new Date().toISOString(),
          },
        ] as Prisma.InputJsonArray,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "codex.execution_run.queued",
      sourceArtifactIds: [contractArtifact.id],
      targetArtifactIds: [contractArtifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        codexExecutionRunId: run.id,
        contractArtifactId: contractArtifact.id,
        sourceGitExecutionPlanId: run.sourceGitExecutionPlanId,
        branchName: run.branchName,
        status: run.status,
        codeExecutionStarted: false,
        branchCreated: false,
        pullRequestCreated: false,
      },
    });

    return run;
  }

  listRuns(workspaceId: string) {
    return this.db.codexExecutionRun.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getRun(input: { workspaceId: string; runId: string }) {
    const run = await this.db.codexExecutionRun.findFirst({
      where: { id: input.runId, workspaceId: input.workspaceId },
    });
    if (!run) throw Object.assign(new Error("Codex execution run not found."), { statusCode: 404 });
    return run;
  }

  async inspectRun(input: { workspaceId: string; runId: string }) {
    const run = await this.getRun(input);
    const auditEvents = await this.db.auditLog.findMany({
      where: {
        workspaceId: input.workspaceId,
        sourceArtifactIds: { has: run.contractArtifactId },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      id: run.id,
      workspaceId: run.workspaceId,
      status: run.status,
      contractSnapshot: {
        contractArtifactId: run.contractArtifactId,
        sourceGitExecutionPlanId: run.sourceGitExecutionPlanId,
        branchName: run.branchName,
        allowedFiles: run.allowedFiles,
        forbiddenFiles: run.forbiddenFiles,
        allowedCommands: run.allowedCommands,
        forbiddenCommands: run.forbiddenCommands,
        requiredTests: run.requiredTests,
        executionWorkspaceManifestPath: run.executionWorkspaceManifestPath,
      },
      executionLogs: run.executionLogs,
      auditEventSummary: auditEvents
        .filter((event) => JSON.stringify(event.eventJson).includes(run.id) || event.action.startsWith("codex.execution"))
        .map((event) => ({
          id: event.id,
          action: event.action,
          status: event.status,
          errorCode: event.errorCode,
          approvalId: event.approvalId,
          createdAt: event.createdAt,
        })),
      sideEffects: {
        filesModified: false,
        branchCreated: false,
        pullRequestCreated: false,
      },
      readiness: {
        isReadyForFutureLiveExecution: run.status === "ready_for_live_execution",
        status: run.status,
        liveExecutionImplemented: false,
        nextRequiredAction:
          run.status === "ready_for_live_execution"
            ? "wait_for_live_execution_implementation"
            : "run_mark_ready_after_clean_preflight",
      },
    };
  }

  async markReady(input: {
    workspaceId: string;
    runId: string;
    actorId: string;
    preflight: CodexPreflightReport;
    repoStatus: ExecutorRepoStatus;
    executionMode: "disabled" | "dry_run" | "live";
  }) {
    const run = await this.getRun({ workspaceId: input.workspaceId, runId: input.runId });
    const blockers = await this.collectReadinessBlockers(run, input);

    if (blockers.length > 0) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "human",
        actorId: input.actorId,
        action: "codex.execution_run.mark_ready.failed",
        sourceArtifactIds: [run.contractArtifactId],
        targetArtifactIds: [run.contractArtifactId],
        status: "failed",
        errorCode: blockers[0] ?? "CODEX_EXECUTION_READINESS_FAILED",
        eventJson: {
          codexExecutionRunId: run.id,
          status: run.status,
          blockers,
          preflightPassed: input.preflight.passed,
          executorRepoStatus: input.repoStatus,
          liveExecutionImplemented: false,
        },
      });
      return {
        data: run,
        readiness: {
          passed: false,
          blockers,
          statusUnchanged: true,
          nextAllowedAction: "resolve_readiness_blockers",
          liveExecutionImplemented: false,
        },
      };
    }

    const now = new Date();
    const ready = await this.db.codexExecutionRun.update({
      where: { id: run.id },
      data: {
        status: "ready_for_live_execution",
        executionLogs: [
          ...((run.executionLogs as Array<Record<string, unknown>>) ?? []),
          {
            level: "info",
            message: "Codex execution run marked ready for future live execution. No code execution has started.",
            at: now.toISOString(),
            metadata: {
              liveExecutionImplemented: false,
              branchName: run.branchName,
            },
          },
        ] as Prisma.InputJsonArray,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "codex.execution_run.ready_for_live_execution",
      sourceArtifactIds: [run.contractArtifactId],
      targetArtifactIds: [run.contractArtifactId],
      status: "success",
      eventJson: {
        codexExecutionRunId: ready.id,
        previousStatus: run.status,
        status: ready.status,
        preflightPassed: input.preflight.passed,
        executorRepoStatus: input.repoStatus,
        codeExecutionStarted: false,
        branchCreated: false,
        pullRequestCreated: false,
        liveExecutionImplemented: false,
      },
    });

    return {
      data: ready,
      readiness: {
        passed: true,
        blockers: [],
        statusUnchanged: false,
        nextAllowedAction: "wait_for_live_execution_implementation",
        liveExecutionImplemented: false,
      },
    };
  }

  async cancelQueuedRun(input: { workspaceId: string; runId: string; actorId: string; reason: string }) {
    const run = await this.getRun({ workspaceId: input.workspaceId, runId: input.runId });
    assertRunCanBeCancelled(run.status);

    const cancelled = await this.db.codexExecutionRun.update({
      where: { id: run.id },
      data: {
        status: "cancelled",
        failureReason: input.reason,
        cancelledAt: new Date(),
        completedAt: new Date(),
        executionLogs: [
          ...((run.executionLogs as Array<Record<string, unknown>>) ?? []),
          {
            level: "info",
            message: input.reason,
            at: new Date().toISOString(),
          },
        ] as Prisma.InputJsonArray,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "codex.execution_run.cancelled",
      sourceArtifactIds: [run.contractArtifactId],
      targetArtifactIds: [run.contractArtifactId],
      status: "success",
      eventJson: {
        codexExecutionRunId: run.id,
        contractArtifactId: run.contractArtifactId,
        previousStatus: run.status,
        status: cancelled.status,
        reason: input.reason,
      },
    });

    return cancelled;
  }

  private async collectReadinessBlockers(
    run: Awaited<ReturnType<CodexExecutionRunService["getRun"]>>,
    input: {
      preflight: CodexPreflightReport;
      repoStatus: ExecutorRepoStatus;
      executionMode: "disabled" | "dry_run" | "live";
    },
  ): Promise<string[]> {
    const blockers = new Set<string>();
    if (run.status !== "queued") blockers.add("CODEX_RUN_NOT_QUEUED");

    const contractArtifact = await this.db.artifact.findFirst({
      where: { id: run.contractArtifactId, workspaceId: run.workspaceId },
    });
    if (contractArtifact?.artifactType !== "codex_execution_contract" || contractArtifact.status !== "approved") {
      blockers.add("CODEX_EXECUTION_CONTRACT_NOT_APPROVED");
    } else {
      try {
        codexExecutionContractSchema.parse(contractArtifact.contentJson);
      } catch {
        blockers.add("CODEX_CONTRACT_SCHEMA_INVALID");
      }
    }

    const approval = await this.db.approval.findFirst({
      where: {
        workspaceId: run.workspaceId,
        artifactId: run.contractArtifactId,
        artifactVersion: contractArtifact?.version ?? -1,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!approval) blockers.add("APPROVED_CODEX_EXECUTION_CONTRACT_APPROVAL_NOT_FOUND");

    if (!input.preflight.passed) {
      blockers.add("CODEX_PREFLIGHT_NOT_PASSED");
      for (const blocker of input.preflight.blockers) blockers.add(blocker);
    }
    if (!input.repoStatus.isClean) blockers.add("CODEX_EXECUTOR_WORKTREE_NOT_CLEAN");
    if (input.repoStatus.currentBranch === "main" || input.repoStatus.currentBranch === "master") {
      blockers.add("CODEX_EXECUTOR_ON_PROTECTED_BRANCH");
    }
    if (run.requiredTests.length === 0) blockers.add("CODEX_REQUIRED_TESTS_MISSING");
    if (run.forbiddenFiles.length === 0) blockers.add("CODEX_FORBIDDEN_FILES_MISSING");
    if (input.executionMode === "disabled") blockers.add("CODEX_EXECUTION_DISABLED");
    if (input.executionMode === "live") blockers.add("CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED");

    return [...blockers].sort();
  }
}
