import { describe, expect, it } from "vitest";
import { ClientCommunicationService } from "./client-communication-service.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actorId = "00000000-0000-4000-8000-000000000001";

function createDb() {
  const state = {
    clients: [] as Record<string, unknown>[],
    leads: [] as Record<string, unknown>[],
    conversations: [] as Record<string, unknown>[],
    meetingRequests: [] as Record<string, unknown>[],
    policies: [] as Record<string, unknown>[],
    artifacts: [] as Record<string, unknown>[],
    approvals: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  };
  return {
    state,
    db: {
      workspace: { findUnique: async () => ({ id: workspaceId }) },
      clientProfile: {
        findMany: async ({ where }: { where: { workspaceId: string } }) =>
          state.clients.filter((client) => client.workspaceId === where.workspaceId),
        findFirst: async ({ where }: { where: { id?: string; workspaceId: string } }) =>
          state.clients.find((client) => client.workspaceId === where.workspaceId && (!where.id || client.id === where.id)) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const client = { id: `11111111-1111-4111-8111-00000000000${state.clients.length + 1}`, createdAt: new Date(), ...data };
          state.clients.push(client);
          return client;
        },
      },
      clientLead: {
        findMany: async ({ where }: { where: { workspaceId: string } }) =>
          state.leads.filter((lead) => lead.workspaceId === where.workspaceId),
        findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => {
          const lead = state.leads.find((candidate) => candidate.id === where.id && candidate.workspaceId === where.workspaceId);
          const clientProfile = state.clients.find((client) => client.id === lead?.clientProfileId);
          return lead ? { ...lead, clientProfile } : null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const lead = { id: `22222222-2222-4222-8222-00000000000${state.leads.length + 1}`, createdAt: new Date(), ...data };
          state.leads.push(lead);
          return lead;
        },
      },
      clientConversation: {
        findMany: async ({ where }: { where: { workspaceId: string; visibility?: string } }) =>
          state.conversations.filter(
            (conversation) =>
              conversation.workspaceId === where.workspaceId && (!where.visibility || conversation.visibility === where.visibility),
          ),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const conversation = { id: `conversation-${state.conversations.length + 1}`, createdAt: new Date(), ...data };
          state.conversations.push(conversation);
          return conversation;
        },
      },
      meetingRequest: {
        findMany: async ({ where }: { where: { workspaceId: string } }) =>
          state.meetingRequests.filter((request) => request.workspaceId === where.workspaceId),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const request = { id: `meeting-${state.meetingRequests.length + 1}`, createdAt: new Date(), ...data };
          state.meetingRequests.push(request);
          return request;
        },
      },
      externalCommunicationPolicy: {
        findMany: async ({ where }: { where: { workspaceId: string } }) =>
          state.policies.filter((policy) => policy.workspaceId === where.workspaceId),
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          state.policies.find(
            (policy) =>
              policy.workspaceId === where.workspaceId &&
              policy.allowedChannel === where.allowedChannel &&
              policy.clientProfileId === where.clientProfileId &&
              policy.leadId === where.leadId &&
              policy.status === where.status,
          ) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const policy = { id: `policy-${state.policies.length + 1}`, createdAt: new Date(), ...data };
          state.policies.push(policy);
          return policy;
        },
      },
      artifact: {
        findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => {
          if (!where) return state.artifacts.at(-1) ?? null;
          return (
            state.artifacts.find(
              (artifact) =>
                (!where.id || artifact.id === where.id) &&
                (!where.workspaceId || artifact.workspaceId === where.workspaceId) &&
                (!where.artifactType || artifact.artifactType === where.artifactType) &&
                (!where.status || artifact.status === where.status),
            ) ?? null
          );
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const artifact = { id: `33333333-3333-4333-8333-00000000000${state.artifacts.length + 1}`, createdAt: new Date(), ...data };
          state.artifacts.push(artifact);
          return artifact;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const artifact = state.artifacts.find((candidate) => candidate.id === where.id);
          Object.assign(artifact ?? {}, data);
          return artifact;
        },
      },
      approval: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const approval = { id: `44444444-4444-4444-8444-00000000000${state.approvals.length + 1}`, createdAt: new Date(), ...data };
          state.approvals.push(approval);
          return approval;
        },
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          state.approvals.find(
            (approval) =>
              approval.workspaceId === where.workspaceId &&
              approval.artifactId === where.artifactId &&
              approval.artifactVersion === where.artifactVersion &&
              approval.status === where.status,
          ) ?? null,
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

