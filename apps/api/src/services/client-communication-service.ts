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

export const communicationChannelSchema = z.enum(["simulated_only", "email_draft", "meeting_draft", "voice_draft"]);
export const consentStateSchema = z.enum(["unknown", "required", "granted", "revoked"]);

export const evaluateExternalCommunicationPolicySchema = z.object({
  channel: communicationChannelSchema,
  clientProfileId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  scriptArtifactId: z.string().uuid().optional(),
});

export const createCommunicationDraftSchema = z.object({
  clientProfileId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  scriptArtifactId: z.string().uuid().optional(),
  channel: z.enum(["email_draft", "meeting_draft", "voice_draft"]),
  subject: z.string().trim().min(1).optional(),
  createdByAgentRole: nonEmpty.default("Sales Agent"),
});

export const decideCommunicationDraftSchema = z.object({
  decisionNotes: z.string().trim().min(1).default("Owner reviewed communication draft."),
});

type PolicyEvaluation = {
  allowed: boolean;
  blockers: string[];
  requiredApprovals: string[];
  requiredConsent: string[];
  nextSafeAction: string;
  policy: {
    id: string;
    allowedChannel: z.infer<typeof communicationChannelSchema>;
    consentState: z.infer<typeof consentStateSchema>;
    clientApproved: boolean;
    leadApproved: boolean;
    ownerApprovalRequired: boolean;
    auditRequired: boolean;
    status: string;
  };
};

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

  listExternalCommunicationPolicies(workspaceId: string) {
    return this.db.externalCommunicationPolicy.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    });
  }

  listCommunicationDrafts(workspaceId: string) {
    return this.db.communicationDraft.findMany({
      where: { workspaceId },
      include: { clientProfile: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  listOutboundAuthorizations(workspaceId: string) {
    return this.db.outboundAuthorization.findMany({
      where: { workspaceId },
      include: { communicationDraft: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  async createCommunicationDraft(input: {
    workspaceId: string;
    actorId: string;
    body: z.input<typeof createCommunicationDraftSchema>;
  }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createCommunicationDraftSchema.parse(input.body);
    const client = await this.assertClient(input.workspaceId, body.clientProfileId);
    const lead = body.leadId ? await this.assertLead(input.workspaceId, body.leadId) : null;

    const scriptArtifact = body.scriptArtifactId
      ? await this.db.artifact.findFirst({
          where: {
            id: body.scriptArtifactId,
            workspaceId: input.workspaceId,
            artifactType: "client_communication_script",
            status: "approved",
          },
        })
      : null;
    if (!scriptArtifact) {
      throw Object.assign(new Error("Approved client communication script is required for communication drafts."), {
        statusCode: 409,
        code: "APPROVED_CLIENT_COMMUNICATION_SCRIPT_REQUIRED",
      });
    }

    const policyEvaluation = await this.evaluateExternalCommunicationPolicy({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      body: {
        channel: body.channel,
        clientProfileId: body.clientProfileId,
        leadId: body.leadId,
        scriptArtifactId: body.scriptArtifactId,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "ClientCommunicationService",
      action: "communication_draft.policy_checked",
      sourceArtifactIds: [scriptArtifact.id],
      targetArtifactIds: [scriptArtifact.id],
      status: policyEvaluation.allowed ? "success" : "blocked",
      eventJson: {
        channel: body.channel,
        clientProfileId: body.clientProfileId,
        leadId: body.leadId ?? null,
        scriptArtifactId: scriptArtifact.id,
        policyAllowed: policyEvaluation.allowed,
        blockers: policyEvaluation.blockers,
      },
    });

    const subject =
      body.subject ??
      (body.channel === "email_draft"
        ? `Discovery follow-up for ${client.company}`
        : body.channel === "meeting_draft"
          ? `Meeting draft for ${client.company}`
          : `Voice draft for ${client.company}`);
    const draftBody = [
      `Draft channel: ${body.channel}`,
      `Client: ${client.name} (${client.company})`,
      lead ? `Lead: ${lead.title}` : "Lead: not attached",
      "",
      "Purpose:",
      "Prepare an owner-reviewable client communication draft inside Revealth.",
      "",
      "Message draft:",
      `Hi ${client.name},`,
      "Thank you for sharing the current need. Revealth is preparing a governed discovery plan that keeps approvals, consent, and audit evidence visible before any external communication occurs.",
      "The next safe step is for the owner to review this draft and decide whether it should remain internal, be revised, or move toward a future approved external workflow.",
      "",
      "Safety note:",
      "This draft is internal only. No email, meeting, voice call, SMS, calendar event, or external message has been sent.",
    ].join("\n");

    const draft = await this.db.communicationDraft.create({
      data: {
        workspaceId: input.workspaceId,
        clientProfileId: body.clientProfileId,
        leadId: body.leadId ?? null,
        scriptArtifactId: scriptArtifact.id,
        channel: body.channel,
        subject,
        body: draftBody,
        status: "pending_approval",
        policyEvaluationJson: policyEvaluation as unknown as Prisma.InputJsonObject,
        createdByAgentRole: body.createdByAgentRole,
        approvedAt: null,
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "ClientCommunicationService",
      action: "communication_draft.generated",
      sourceArtifactIds: [scriptArtifact.id],
      targetArtifactIds: [scriptArtifact.id],
      status: "success",
      eventJson: {
        communicationDraftId: draft.id,
        channel: draft.channel,
        clientProfileId: draft.clientProfileId,
        leadId: draft.leadId,
        scriptArtifactId: draft.scriptArtifactId,
        status: draft.status,
        externalSendAllowed: false,
      },
    });
    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "ClientCommunicationService",
      action: "communication_draft.approval_required",
      sourceArtifactIds: [scriptArtifact.id],
      targetArtifactIds: [scriptArtifact.id],
      status: "blocked",
      eventJson: {
        communicationDraftId: draft.id,
        channel: draft.channel,
        requiredApproval: "Owner must approve this internal draft before any future external communication workflow can be considered.",
      },
    });

    return draft;
  }

  async decideCommunicationDraft(input: {
    workspaceId: string;
    draftId: string;
    actorId: string;
    decision: "approved" | "rejected" | "revision_requested";
    body: z.input<typeof decideCommunicationDraftSchema>;
  }) {
    await this.assertWorkspace(input.workspaceId);
    const body = decideCommunicationDraftSchema.parse(input.body);
    const draft = await this.db.communicationDraft.findFirst({
      where: { id: input.draftId, workspaceId: input.workspaceId },
    });
    if (!draft) {
      throw Object.assign(new Error("Communication draft not found."), {
        statusCode: 404,
        code: "COMMUNICATION_DRAFT_NOT_FOUND",
      });
    }
    if (draft.status === "approved" || draft.status === "rejected") {
      throw Object.assign(new Error("Communication draft is already in a terminal state."), {
        statusCode: 409,
        code: "COMMUNICATION_DRAFT_TERMINAL",
      });
    }

    const ownerApprovalId = crypto.randomUUID();
    const nextDraftStatus =
      input.decision === "approved" ? "approved" : input.decision === "rejected" ? "rejected" : "draft";
    const authorizationStatus = input.decision === "approved" ? "authorized_draft_only" : "blocked";
    const policyEvaluation = draft.policyEvaluationJson;
    const consentState = this.extractConsentState(policyEvaluation);

    const updatedDraft = await this.db.communicationDraft.update({
      where: { id: draft.id },
      data: {
        status: nextDraftStatus,
        approvedAt: input.decision === "approved" ? new Date() : null,
      },
    });

    const authorization = await this.db.outboundAuthorization.create({
      data: {
        workspaceId: input.workspaceId,
        communicationDraftId: draft.id,
        channel: draft.channel,
        status: authorizationStatus,
        consentState,
        ownerApprovalId,
        policyEvaluationJson: policyEvaluation as Prisma.InputJsonValue,
        externalSendEnabled: false,
      },
    });

    const decisionAction =
      input.decision === "approved"
        ? "communication_draft.approved"
        : input.decision === "rejected"
          ? "communication_draft.rejected"
          : "communication_draft.revision_requested";
    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: decisionAction,
      sourceArtifactIds: draft.scriptArtifactId ? [draft.scriptArtifactId] : [],
      targetArtifactIds: draft.scriptArtifactId ? [draft.scriptArtifactId] : [],
      status: input.decision === "approved" ? "success" : "blocked",
      eventJson: {
        communicationDraftId: draft.id,
        decision: input.decision,
        decisionNotes: body.decisionNotes,
        ownerApprovalId,
        draftStatus: updatedDraft.status,
        externalSendEnabled: false,
      },
    });
    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "ClientCommunicationService",
      action: input.decision === "approved" ? "outbound_authorization.created" : "outbound_authorization.blocked",
      sourceArtifactIds: draft.scriptArtifactId ? [draft.scriptArtifactId] : [],
      targetArtifactIds: draft.scriptArtifactId ? [draft.scriptArtifactId] : [],
      status: input.decision === "approved" ? "success" : "blocked",
      eventJson: {
        outboundAuthorizationId: authorization.id,
        communicationDraftId: draft.id,
        channel: authorization.channel,
        authorizationStatus: authorization.status,
        consentState: authorization.consentState,
        ownerApprovalId,
        externalSendEnabled: false,
      },
    });

    return { draft: updatedDraft, authorization };
  }


  async evaluateExternalCommunicationPolicy(input: {
    workspaceId: string;
    actorId: string;
    body: z.input<typeof evaluateExternalCommunicationPolicySchema>;
  }): Promise<PolicyEvaluation> {
    await this.assertWorkspace(input.workspaceId);
    const body = evaluateExternalCommunicationPolicySchema.parse(input.body);
    const blockers: string[] = [];
    const requiredApprovals: string[] = [];
    const requiredConsent: string[] = [];

    let policy = await this.db.externalCommunicationPolicy.findFirst({
      where: {
        workspaceId: input.workspaceId,
        allowedChannel: body.channel,
        clientProfileId: body.clientProfileId ?? null,
        leadId: body.leadId ?? null,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!policy) {
      policy = await this.db.externalCommunicationPolicy.create({
        data: {
          workspaceId: input.workspaceId,
          clientProfileId: body.clientProfileId ?? null,
          leadId: body.leadId ?? null,
          allowedChannel: body.channel,
          consentState: "unknown",
          clientApproved: false,
          leadApproved: false,
          ownerApprovalRequired: true,
          auditRequired: true,
          status: "active",
          notes: "Default blocked policy created by policy evaluation. External communication remains disabled until reviewed.",
        },
      });
    }

    if (body.clientProfileId) await this.assertClient(input.workspaceId, body.clientProfileId);
    if (body.leadId) await this.assertLead(input.workspaceId, body.leadId);

    const approvedScript = body.scriptArtifactId
      ? await this.db.artifact.findFirst({
          where: {
            id: body.scriptArtifactId,
            workspaceId: input.workspaceId,
            artifactType: "client_communication_script",
            status: "approved",
          },
        })
      : null;
    const approvedScriptApproval = approvedScript
      ? await this.db.approval.findFirst({
          where: {
            workspaceId: input.workspaceId,
            artifactId: approvedScript.id,
            artifactVersion: approvedScript.version,
            status: "approved",
          },
          orderBy: { decidedAt: "desc" },
        })
      : null;

    if (!approvedScript || !approvedScriptApproval) {
      blockers.push("approved_client_communication_script_required");
      requiredApprovals.push("Approve a client_communication_script artifact before any future communication action.");
    }
    if (!policy.clientApproved) {
      blockers.push("approved_client_required");
      requiredApprovals.push("Approve the client profile for external communication readiness.");
    }
    if (!policy.leadApproved) {
      blockers.push("approved_lead_required");
      requiredApprovals.push("Approve the lead/opportunity for external communication readiness.");
    }
    if (body.channel !== "simulated_only" && policy.consentState !== "granted") {
      blockers.push("consent_granted_required");
      requiredConsent.push(`Client consent must be granted before ${body.channel} can be considered.`);
    }
    if (policy.ownerApprovalRequired && !approvedScriptApproval) {
      blockers.push("owner_approval_required");
    }
    if (!policy.auditRequired) {
      blockers.push("audit_required");
    }

    const allowed = blockers.length === 0;
    const nextSafeAction = allowed
      ? "Proceed only to the next approved draft step. Do not send, schedule, call, or join externally."
      : "Keep communication internal. Resolve approvals and consent before any external channel is reconsidered.";

    const evaluation: PolicyEvaluation = {
      allowed,
      blockers: Array.from(new Set(blockers)),
      requiredApprovals: Array.from(new Set(requiredApprovals)),
      requiredConsent: Array.from(new Set(requiredConsent)),
      nextSafeAction,
      policy: {
        id: policy.id,
        allowedChannel: communicationChannelSchema.parse(policy.allowedChannel),
        consentState: consentStateSchema.parse(policy.consentState),
        clientApproved: policy.clientApproved,
        leadApproved: policy.leadApproved,
        ownerApprovalRequired: policy.ownerApprovalRequired,
        auditRequired: policy.auditRequired,
        status: policy.status,
      },
    };

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "external_communication_policy.evaluated",
      sourceArtifactIds: body.scriptArtifactId ? [body.scriptArtifactId] : [],
      targetArtifactIds: body.scriptArtifactId ? [body.scriptArtifactId] : [],
      approvalId: approvedScriptApproval?.id ?? undefined,
      status: allowed ? "success" : "blocked",
      eventJson: {
        channel: body.channel,
        clientProfileId: body.clientProfileId ?? null,
        leadId: body.leadId ?? null,
        scriptArtifactId: body.scriptArtifactId ?? null,
        allowed,
        blockers: evaluation.blockers,
        requiredApprovals: evaluation.requiredApprovals,
        requiredConsent: evaluation.requiredConsent,
        nextSafeAction,
        policyId: policy.id,
      },
    });

    return evaluation;
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
    return client;
  }

  private async assertLead(workspaceId: string, leadId: string) {
    const lead = await this.db.clientLead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) {
      throw Object.assign(new Error("Lead not found."), {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
      });
    }
    return lead;
  }

  private extractConsentState(policyEvaluation: unknown): z.infer<typeof consentStateSchema> {
    if (!policyEvaluation || typeof policyEvaluation !== "object" || Array.isArray(policyEvaluation)) return "unknown";
    const policy = (policyEvaluation as Record<string, unknown>).policy;
    if (policy && typeof policy === "object" && !Array.isArray(policy)) {
      const value = (policy as Record<string, unknown>).consentState;
      const parsed = consentStateSchema.safeParse(value);
      if (parsed.success) return parsed.data;
    }
    return "unknown";
  }
}
