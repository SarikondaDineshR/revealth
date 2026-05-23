import type { Prisma } from "@prisma/client";
import { codexExecutionContractSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
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
}
