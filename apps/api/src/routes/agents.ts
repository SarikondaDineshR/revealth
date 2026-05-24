import type { FastifyInstance } from "fastify";
import { prisma } from "@revealth/database";
import { createAgentAssignmentSchema, createAgentMessageSchema } from "@revealth/contracts";
import { AgentCommunicationService } from "../services/agent-communication-service.js";

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  const service = new AgentCommunicationService(prisma);

  app.get("/workspaces/:workspaceId/agents", async (request) => {
    return { data: service.listAgents(), error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/agent-assignments", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listAssignments(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/agent-messages", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = request.query as { visibility?: "internal" | "client_visible" };
    const data = await service.listMessages(workspaceId, query.visibility);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/agent-assignments", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createAgentAssignmentSchema.parse(request.body ?? {});
    const data = await service.createAssignment({ workspaceId, actorId: request.actor.id, body });
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/agent-messages", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createAgentMessageSchema.parse(request.body ?? {});
    const data = await service.createMessage({ workspaceId, actorId: request.actor.id, body });
    return { data, error: null, requestId: request.requestId };
  });
}
