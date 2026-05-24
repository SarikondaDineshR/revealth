import type { Prisma } from "@prisma/client";
import { taskBatchSchema, workforceScalingPlanSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
import { assertApprovedTaskBatchForWorkforceScaling, buildWorkforceScalingPlan } from "./workforce-scaling-planner.js";

export class WorkforceScalingPlanService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async generateForApprovedTaskBatch(input: { workspaceId: string; taskBatchArtifactId: string; actorId: string }) {
    const taskBatchArtifact = await this.db.artifact.findFirst({
      where: { id: input.taskBatchArtifactId, workspaceId: input.workspaceId },
    });
    if (!taskBatchArtifact) throw Object.assign(new Error("Task batch artifact not found."), { statusCode: 404 });
    assertApprovedTaskBatchForWorkforceScaling({
      artifactType: taskBatchArtifact.artifactType,
      status: taskBatchArtifact.status,
    });

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

    const existingPlan = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: "workforce_scaling_plan",
        parentArtifactId: taskBatchArtifact.id,
        status: { in: ["draft", "pending_approval", "approved"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingPlan) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "WorkforceScalingPlanService",
        action: "workforce_scaling_plan.generate.skipped",
        sourceArtifactIds: [taskBatchArtifact.id],
        targetArtifactIds: [existingPlan.id],
        approvalId: sourceApproval.id,
        status: "success",
        eventJson: {
          reason: "existing_workforce_scaling_plan_for_task_batch",
          taskBatchArtifactId: taskBatchArtifact.id,
          workforceScalingPlanArtifactId: existingPlan.id,
        },
      });
      return existingPlan;
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "workforce_scaling_plan.generate.requested",
      sourceArtifactIds: [taskBatchArtifact.id],
      targetArtifactIds: [],
      approvalId: sourceApproval.id,
      status: "success",
      eventJson: { taskBatchArtifactId: taskBatchArtifact.id },
    });

    const taskBatch = taskBatchSchema.parse(taskBatchArtifact.contentJson);
    const content = workforceScalingPlanSchema.parse(
      buildWorkforceScalingPlan({
        taskBatch,
        sourceTaskBatchArtifactId: taskBatchArtifact.id,
      }),
    );

    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "workforce_scaling_plan" },
      orderBy: { version: "desc" },
    });

    const artifact = await this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "workforce_scaling_plan",
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: content.schemaVersion,
        contentJson: content as Prisma.InputJsonObject,
        sourceArtifactIds: [taskBatchArtifact.id],
        parentArtifactId: taskBatchArtifact.id,
        sourceWorkflowRunId: null,
        sourceApprovalId: sourceApproval.id,
        generatedByAgent: "WorkforceScalingPlanner",
        promptVersion: "workforce_scaling_plan.v1",
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
      actorId: "WorkforceScalingPlanService",
      action: "workforce_scaling_plan.generated",
      sourceArtifactIds: [taskBatchArtifact.id],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        taskBatchArtifactId: taskBatchArtifact.id,
        workforceScalingPlanArtifactId: artifact.id,
        projectComplexity: content.projectComplexity,
        recommendedRoleCount: content.requiredRoles.length,
        approvalId: approval.id,
        automaticAgentCreationAllowed: false,
      },
    });

    return pendingArtifact;
  }

  async listPlans(workspaceId: string) {
    return this.db.artifact.findMany({
      where: { workspaceId, artifactType: "workforce_scaling_plan" },
      orderBy: { createdAt: "desc" },
    });
  }
}
