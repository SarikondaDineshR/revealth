import type { FastifyInstance } from "fastify";
import { prisma } from "@revealth/database";
import { WorkforceScalingPlanService } from "../services/workforce-scaling-plan-service.js";

export async function registerWorkforceRoutes(app: FastifyInstance): Promise<void> {
  const workforceScalingPlanService = new WorkforceScalingPlanService(prisma);

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
}
