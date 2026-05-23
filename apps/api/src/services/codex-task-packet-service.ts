import type { Prisma } from "@prisma/client";
import { codexTaskPacketBatchSchema, taskBatchSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
import { assertApprovedTaskBatch, buildCodexTaskPacketBatch } from "./codex-task-packet-planner.js";

export class CodexTaskPacketService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async generateForApprovedTaskBatch(input: {
    workspaceId: string;
    taskBatchArtifactId: string;
    actorId: string;
    repository?: string;
  }) {
    const taskBatchArtifact = await this.db.artifact.findFirst({
      where: { id: input.taskBatchArtifactId, workspaceId: input.workspaceId },
    });
    if (!taskBatchArtifact) throw Object.assign(new Error("Task batch artifact not found."), { statusCode: 404 });
    assertApprovedTaskBatch({ artifactType: taskBatchArtifact.artifactType, status: taskBatchArtifact.status });

    const sourceApproval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: taskBatchArtifact.id,
        artifactVersion: taskBatchArtifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!sourceApproval) {
      throw Object.assign(new Error("Approved task batch approval not found."), {
        statusCode: 409,
        code: "APPROVED_TASK_BATCH_APPROVAL_NOT_FOUND",
      });
    }

    const existingPendingOrApproved = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: "codex_task_packet_batch",
        parentArtifactId: taskBatchArtifact.id,
        status: { in: ["draft", "pending_approval", "approved"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingPendingOrApproved) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "CodexTaskPacketService",
        action: "codex.task_packet_batch.generate.skipped",
        sourceArtifactIds: [taskBatchArtifact.id],
        targetArtifactIds: [existingPendingOrApproved.id],
        approvalId: sourceApproval.id,
        status: "success",
        eventJson: {
          reason: "existing_packet_batch_for_task_batch",
          taskBatchArtifactId: taskBatchArtifact.id,
          codexTaskPacketBatchArtifactId: existingPendingOrApproved.id,
        },
      });
      return existingPendingOrApproved;
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "codex.task_packet_batch.generate.requested",
      sourceArtifactIds: [taskBatchArtifact.id],
      targetArtifactIds: [],
      approvalId: sourceApproval.id,
      status: "success",
      eventJson: {
        taskBatchArtifactId: taskBatchArtifact.id,
        repository: input.repository ?? null,
      },
    });

    const taskBatch = taskBatchSchema.parse(taskBatchArtifact.contentJson);
    const content = codexTaskPacketBatchSchema.parse(
      buildCodexTaskPacketBatch({
        taskBatch,
        sourceTaskBatchArtifactId: taskBatchArtifact.id,
        sourceTaskBatchApprovalId: sourceApproval.id,
        sourceWorkflowRunId: taskBatchArtifact.sourceWorkflowRunId,
        parentArtifactId: taskBatchArtifact.parentArtifactId,
        sourceArtifactIds: taskBatchArtifact.sourceArtifactIds,
      }),
    );

    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "codex_task_packet_batch" },
      orderBy: { version: "desc" },
    });
    const artifact = await this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "codex_task_packet_batch",
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: content.schemaVersion,
        contentJson: content as Prisma.InputJsonObject,
        sourceArtifactIds: [taskBatchArtifact.id],
        parentArtifactId: taskBatchArtifact.id,
        sourceWorkflowRunId: null,
        sourceApprovalId: sourceApproval.id,
        generatedByAgent: "CodexTaskPacketPlanner",
        promptVersion: "codex.task_packet_batch.v1",
        modelProvider: "none",
        modelName: "deterministic",
      },
    });

    const approval = await this.db.approval.create({
      data: {
        workspaceId: input.workspaceId,
        artifactId: artifact.id,
        artifactVersion: artifact.version,
        status: "pending",
      },
    });
    const pendingArtifact = await this.db.artifact.update({
      where: { id: artifact.id },
      data: { status: "pending_approval" },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "CodexTaskPacketService",
      action: "codex.task_packet_batch.generated",
      sourceArtifactIds: [taskBatchArtifact.id],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        taskBatchArtifactId: taskBatchArtifact.id,
        codexTaskPacketBatchArtifactId: artifact.id,
        packetCount: content.packets.length,
        approvalId: approval.id,
        executionAllowed: false,
        branchCreationAllowed: false,
        pullRequestCreationAllowed: false,
      },
    });

    return pendingArtifact;
  }

  async listPacketBatches(workspaceId: string) {
    return this.db.artifact.findMany({
      where: { workspaceId, artifactType: "codex_task_packet_batch" },
      orderBy: { createdAt: "desc" },
    });
  }
}
