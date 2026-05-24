import type { FastifyInstance } from "fastify";
import { prisma } from "@revealth/database";
import { WorkforceActivationService } from "../services/workforce-activation-service.js";
import { WorkforceScalingPlanService } from "../services/workforce-scaling-plan-service.js";

export async function registerWorkforceRoutes(app: FastifyInstance): Promise<void> {
  const workforceScalingPlanService = new WorkforceScalingPlanService(prisma);
  const workforceActivationService = new WorkforceActivationService(prisma);

  app.post("/workspaces/:workspaceId/artifacts/:taskBatchArtifactId/workforce-scaling-plans", async (request) => {
    const { workspaceId, taskBatchArtifactId } = request.params as {
      workspaceId: string;
      taskBatchArtifactId: string;
    };
    const data = await workforceScalingPlanService.generateForApprovedTaskBatch({
      workspaceId,
      taskBatchArtifactId,
      actorId: request.actor.id,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/workforce-scaling-plans", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await workforceScalingPlanService.listPlans(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts/:workforceScalingPlanArtifactId/workforce/activate", async (request) => {
    const { workspaceId, workforceScalingPlanArtifactId } = request.params as {
      workspaceId: string;
      workforceScalingPlanArtifactId: string;
    };
    const data = await workforceActivationService.activateApprovedPlan({
      workspaceId,
      workforceScalingPlanArtifactId,
      actorId: request.actor.id,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/workforce/activations", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await workforceActivationService.listActivations(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });
}
