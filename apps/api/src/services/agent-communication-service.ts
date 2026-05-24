import type { Prisma } from "@prisma/client";
import { createAgentAssignmentSchema, createAgentMessageSchema, type AgentRegistryItem } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import type { z } from "zod";
import { AuditService } from "./audit-service.js";

export const AGENT_REGISTRY: AgentRegistryItem[] = [
  { agentId: "ceo", role: "CEO Agent", displayName: "CEO Agent", simpleStatusLabel: "Guiding the company plan" },
  { agentId: "cto", role: "CTO Agent", displayName: "CTO Agent", simpleStatusLabel: "Designing the system" },
  { agentId: "product_manager", role: "Product Manager Agent", displayName: "Product Manager Agent", simpleStatusLabel: "Planning your project" },
  { agentId: "engineering_manager", role: "Engineering Manager Agent", displayName: "Engineering Manager Agent", simpleStatusLabel: "Breaking work into tasks" },
  { agentId: "designer", role: "Designer Agent", displayName: "Designer Agent", simpleStatusLabel: "Shaping the user experience" },
  { agentId: "frontend_developer", role: "Frontend Developer Agent", displayName: "Frontend Developer Agent", simpleStatusLabel: "Preparing interface work" },
  { agentId: "backend_developer", role: "Backend Developer Agent", displayName: "Backend Developer Agent", simpleStatusLabel: "Preparing service work" },
  { agentId: "qa", role: "QA Agent", displayName: "QA Agent", simpleStatusLabel: "Reviewing quality" },
  { agentId: "devops", role: "DevOps Agent", displayName: "DevOps Agent", simpleStatusLabel: "Reviewing safety" },
  { agentId: "sales", role: "Sales Agent", displayName: "Sales Agent", simpleStatusLabel: "Waiting for owner approval" },
  { agentId: "customer_success", role: "Customer Success Agent", displayName: "Customer Success Agent", simpleStatusLabel: "Ready for next step" },
];

type AssignmentInput = z.input<typeof createAgentAssignmentSchema>;
type MessageInput = z.input<typeof createAgentMessageSchema>;

export class AgentCommunicationService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  listAgents() {
    return AGENT_REGISTRY;
  }

  async initializeWorkspaceTeam(input: { workspaceId: string; actorId: string }) {
    const existing = await this.db.agentAssignment.findMany({ where: { workspaceId: input.workspaceId }, take: 1 });
    if (existing.length > 0) return;

    const defaults = [
      { agentId: "ceo", role: "CEO Agent", currentTask: "Keeping the project aligned with owner goals", status: "idle" },
      { agentId: "product_manager", role: "Product Manager Agent", currentTask: "Planning your project", status: "working" },
      { agentId: "cto", role: "CTO Agent", currentTask: "Designing the system", status: "thinking" },
      { agentId: "engineering_manager", role: "Engineering Manager Agent", currentTask: "Breaking work into tasks", status: "working" },
      { agentId: "qa", role: "QA Agent", currentTask: "Reviewing safety", status: "waiting_for_approval" },
      { agentId: "devops", role: "DevOps Agent", currentTask: "Checking deployment boundaries", status: "blocked" },
    ] as const;

    for (const assignment of defaults) {
      await this.createAssignment({ workspaceId: input.workspaceId, actorId: input.actorId, body: assignment });
    }

    await this.createMessage({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      body: {
        agentId: "product_manager",
        agentRole: "Product Manager Agent",
        messageType: "update",
        visibility: "client_visible",
        message: "Planning your project and preparing the next owner approval checkpoint.",
      },
    });
    await this.createMessage({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      body: {
        agentId: "cto",
        agentRole: "CTO Agent",
        messageType: "decision",
        visibility: "internal",
        message: "Keeping execution in dry-run mode until the owner approves a future live-execution design.",
      },
    });
    await this.createMessage({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      body: {
        agentId: "devops",
        agentRole: "DevOps Agent",
        messageType: "blocker",
        visibility: "internal",
        message: "Live deployment remains blocked by policy. Dry-run validation is safe to continue.",
      },
    });
  }

  listAssignments(workspaceId: string) {
    return this.db.agentAssignment.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    });
  }

  listMessages(workspaceId: string, visibility?: "internal" | "client_visible") {
    return this.db.agentMessage.findMany({
      where: { workspaceId, ...(visibility ? { visibility } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createAssignment(input: { workspaceId: string; actorId: string; body: AssignmentInput }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createAgentAssignmentSchema.parse(input.body);
    this.assertRegisteredAgent(body.agentId);
    const assignment = await this.db.agentAssignment.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: body.agentId,
        role: body.role,
        currentTask: body.currentTask,
        assignedArtifactId: body.assignedArtifactId ?? null,
        status: body.status,
        completedAt: body.status === "completed" ? new Date() : null,
      },
    });

    await this.auditAssignment({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: "agent.assignment.created",
      assignment,
    });
    if (assignment.status !== "idle") {
      await this.auditAssignment({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        action: "agent.status.changed",
        assignment,
      });
    }

    return assignment;
  }

  async createMessage(input: { workspaceId: string; actorId: string; body: MessageInput }) {
    await this.assertWorkspace(input.workspaceId);
    const body = createAgentMessageSchema.parse(input.body);
    this.assertRegisteredAgent(body.agentId);
    const message = await this.db.agentMessage.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: body.agentId,
        agentRole: body.agentRole,
        messageType: body.messageType,
        relatedArtifactId: body.relatedArtifactId ?? null,
        relatedWorkflowRunId: body.relatedWorkflowRunId ?? null,
        visibility: body.visibility,
        message: body.message,
      },
    });

    const action =
      message.messageType === "blocker"
        ? "agent.blocker.reported"
        : message.messageType === "handoff"
          ? "agent.handoff.created"
          : "agent.message.posted";
    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "agent",
      actorId: message.agentId,
      action,
      sourceArtifactIds: message.relatedArtifactId ? [message.relatedArtifactId] : [],
      targetArtifactIds: message.relatedArtifactId ? [message.relatedArtifactId] : [],
      status: message.messageType === "blocker" ? "blocked" : "success",
      eventJson: {
        agentMessageId: message.id,
        agentRole: message.agentRole,
        messageType: message.messageType,
        visibility: message.visibility,
        relatedWorkflowRunId: message.relatedWorkflowRunId,
        postedBy: input.actorId,
      },
    });

    return message;
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

  private assertRegisteredAgent(agentId: string) {
    if (!AGENT_REGISTRY.some((agent) => agent.agentId === agentId)) {
      throw Object.assign(new Error("Agent is not registered."), {
        statusCode: 409,
        code: "AGENT_NOT_REGISTERED",
      });
    }
  }

  private auditAssignment(input: {
    workspaceId: string;
    actorId: string;
    action: "agent.assignment.created" | "agent.status.changed";
    assignment: {
      id: string;
      agentId: string;
      role: string;
      currentTask: string;
      assignedArtifactId: string | null;
      status: string;
    };
  }) {
    return this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "AgentCommunicationService",
      action: input.action,
      sourceArtifactIds: input.assignment.assignedArtifactId ? [input.assignment.assignedArtifactId] : [],
      targetArtifactIds: input.assignment.assignedArtifactId ? [input.assignment.assignedArtifactId] : [],
      status: "success",
      eventJson: {
        agentAssignmentId: input.assignment.id,
        agentId: input.assignment.agentId,
        role: input.assignment.role,
        currentTask: input.assignment.currentTask,
        status: input.assignment.status,
        requestedBy: input.actorId,
      } satisfies Prisma.InputJsonObject,
    });
  }
}
