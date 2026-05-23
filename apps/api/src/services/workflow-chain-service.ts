import type { Prisma } from "@prisma/client";
import { WorkflowRunRepository, type DatabaseClient } from "@revealth/database";
import type { ApiEnv } from "../config/env.js";
import { createTemporalClient } from "../temporal/client.js";
import { AuditService } from "./audit-service.js";

export type ChainedWorkflowType = "sdlc_plan" | "task_generation" | "github_issue_drafts";

export interface ChainedWorkflowSpec {
  workflowType: ChainedWorkflowType;
  temporalWorkflowName: "sdlcPlanWorkflow" | "taskGenerationWorkflow" | "githubIssueDraftWorkflow";
  workflowIdPrefix: "sdlc-plan" | "task-generation" | "github-issue-drafts";
  inputArtifactField: "projectBriefArtifactId" | "sdlcPlanArtifactId" | "taskBatchArtifactId";
}

const chainSpecsByArtifactType = {
  project_brief: {
    workflowType: "sdlc_plan",
    temporalWorkflowName: "sdlcPlanWorkflow",
    workflowIdPrefix: "sdlc-plan",
    inputArtifactField: "projectBriefArtifactId",
  },
  sdlc_plan: {
    workflowType: "task_generation",
    temporalWorkflowName: "taskGenerationWorkflow",
    workflowIdPrefix: "task-generation",
    inputArtifactField: "sdlcPlanArtifactId",
  },
  task_batch: {
    workflowType: "github_issue_drafts",
    temporalWorkflowName: "githubIssueDraftWorkflow",
    workflowIdPrefix: "github-issue-drafts",
    inputArtifactField: "taskBatchArtifactId",
  },
} as const satisfies Record<string, ChainedWorkflowSpec>;

export function resolveChainedWorkflow(artifactType: string): ChainedWorkflowSpec | null {
  return chainSpecsByArtifactType[artifactType as keyof typeof chainSpecsByArtifactType] ?? null;
}

export class WorkflowChainService {
  private readonly audit: AuditService;
  private readonly workflowRuns: WorkflowRunRepository;

  constructor(
    private readonly db: DatabaseClient,
    private readonly env: ApiEnv,
  ) {
    this.audit = new AuditService(db);
    this.workflowRuns = new WorkflowRunRepository(db);
  }

  async continueAfterApproval(input: { workspaceId: string; approvalId: string; actorId: string }) {
    const approval = await this.db.approval.findFirst({
      where: { id: input.approvalId, workspaceId: input.workspaceId },
      include: { artifact: true },
    });
    if (!approval || approval.status !== "approved") return null;

    const spec = resolveChainedWorkflow(approval.artifact.artifactType);
    if (!spec) return null;

    const workflowInput = {
      [spec.inputArtifactField]: approval.artifact.id,
      sourceApprovalId: approval.id,
      ...(spec.workflowType === "github_issue_drafts" ? { repository: "draft/repository" } : {}),
    };
    const run = await this.workflowRuns.create({
      workspaceId: input.workspaceId,
      workflowType: spec.workflowType,
      inputJson: workflowInput as Prisma.InputJsonObject,
    });

    const client = await createTemporalClient(this.env);
    await client.workflow.start(spec.temporalWorkflowName, {
      taskQueue: this.env.TEMPORAL_TASK_QUEUE,
      workflowId: `${spec.workflowIdPrefix}-${run.id}`,
      args: [
        {
          workflowRunId: run.id,
          workspaceId: input.workspaceId,
          ...workflowInput,
        },
      ],
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      workflowRunId: run.id,
      actorType: "system",
      actorId: "WorkflowChainService",
      action: "workflow.chain.started",
      sourceArtifactIds: [approval.artifact.id],
      targetArtifactIds: [],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        fromArtifactType: approval.artifact.artifactType,
        nextWorkflowType: spec.workflowType,
        temporalWorkflowName: spec.temporalWorkflowName,
        authorizedByApprovalId: approval.id,
      },
    });

    return { run, spec };
  }
}
