import type { FastifyInstance } from "fastify";
import { workspaceCreateRequestSchema } from "@revealth/contracts";
import { prisma, WorkspaceRepository } from "@revealth/database";
import { AgentCommunicationService } from "../services/agent-communication-service.js";
import { AuditService } from "../services/audit-service.js";

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  const workspaces = new WorkspaceRepository(prisma);
  const audit = new AuditService(prisma);
  const agentCommunication = new AgentCommunicationService(prisma);

  app.post("/workspaces", async (request) => {
    const body = workspaceCreateRequestSchema.parse(request.body);
    const workspace = await workspaces.create({ ownerId: request.actor.id, name: body.name });
    await audit.append({
      workspaceId: workspace.id,
      actorType: "human",
      actorId: request.actor.id,
      action: "workspace.created",
      status: "success",
      eventJson: { name: workspace.name },
    });
    await agentCommunication.initializeWorkspaceTeam({ workspaceId: workspace.id, actorId: request.actor.id });
    return { data: workspace, error: null, requestId: request.requestId };
  });

  app.get("/workspaces", async (request) => {
    const data = await workspaces.listByOwner(request.actor.id);
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId", async (request) => {
    const params = request.params as { workspaceId: string };
    const workspace = await workspaces.findById(params.workspaceId);
    if (!workspace) throw Object.assign(new Error("Workspace not found."), { statusCode: 404 });
    return { data: workspace, error: null, requestId: request.requestId };
  });
}
