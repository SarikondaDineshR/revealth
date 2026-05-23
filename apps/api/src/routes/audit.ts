import type { FastifyInstance } from "fastify";
import { AuditRepository, prisma } from "@revealth/database";

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  const audit = new AuditRepository(prisma);

  app.get("/workspaces/:workspaceId/audit-events", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await audit.list(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });
}

