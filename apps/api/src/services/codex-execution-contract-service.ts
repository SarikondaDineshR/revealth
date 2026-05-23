import type { Prisma } from "@prisma/client";
import { codexExecutionContractSchema, gitExecutionPlanSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";
import { assertApprovedGitExecutionPlan, buildCodexExecutionContract } from "./codex-execution-contract-planner.js";

export class CodexExecutionContractService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async generateForApprovedGitExecutionPlan(input: {
    workspaceId: string;
    gitExecutionPlanArtifactId: string;
    actorId: string;
    maxExecutionScope: string;
  }) {
    const gitPlanArtifact = await this.db.artifact.findFirst({
      where: { id: input.gitExecutionPlanArtifactId, workspaceId: input.workspaceId },
    });
    if (!gitPlanArtifact) throw Object.assign(new Error("Git execution plan artifact not found."), { statusCode: 404 });

    assertApprovedGitExecutionPlan({ artifactType: gitPlanArtifact.artifactType, status: gitPlanArtifact.status });

    const sourceApproval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: gitPlanArtifact.id,
        artifactVersion: gitPlanArtifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!sourceApproval) {
      throw Object.assign(new Error("Approved Git execution plan approval not found."), {
        statusCode: 409,
        code: "APPROVED_GIT_EXECUTION_PLAN_APPROVAL_NOT_FOUND",
      });
    }

    const existing = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: "codex_execution_contract",
        parentArtifactId: gitPlanArtifact.id,
        status: { in: ["draft", "pending_approval", "approved"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "CodexExecutionContractService",
        action: "codex.execution_contract.generate.skipped",
        sourceArtifactIds: [gitPlanArtifact.id],
        targetArtifactIds: [existing.id],
        approvalId: sourceApproval.id,
        status: "success",
        eventJson: {
          reason: "existing_contract_for_git_execution_plan",
          gitExecutionPlanArtifactId: gitPlanArtifact.id,
          codexExecutionContractArtifactId: existing.id,
        },
      });
      return existing;
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "codex.execution_contract.generate.requested",
      sourceArtifactIds: [gitPlanArtifact.id],
      targetArtifactIds: [],
      approvalId: sourceApproval.id,
      status: "success",
      eventJson: {
        gitExecutionPlanArtifactId: gitPlanArtifact.id,
        maxExecutionScope: input.maxExecutionScope,
      },
    });

    const gitPlan = gitExecutionPlanSchema.parse(gitPlanArtifact.contentJson);
    const content = codexExecutionContractSchema.parse(
      buildCodexExecutionContract({
        plan: gitPlan,
        sourceGitExecutionPlanArtifactId: gitPlanArtifact.id,
        maxExecutionScope: input.maxExecutionScope,
      }),
    );

    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "codex_execution_contract" },
      orderBy: { version: "desc" },
    });
    const artifact = await this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "codex_execution_contract",
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: content.schemaVersion,
        contentJson: content as Prisma.InputJsonObject,
        sourceArtifactIds: [gitPlanArtifact.id],
        parentArtifactId: gitPlanArtifact.id,
        sourceWorkflowRunId: null,
        sourceApprovalId: sourceApproval.id,
        generatedByAgent: "CodexExecutionContractPlanner",
        promptVersion: "codex.execution_contract.v1",
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
      actorId: "CodexExecutionContractService",
      action: "codex.execution_contract.generated",
      sourceArtifactIds: [gitPlanArtifact.id],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        gitExecutionPlanArtifactId: gitPlanArtifact.id,
        codexExecutionContractArtifactId: artifact.id,
        contractCount: content.contracts.length,
        approvalId: approval.id,
        codeExecutionAllowed: false,
        branchCreationAllowed: false,
        pullRequestCreationAllowed: false,
      },
    });

    return pendingArtifact;
  }

  listContracts(workspaceId: string) {
    return this.db.artifact.findMany({
      where: { workspaceId, artifactType: "codex_execution_contract" },
      orderBy: { createdAt: "desc" },
    });
  }
}