describe("ClientCommunicationService", () => {
  it("creates client pipeline records and audits every governed action", async () => {
    const { db, state } = createDb();
    const service = new ClientCommunicationService(db as never);

    const client = await service.createClient({
      workspaceId,
      actorId,
      body: {
        name: "Ada Lovelace",
        company: "Analytical Engines LLC",
        email: "ada@example.com",
        status: "lead",
        source: "demo",
        notes: "Interested in governed software planning.",
      },
    });
    const lead = await service.createLead({
      workspaceId,
      actorId,
      body: {
        clientProfileId: client.id,
        title: "Password manager MVP",
        needSummary: "Needs safe planning before security implementation.",
        urgency: "medium",
        stage: "discovery",
        ownerAgentRole: "Sales Agent",
      },
    });
    await service.createConversation({
      workspaceId,
      actorId,
      body: {
        clientProfileId: client.id,
        agentRole: "Sales Agent",
        channel: "simulated_chat",
        visibility: "client_visible",
        message: "Drafting a safe discovery update for approval.",
        approvalRequired: true,
      },
    });
    const meeting = await service.createMeetingRequest({
      workspaceId,
      actorId,
      body: {
        clientProfileId: client.id,
        requestedByAgentRole: "Customer Success Agent",
        purpose: "Simulated discovery review",
        status: "pending_approval",
        consentRequired: true,
      },
    });
    const script = await service.generateClientCommunicationScript({ workspaceId, leadId: lead.id, actorId });

    expect(meeting).toMatchObject({ externalJoinEnabled: false, consentRequired: true });
    expect(script).toMatchObject({ artifactType: "client_communication_script", status: "pending_approval" });
    expect(state.approvals).toHaveLength(1);
    expect(state.audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        "client.created",
        "lead.created",
        "conversation.created",
        "meeting_request.created",
        "client_communication_script.generated",
      ]),
    );
  });

  it("filters client-visible conversations", async () => {
    const { db } = createDb();
    const service = new ClientCommunicationService(db as never);
    const client = await service.createClient({
      workspaceId,
      actorId,
      body: { name: "Grace Hopper", company: "Compiler Co", status: "prospect", source: "demo", notes: "Demo client." },
    });

    await service.createConversation({
      workspaceId,
      actorId,
      body: {
        clientProfileId: client.id,
        agentRole: "Support Agent",
        channel: "internal_note",
        visibility: "internal",
        message: "Internal prep note.",
      },
    });
    await service.createConversation({
      workspaceId,
      actorId,
      body: {
        clientProfileId: client.id,
        agentRole: "Support Agent",
        channel: "simulated_chat",
        visibility: "client_visible",
        message: "Client-safe simulated update.",
      },
    });

    const visible = await service.listConversations(workspaceId, "client_visible");
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ visibility: "client_visible" });
  });

  it("blocks external communication by default and writes policy audit evidence", async () => {
    const { db, state } = createDb();
    const service = new ClientCommunicationService(db as never);
    const client = await service.createClient({
      workspaceId,
      actorId,
      body: { name: "Katherine Johnson", company: "Orbital Math", status: "lead", source: "demo", notes: "Demo client." },
    });
    const lead = await service.createLead({
      workspaceId,
      actorId,
      body: {
        clientProfileId: client.id,
        title: "Operations dashboard",
        needSummary: "Needs policy-gated client communication.",
        urgency: "high",
        stage: "discovery",
        ownerAgentRole: "Sales Agent",
      },
    });
    const script = await service.generateClientCommunicationScript({ workspaceId, leadId: lead.id, actorId });

    const evaluation = await service.evaluateExternalCommunicationPolicy({
      workspaceId,
      actorId,
      body: {
        channel: "email_draft",
        clientProfileId: client.id,
        leadId: lead.id,
        scriptArtifactId: script.id,
      },
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        "approved_client_communication_script_required",
        "approved_client_required",
        "approved_lead_required",
        "consent_granted_required",
      ]),
    );
    expect(evaluation.requiredConsent).toHaveLength(1);
    expect(state.policies).toHaveLength(1);
    expect(state.audits.map((audit) => audit.action)).toContain("external_communication_policy.evaluated");
  });
});
