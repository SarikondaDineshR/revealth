import type { FastifyInstance } from "fastify";
import {
  cancelCodexExecutionRunRequestSchema,
  createCodexExecutionRunRequestSchema,
  generateCodexExecutionContractRequestSchema,
  generateCodexTaskPacketsRequestSchema,
  generateGitExecutionPlanRequestSchema,
} from "@revealth/contracts";
import { prisma } from "@revealth/database";
import { CodexExecutionContractService } from "../services/codex-execution-contract-service.js";
import { CodexExecutionRunService } from "../services/codex-execution-run-service.js";
import { CodexTaskPacketService } from "../services/codex-task-packet-service.js";
import { GitExecutionPlanService } from "../services/git-execution-plan-service.js";

export async function registerCodexRoutes(app: FastifyInstance): Promise<void> {
  const codexPacketService = new CodexTaskPacketService(prisma);
  const gitExecutionPlanService = new GitExecutionPlanService(prisma);
  const codexExecutionContractService = new CodexExecutionContractService(prisma);
  const codexExecutionRunService = new CodexExecutionRunService(prisma);

  app.get("/workspaces/:workspaceId/codex/task-packet-batches", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await codexPacketService.listPacketBatches(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts/:taskBatchArtifactId/codex-task-packets", async (request) => {
    const { workspaceId, taskBatchArtifactId } = request.params as {
      workspaceId: string;
      taskBatchArtifactId: string;
    };
    const body = generateCodexTaskPacketsRequestSchema.parse(request.body ?? {});
    const data = await codexPacketService.generateForApprovedTaskBatch({
      workspaceId,
      taskBatchArtifactId,
      actorId: request.actor.id,
      repository: body.repository,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/git/execution-plans", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await gitExecutionPlanService.listExecutionPlans(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts/:codexTaskPacketBatchArtifactId/git-execution-plans", async (request) => {
    const { workspaceId, codexTaskPacketBatchArtifactId } = request.params as {
      workspaceId: string;
      codexTaskPacketBatchArtifactId: string;
    };
    const body = generateGitExecutionPlanRequestSchema.parse(request.body ?? {});
    const data = await gitExecutionPlanService.generateForApprovedCodexPacketBatch({
      workspaceId,
      codexTaskPacketBatchArtifactId,
      actorId: request.actor.id,
      requiredReviewers: body.requiredReviewers,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/codex/execution-contracts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await codexExecutionContractService.listContracts(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts/:gitExecutionPlanArtifactId/codex-execution-contracts", async (request) => {
    const { workspaceId, gitExecutionPlanArtifactId } = request.params as {
      workspaceId: string;
      gitExecutionPlanArtifactId: string;
    };
    const body = generateCodexExecutionContractRequestSchema.parse(request.body ?? {});
    const data = await codexExecutionContractService.generateForApprovedGitExecutionPlan({
      workspaceId,
      gitExecutionPlanArtifactId,
      actorId: request.actor.id,
      maxExecutionScope: body.maxExecutionScope,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/codex/execution-runs", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await codexExecutionRunService.listRuns(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/codex/execution-runs/:runId", async (request) => {
    const { workspaceId, runId } = request.params as { workspaceId: string; runId: string };
    const data = await codexExecutionRunService.getRun({ workspaceId, runId });
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts/:contractArtifactId/codex-execution-runs", async (request) => {
    const { workspaceId, contractArtifactId } = request.params as {
      workspaceId: string;
      contractArtifactId: string;
    };
    createCodexExecutionRunRequestSchema.parse(request.body ?? {});
    const data = await codexExecutionRunService.createQueuedRun({
      workspaceId,
      contractArtifactId,
      actorId: request.actor.id,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/codex/execution-runs/:runId/cancel", async (request) => {
    const { workspaceId, runId } = request.params as { workspaceId: string; runId: string };
    const body = cancelCodexExecutionRunRequestSchema.parse(request.body ?? {});
    const data = await codexExecutionRunService.cancelQueuedRun({
      workspaceId,
      runId,
      actorId: request.actor.id,
      reason: body.reason,
    });
    return { data, error: null, requestId: request.requestId };
  });
}
