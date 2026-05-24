import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { clientCommunicationScriptSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { z } from "zod";
import { AuditService } from "./audit-service.js";

const nonEmpty = z.string().trim().min(1);

export const createClientProfileSchema = z.object({
  name: nonEmpty,
  company: nonEmpty,
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).optional(),
  status: z.enum(["lead", "prospect", "customer", "inactive"]),
  source: nonEmpty,
  notes: nonEmpty,
});

export const createClientLeadSchema = z.object({
  clientProfileId: z.string().uuid(),
  title: nonEmpty,
  needSummary: nonEmpty,
  budgetRange: z.string().trim().min(1).optional(),
  urgency: z.enum(["low", "medium", "high"]),
  stage: z.enum(["new", "discovery", "proposal_needed", "waiting_for_approval", "closed_won", "closed_lost"]),
  ownerAgentRole: nonEmpty,
});

export const createClientConversationSchema = z.object({
  clientProfileId: z.string().uuid(),
  agentRole: nonEmpty,
  channel: z.enum(["simulated_chat", "internal_note", "meeting_request"]),
  visibility: z.enum(["internal", "client_visible"]),
  message: nonEmpty,
  approvalRequired: z.boolean().default(true),
});

export const createMeetingRequestSchema = z.object({
  clientProfileId: z.string().uuid(),
  requestedByAgentRole: nonEmpty,
  purpose: nonEmpty,
  proposedTime: z.string().datetime().optional(),
  status: z.enum(["draft", "pending_approval", "approved", "rejected", "scheduled_simulated"]).default("pending_approval"),
  consentRequired: z.boolean().default(true),
});

