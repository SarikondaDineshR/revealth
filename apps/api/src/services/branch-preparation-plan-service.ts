import type { Prisma } from "@prisma/client";
import { branchPreparationPlanSchema, codexExecutionContractSchema, type ExecutorRepoStatus } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
import {
  assertExecutorRepoReadyForBranchPreparation,
  assertRunReadyForBranchPreparation,
  buildBranchPreparationPlan,
} from "./branch-preparation-plan-planner.js";

export class BranchPreparationPlanService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async generateForReadyRun(input: {
    workspaceId: string;
    runId: string;
    actorId: string;
    repoStatus: ExecutorRepoStatus;
  }) {
    const run = await this.db.codexExecutionRun.findFirst({
      where: { id: input.runId, workspaceId: input.workspaceId },
    });
    if (!run) {
      throw Object.assign(new Error("Codex execution run not found."), {
        statusCode: 404,
        code: "CODEX_EXECUTION_RUN_NOT_FOUND",
      });
    }
    assertRunReadyForBranchPreparation(run);
    assertExecutorRepoReadyForBranchPreparation(input.repoStatus);

    const contractArtifact = await this.db.artifact.findFirst({
      where: { id: run.contractArtifactId, workspaceId: input.workspaceId },
    });
    if (!contractArtifact) {
      throw Object.assign(new Error("Codex execution contract artifact not found."), {
        statusCode: 404,
        code: "CODEX_EXECUTION_CONTRACT_NOT_FOUND",
      });
    }
    if (contractArtifact.artifactType !== "codex_execution_contract" || contractArtifact.status !== "approved") {
      throw Object.assign(new Error("Branch preparation requires an approved codex_execution_contract artifact."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_CONTRACT_NOT_APPROVED",
      });
    }
    codexExecutionContractSchema.parse(contractArtifact.contentJson);

    const sourceApproval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: contractArtifact.id,
        artifactVersion: contractArtifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!sourceApproval) {
      throw Object.assign(new Error("Approved Codex execution contract approval not found."), {
        statusCode: 409,
        code: "APPROVED_CODEX_EXECUTION_CONTRACT_APPROVAL_NOT_FOUND",
      });
    }

    const existing = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: "branch_preparation_plan",
        parentArtifactId: contractArtifact.id,
        sourceArtifactIds: { has: contractArtifact.id },
        status: { in: ["draft", "pending_approval", "approved"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "BranchPreparationPlanService",
        action: "branch_preparation_plan.generate.skipped",
        sourceArtifactIds: [contractArtifact.id],
        targetArtifactIds: [existing.id],
        approvalId: sourceApproval.id,
        status: "success",
        eventJson: {
          reason: "existing_branch_preparation_plan_for_contract",
          codexExecutionRunId: run.id,
          branchPreparationPlanArtifactId: existing.id,
        },
      });
      return existing;
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "branch_preparation_plan.generate.requested",
      sourceArtifactIds: [contractArtifact.id],
      targetArtifactIds: [],
      approvalId: sourceApproval.id,
      status: "success",
      eventJson: {
        codexExecutionRunId: run.id,
        currentBranch: input.repoStatus.currentBranch,
        recommendedBranchName: run.branchName,
        branchCreationAllowed: false,
      },
    });

    const content = branchPreparationPlanSchema.parse(
      buildBranchPreparationPlan({ run, repoStatus: input.repoStatus }),
    );
    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "branch_preparation_plan" },
      orderBy: { version: "desc" },
    });
    const artifact = await this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "branch_preparation_plan",
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: content.schemaVersion,
        contentJson: content as Prisma.InputJsonObject,
        sourceArtifactIds: [contractArtifact.id],
        parentArtifactId: contractArtifact.id,
        sourceWorkflowRunId: null,
        sourceApprovalId: sourceApproval.id,
        generatedByAgent: "BranchPreparationPlanPlanner",
        promptVersion: "branch_preparation_plan.v1",
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
      actorId: "BranchPreparationPlanService",
      action: "branch_preparation_plan.generated",
      sourceArtifactIds: [contractArtifact.id],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        codexExecutionRunId: run.id,
        branchPreparationPlanArtifactId: artifact.id,
        approvalId: approval.id,
        branchCreationAllowed: false,
        codeExecutionAllowed: false,
        pullRequestCreationAllowed: false,
      },
    });

    return pendingArtifact;
  }

  listPlans(workspaceId: string) {
    return this.db.artifact.findMany({
      where: { workspaceId, artifactType: "branch_preparation_plan" },
      orderBy: { createdAt: "desc" },
    });
  }
}
