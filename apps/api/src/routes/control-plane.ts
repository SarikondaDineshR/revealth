import type { FastifyInstance } from "fastify";
import { prisma } from "@revealth/database";
import { ControlPlaneService } from "../services/control-plane-service.js";

export async function registerControlPlaneRoutes(app: FastifyInstance): Promise<void> {
  const controlPlane = new ControlPlaneService(prisma, app.config);

  app.get("/workspaces/:workspaceId/control-plane", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await controlPlane.getWorkspaceDashboard(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });
}