export class ClientCommunicationService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  listClients(workspaceId: string) {
    return this.db.clientProfile.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async createClient(input: { workspaceId: string; actorId: string; body: z.input<typeof createClientProfileSchema> }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createClientProfileSchema.parse(input.body);
    const client = await this.db.clientProfile.create({
      data: {
        workspaceId: input.workspaceId,
        name: body.name,
        company: body.company,
        email: body.email ?? null,
        phone: body.phone ?? null,
        status: body.status,
        source: body.source,
        notes: body.notes,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "client.created",
      sourceArtifactIds: [],
      targetArtifactIds: [],
      status: "success",
      eventJson: {
        clientProfileId: client.id,
        status: client.status,
        source: client.source,
      },
    });

    return client;
  }

  listLeads(workspaceId: string) {
    return this.db.clientLead.findMany({
      where: { workspaceId },
      include: { clientProfile: true },
      orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
    });
  }

  async createLead(input: { workspaceId: string; actorId: string; body: z.input<typeof createClientLeadSchema> }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createClientLeadSchema.parse(input.body);
    await this.assertClient(input.workspaceId, body.clientProfileId);

    const lead = await this.db.clientLead.create({
      data: {
        workspaceId: input.workspaceId,
        clientProfileId: body.clientProfileId,
        title: body.title,
        needSummary: body.needSummary,
        budgetRange: body.budgetRange ?? null,
        urgency: body.urgency,
        stage: body.stage,
        ownerAgentRole: body.ownerAgentRole,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "lead.created",
      sourceArtifactIds: [],
      targetArtifactIds: [],
      status: "success",
      eventJson: {
        leadId: lead.id,
        clientProfileId: lead.clientProfileId,
        urgency: lead.urgency,
        stage: lead.stage,
        ownerAgentRole: lead.ownerAgentRole,
      },
    });

    return lead;
  }

  listConversations(workspaceId: string, visibility?: "internal" | "client_visible") {
    return this.db.clientConversation.findMany({
      where: { workspaceId, ...(visibility ? { visibility } : {}) },
      include: { clientProfile: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createConversation(input: {
    workspaceId: string;
    actorId: string;
    body: z.input<typeof createClientConversationSchema>;
  }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createClientConversationSchema.parse(input.body);
    await this.assertClient(input.workspaceId, body.clientProfileId);

    const conversation = await this.db.clientConversation.create({
      data: {
        workspaceId: input.workspaceId,
        clientProfileId: body.clientProfileId,
        agentRole: body.agentRole,
        channel: body.channel,
        visibility: body.visibility,
        message: body.message,
        approvalRequired: body.approvalRequired,
        approvedAt: null,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "conversation.created",
      sourceArtifactIds: [],
      targetArtifactIds: [],
      status: "success",
      eventJson: {
        conversationId: conversation.id,
        clientProfileId: conversation.clientProfileId,
        agentRole: conversation.agentRole,
        channel: conversation.channel,
        visibility: conversation.visibility,
        approvalRequired: conversation.approvalRequired,
      },
    });

    return conversation;
  }

  listMeetingRequests(workspaceId: string) {
    return this.db.meetingRequest.findMany({
      where: { workspaceId },
      include: { clientProfile: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async createMeetingRequest(input: {
    workspaceId: string;
    actorId: string;
    body: z.input<typeof createMeetingRequestSchema>;
  }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createMeetingRequestSchema.parse(input.body);
    await this.assertClient(input.workspaceId, body.clientProfileId);

    const request = await this.db.meetingRequest.create({
      data: {
        workspaceId: input.workspaceId,
        clientProfileId: body.clientProfileId,
        requestedByAgentRole: body.requestedByAgentRole,
        purpose: body.purpose,
        proposedTime: body.proposedTime ? new Date(body.proposedTime) : null,
        status: body.status,
        consentRequired: body.consentRequired,
        externalJoinEnabled: false,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "meeting_request.created",
      sourceArtifactIds: [],
      targetArtifactIds: [],
      status: "success",
      eventJson: {
        meetingRequestId: request.id,
        clientProfileId: request.clientProfileId,
        status: request.status,
        consentRequired: request.consentRequired,
        externalJoinEnabled: false,
      },
    });

    return request;
  }

  async generateClientCommunicationScript(input: { workspaceId: string; leadId: string; actorId: string }) {
    await this.assertWorkspace(input.workspaceId);
    const lead = await this.db.clientLead.findFirst({
      where: { id: input.leadId, workspaceId: input.workspaceId },
      include: { clientProfile: true },
    });
    if (!lead) {
      throw Object.assign(new Error("Lead not found."), {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
      });
    }

    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "client_communication_script" },
      orderBy: { version: "desc" },
    });

    const content = clientCommunicationScriptSchema.parse({
      schemaVersion: "revealth.client_communication_script.v1",
      clientCommunicationScriptId: crypto.randomUUID(),
      targetClient: {
        clientProfileId: lead.clientProfile.id,
        name: lead.clientProfile.name,
        company: lead.clientProfile.company,
      },
      leadId: lead.id,
      objective: `Prepare a safe discovery conversation for ${lead.title}.`,
      discoveryQuestions: [
        `What outcome would make ${lead.title} successful for your team?`,
        "What workflow is most painful today?",
        "Who needs to approve the next step before any external communication occurs?",
      ],
      valueProposition:
        "Revealth can turn the client's software idea into governed planning artifacts, approvals, and visible progress without enabling uncontrolled automation.",
      objectionHandling: [
        {
          objection: "Will the AI contact customers or change systems without permission?",
          response: "No. v0.4 records simulated communication only, keeps external communication disabled, and requires approval gates for script drafts.",
        },
        {
          objection: "How can we trust the recommendations?",
          response: "Each draft is attached to workspace state, audit logs, and owner approvals before it can become client-visible.",
        },
      ],
      nextStepRecommendation:
        "Owner should review and approve the script before any future client-facing communication feature is considered.",
      approvalRequired: true,
      externalCommunicationAllowed: false,
      sourceIds: [],
    });

    const artifact = await this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "client_communication_script",
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: content.schemaVersion,
        contentJson: content as Prisma.InputJsonObject,
        sourceArtifactIds: [],
        parentArtifactId: null,
        sourceWorkflowRunId: null,
        sourceApprovalId: null,
        generatedByAgent: "Sales Agent",
        promptVersion: "client_communication_script.v1",
        modelProvider: "none",
        modelName: "deterministic",
      },
    });

    const approval = await this.db.approval.create({
      data: {
        workspaceId: input.workspaceId,
        artifactId: artifact.id,
        artifactVersion: artifact.version,
        status: "pending",
      },
    });

    const pendingArtifact = await this.db.artifact.update({
      where: { id: artifact.id },
      data: { status: "pending_approval" },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "ClientCommunicationService",
      action: "client_communication_script.generated",
      sourceArtifactIds: [],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        clientProfileId: lead.clientProfileId,
        leadId: lead.id,
        artifactId: artifact.id,
        approvalId: approval.id,
        approvalRequired: true,
        externalCommunicationAllowed: false,
        requestedBy: input.actorId,
      },
    });

    return pendingArtifact;
  }

  private async assertWorkspace(workspaceId: string) {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw Object.assign(new Error("Workspace not found."), {
        statusCode: 404,
        code: "WORKSPACE_NOT_FOUND",
      });
    }
  }

  private async assertClient(workspaceId: string, clientProfileId: string) {
    const client = await this.db.clientProfile.findFirst({ where: { id: clientProfileId, workspaceId } });
    if (!client) {
      throw Object.assign(new Error("Client profile not found."), {
        statusCode: 404,
        code: "CLIENT_PROFILE_NOT_FOUND",
      });
    }
  }
}
