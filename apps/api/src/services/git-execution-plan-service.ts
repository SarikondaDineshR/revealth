import type { Prisma } from "@prisma/client";
import { codexTaskPacketBatchSchema, gitExecutionPlanSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
import { assertApprovedCodexTaskPacketBatch, buildGitExecutionPlan } from "./git-execution-plan-planner.js";

export class GitExecutionPlanService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async generateForApprovedCodexPacketBatch(input: {
    workspaceId: string;
    codexTaskPacketBatchArtifactId: string;
    actorId: string;
    requiredReviewers: string[];
  }) {
    const packetBatchArtifact = await this.db.artifact.findFirst({
      where: { id: input.codexTaskPacketBatchArtifactId, workspaceId: input.workspaceId },
    });
    if (!packetBatchArtifact) {
      throw Object.assign(new Error("Codex task packet batch artifact not found."), { statusCode: 404 });
    }
    assertApprovedCodexTaskPacketBatch({
      artifactType: packetBatchArtifact.artifactType,
      status: packetBatchArtifact.status,
    });

    const sourceApproval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: packetBatchArtifact.id,
        artifactVersion: packetBatchArtifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!sourceApproval) {
      throw Object.assign(new Error("Approved Codex task packet batch approval not found."), {
        statusCode: 409,
        code: "APPROVED_CODEX_PACKET_BATCH_APPROVAL_NOT_FOUND",
      });
    }

    const existing = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: "git_execution_plan",
        parentArtifactId: packetBatchArtifact.id,
        status: { in: ["draft", "pending_approval", "approved"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "GitExecutionPlanService",
        action: "git.execution_plan.generate.skipped",
        sourceArtifactIds: [packetBatchArtifact.id],
        targetArtifactIds: [existing.id],
        approvalId: sourceApproval.id,
        status: "success",
        eventJson: {
          reason: "existing_git_execution_plan_for_codex_packet_batch",
          codexTaskPacketBatchArtifactId: packetBatchArtifact.id,
          gitExecutionPlanArtifactId: existing.id,
        },
      });
      return existing;
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "git.execution_plan.generate.requested",
      sourceArtifactIds: [packetBatchArtifact.id],
      targetArtifactIds: [],
      approvalId: sourceApproval.id,
      status: "success",
      eventJson: {
        codexTaskPacketBatchArtifactId: packetBatchArtifact.id,
        requiredReviewers: input.requiredReviewers,
      },
    });

    const batch = codexTaskPacketBatchSchema.parse(packetBatchArtifact.contentJson);
    const content = gitExecutionPlanSchema.parse(
      buildGitExecutionPlan({
        batch,
        sourceCodexTaskPacketBatchArtifactId: packetBatchArtifact.id,
        requiredReviewers: input.requiredReviewers,
      }),
    );
    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "git_execution_plan" },
      orderBy: { version: "desc" },
    });
    const artifact = await this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "git_execution_plan",
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: content.schemaVersion,
        contentJson: content as Prisma.InputJsonObject,
        sourceArtifactIds: [packetBatchArtifact.id],
        parentArtifactId: packetBatchArtifact.id,
        sourceWorkflowRunId: null,
        sourceApprovalId: sourceApproval.id,
        generatedByAgent: "GitExecutionPlanPlanner",
        promptVersion: "git.execution_plan.v1",
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
      actorId: "GitExecutionPlanService",
      action: "git.execution_plan.generated",
      sourceArtifactIds: [packetBatchArtifact.id],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        codexTaskPacketBatchArtifactId: packetBatchArtifact.id,
        gitExecutionPlanArtifactId: artifact.id,
        planCount: content.plans.length,
        approvalId: approval.id,
        branchCreationAllowed: false,
        pullRequestCreationAllowed: false,
        codeExecutionAllowed: false,
      },
    });

    return pendingArtifact;
  }

  listExecutionPlans(workspaceId: string) {
    return this.db.artifact.findMany({
      where: { workspaceId, artifactType: "git_execution_plan" },
      orderBy: { createdAt: "desc" },
    });
  }
}
