import type { FastifyInstance } from "fastify";
import {
  startGithubIssueDraftWorkflowRequestSchema,
  startIntakeWorkflowRequestSchema,
  startProductPlanWorkflowRequestSchema,
  startSdlcPlanWorkflowRequestSchema,
  startTaskGenerationWorkflowRequestSchema,
} from "@revealth/contracts";
import { WorkflowRunRepository, prisma } from "@revealth/database";
import { createTemporalClient } from "../temporal/client.js";

export async function registerWorkflowRoutes(app: FastifyInstance): Promise<void> {
  const workflows = new WorkflowRunRepository(prisma);

  app.post("/workspaces/:workspaceId/workflows/intake", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = startIntakeWorkflowRequestSchema.parse(request.body);
    const run = await workflows.create({
      workspaceId,
      workflowType: "intake",
      inputJson: body,
    });
    const client = await createTemporalClient(app.config);
    await client.workflow.start("intakeWorkflow", {
      taskQueue: app.config.TEMPORAL_TASK_QUEUE,
      workflowId: `intake-${run.id}`,
      args: [{ workflowRunId: run.id, workspaceId, ownerId: request.actor.id, rawProjectIdea: body.rawProjectIdea }],
    });
    return { data: run, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/workflows/product-plan", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = startProductPlanWorkflowRequestSchema.parse(request.body);
    const run = await workflows.create({
      workspaceId,
      workflowType: "product_plan",
      inputJson: body,
    });
    const client = await createTemporalClient(app.config);
    await client.workflow.start("productPlanWorkflow", {
      taskQueue: app.config.TEMPORAL_TASK_QUEUE,
      workflowId: `product-plan-${run.id}`,
      args: [
        {
          workflowRunId: run.id,
          workspaceId,
          projectBriefArtifactId: body.projectBriefArtifactId,
          sourceApprovalId: body.sourceApprovalId,
        },
      ],
    });
    return { data: run, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/workflows/sdlc-plan", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = startSdlcPlanWorkflowRequestSchema.parse(request.body);
    const run = await workflows.create({
      workspaceId,
      workflowType: "sdlc_plan",
      inputJson: body,
    });
    const client = await createTemporalClient(app.config);
    await client.workflow.start("sdlcPlanWorkflow", {
      taskQueue: app.config.TEMPORAL_TASK_QUEUE,
      workflowId: `sdlc-plan-${run.id}`,
      args: [
        {
          workflowRunId: run.id,
          workspaceId,
          projectBriefArtifactId: body.projectBriefArtifactId,
          sourceApprovalId: body.sourceApprovalId,
        },
      ],
    });
    return { data: run, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/workflows/task-generation", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = startTaskGenerationWorkflowRequestSchema.parse(request.body);
    const run = await workflows.create({
      workspaceId,
      workflowType: "task_generation",
      inputJson: body,
    });
    const client = await createTemporalClient(app.config);
    await client.workflow.start("taskGenerationWorkflow", {
      taskQueue: app.config.TEMPORAL_TASK_QUEUE,
      workflowId: `task-generation-${run.id}`,
      args: [
        {
          workflowRunId: run.id,
          workspaceId,
          sdlcPlanArtifactId: body.sdlcPlanArtifactId,
          sourceApprovalId: body.sourceApprovalId,
        },
      ],
    });
    return { data: run, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/workflows/github-issue-drafts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = startGithubIssueDraftWorkflowRequestSchema.parse(request.body);
    const run = await workflows.create({
      workspaceId,
      workflowType: "github_issue_drafts",
      inputJson: body,
    });
    const client = await createTemporalClient(app.config);
    await client.workflow.start("githubIssueDraftWorkflow", {
      taskQueue: app.config.TEMPORAL_TASK_QUEUE,
      workflowId: `github-issue-drafts-${run.id}`,
      args: [
        {
          workflowRunId: run.id,
          workspaceId,
          taskBatchArtifactId: body.taskBatchArtifactId,
          sourceApprovalId: body.sourceApprovalId,
          repository: body.repository,
        },
      ],
    });
    return { data: run, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/workflows/:workflowRunId", async (request) => {
    const { workflowRunId } = request.params as { workspaceId: string; workflowRunId: string };
    const data = await prisma.workflowRun.findUnique({ where: { id: workflowRunId } });
    if (!data) throw Object.assign(new Error("Workflow run not found."), { statusCode: 404 });
    return { data, error: null, requestId: request.requestId };
  });
}
