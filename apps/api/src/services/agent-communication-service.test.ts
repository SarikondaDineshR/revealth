import { describe, expect, it } from "vitest";
import { AGENT_REGISTRY, AgentCommunicationService } from "./agent-communication-service.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";

function createDb() {
  const state = {
    assignments: [] as Record<string, unknown>[],
    messages: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  };
  return {
    state,
    db: {
      workspace: { findUnique: async () => ({ id: workspaceId }) },
      agentAssignment: {
        findMany: async ({ where }: { where: { workspaceId: string } }) =>
          state.assignments.filter((assignment) => assignment.workspaceId === where.workspaceId),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const assignment = { id: `assignment-${state.assignments.length + 1}`, startedAt: new Date(), ...data };
          state.assignments.push(assignment);
          return assignment;
        },
      },
      agentMessage: {
        findMany: async ({ where }: { where: { workspaceId: string; visibility?: string } }) =>
          state.messages.filter(
            (message) =>
              message.workspaceId === where.workspaceId && (!where.visibility || message.visibility === where.visibility),
          ),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const message = { id: `message-${state.messages.length + 1}`, createdAt: new Date(), ...data };
          state.messages.push(message);
          return message;
        },
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.audits.push(data);
          return data;
        },
      },
    },
  };
}

describe("AgentCommunicationService", () => {
  it("exposes the internal AI company registry", () => {
    expect(AGENT_REGISTRY.map((agent) => agent.agentId)).toEqual(
      expect.arrayContaining(["ceo", "cto", "product_manager", "backend_developer", "customer_success"]),
    );
    expect(AGENT_REGISTRY).toHaveLength(11);
  });

  it("creates assignments and writes audit events", async () => {
    const { db, state } = createDb();
    const service = new AgentCommunicationService(db as never);

    const assignment = await service.createAssignment({
      workspaceId,
      actorId: "owner",
      body: {
        agentId: "product_manager",
        role: "Product Manager Agent",
        currentTask: "Planning your project",
        status: "working",
      },
    });

    expect(assignment).toMatchObject({ agentId: "product_manager", status: "working" });
    expect(state.audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["agent.assignment.created", "agent.status.changed"]),
    );
  });

  it("creates messages, filters visibility, and audits blockers", async () => {
    const { db, state } = createDb();
    const service = new AgentCommunicationService(db as never);

    await service.createMessage({
      workspaceId,
      actorId: "owner",
      body: {
        agentId: "devops",
        agentRole: "DevOps Agent",
        messageType: "blocker",
        visibility: "internal",
        message: "Live deployment remains blocked.",
      },
    });
    await service.createMessage({
      workspaceId,
      actorId: "owner",
      body: {
        agentId: "product_manager",
        agentRole: "Product Manager Agent",
        messageType: "update",
        visibility: "client_visible",
        message: "Planning your project.",
      },
    });

    const clientVisible = await service.listMessages(workspaceId, "client_visible");

    expect(clientVisible).toHaveLength(1);
    expect(clientVisible[0]).toMatchObject({ visibility: "client_visible" });
    expect(state.audits.map((audit) => audit.action)).toContain("agent.blocker.reported");
  });
});
