import type { FastifyInstance } from "fastify";
import { prisma } from "@revealth/database";
import {
  ClientCommunicationService,
  createCommunicationDraftSchema,
  createClientConversationSchema,
  createClientLeadSchema,
  createClientProfileSchema,
  evaluateExternalCommunicationPolicySchema,
  createMeetingRequestSchema,
} from "../services/client-communication-service.js";

export async function registerClientCommunicationRoutes(app: FastifyInstance): Promise<void> {
  const service = new ClientCommunicationService(prisma);

  app.get("/workspaces/:workspaceId/clients", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listClients(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/clients", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createClientProfileSchema.parse(request.body ?? {});
    const data = await service.createClient({ workspaceId, actorId: request.actor.id, body });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/leads", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listLeads(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/leads", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createClientLeadSchema.parse(request.body ?? {});
    const data = await service.createLead({ workspaceId, actorId: request.actor.id, body });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/client-conversations", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = request.query as { visibility?: "internal" | "client_visible" };
    const data = await service.listConversations(workspaceId, query.visibility);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/client-conversations", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createClientConversationSchema.parse(request.body ?? {});
    const data = await service.createConversation({ workspaceId, actorId: request.actor.id, body });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/meeting-requests", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listMeetingRequests(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/meeting-requests", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createMeetingRequestSchema.parse(request.body ?? {});
    const data = await service.createMeetingRequest({ workspaceId, actorId: request.actor.id, body });
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/leads/:leadId/client-communication-scripts", async (request) => {
    const { workspaceId, leadId } = request.params as { workspaceId: string; leadId: string };
    const data = await service.generateClientCommunicationScript({
      workspaceId,
      leadId,
      actorId: request.actor.id,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/client-communication/policy/evaluate", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = evaluateExternalCommunicationPolicySchema.parse(request.body ?? {});
    const data = await service.evaluateExternalCommunicationPolicy({
      workspaceId,
      actorId: request.actor.id,
      body,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/client-communication/drafts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listCommunicationDrafts(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/client-communication/drafts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createCommunicationDraftSchema.parse(request.body ?? {});
    const data = await service.createCommunicationDraft({
      workspaceId,
      actorId: request.actor.id,
      body,
    });
    return { data, error: null, requestId: request.requestId };
  });
}
