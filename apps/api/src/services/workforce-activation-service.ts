import { workforceScalingPlanSchema, type WorkforceScalingPlan } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AGENT_REGISTRY } from "./agent-communication-service.js";
import { AuditService } from "./audit-service.js";

export interface WorkforceActivationResult {
  workforceScalingPlanArtifactId: string;
  status: "activated" | "skipped";
  createdAssignments: Array<{
    id: string;
    agentId: string;
    role: string;
    currentTask: string;
    assignedArtifactId: string | null;
    status: string;
  }>;
  existingAssignmentCount: number;
  message: string;
}

function agentIdForRole(role: string) {
  const agent = AGENT_REGISTRY.find((item) => item.role === role);
  if (!agent) {
    throw Object.assign(new Error(`No registered agent exists for role: ${role}`), {
      statusCode: 409,
      code: "WORKFORCE_ROLE_NOT_REGISTERED",
    });
  }
  return agent.agentId;
}

function activationTask(role: WorkforceScalingPlan["requiredRoles"][number]) {
  if (role.role.includes("Product Manager")) return "Keeping the plan clear for the owner";
  if (role.role.includes("Engineering Manager")) return "Coordinating the work plan";
  if (role.role.includes("Frontend")) return "Preparing interface work";
  if (role.role.includes("Backend")) return "Preparing service work";
  if (role.role.includes("Designer")) return "Shaping the user experience";
  if (role.role.includes("DevOps")) return "Reviewing reliability and environment risks";
  if (role.role.includes("QA")) return "Reviewing quality and acceptance criteria";
  if (role.role.includes("CTO")) return "Reviewing technical safety";
  return role.reason;
}

export class WorkforceActivationService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async activateApprovedPlan(input: {
    workspaceId: string;
    workforceScalingPlanArtifactId: string;
    actorId: string;
  }): Promise<WorkforceActivationResult> {
    const artifact = await this.db.artifact.findFirst({
      where: {
        id: input.workforceScalingPlanArtifactId,
        workspaceId: input.workspaceId,
      },
    });
    if (!artifact) throw Object.assign(new Error("Workforce scaling plan artifact not found."), { statusCode: 404 });
    if (artifact.artifactType !== "workforce_scaling_plan") {
      throw Object.assign(new Error("Activation requires a workforce_scaling_plan artifact."), {
        statusCode: 409,
        code: "INVALID_WORKFORCE_ACTIVATION_ARTIFACT",
      });
    }
    if (artifact.status !== "approved") {
      throw Object.assign(new Error("Workforce scaling plan must be approved before activation."), {
        statusCode: 409,
        code: "WORKFORCE_SCALING_PLAN_NOT_APPROVED",
      });
    }

    const approval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: artifact.id,
        artifactVersion: artifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!approval) {
      throw Object.assign(new Error("Approved workforce scaling plan approval not found."), {
        statusCode: 409,
        code: "APPROVED_WORKFORCE_SCALING_PLAN_APPROVAL_NOT_FOUND",
      });
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "workforce.activation.requested",
      sourceArtifactIds: [artifact.id],
      targetArtifactIds: [],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        workforceScalingPlanArtifactId: artifact.id,
      },
    });

    const existing = await this.db.agentAssignment.findMany({
      where: { workspaceId: input.workspaceId, assignedArtifactId: artifact.id },
      orderBy: { startedAt: "asc" },
    });
    if (existing.length > 0) {
      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "WorkforceActivationService",
        action: "workforce.activation.skipped",
        sourceArtifactIds: [artifact.id],
        targetArtifactIds: [artifact.id],
        approvalId: approval.id,
        status: "success",
        eventJson: {
          reason: "workforce_already_activated",
          workforceScalingPlanArtifactId: artifact.id,
          existingAssignmentCount: existing.length,
        },
      });
      return {
        workforceScalingPlanArtifactId: artifact.id,
        status: "skipped",
        createdAssignments: [],
        existingAssignmentCount: existing.length,
        message: "This AI team recommendation has already been activated.",
      };
    }

    const plan = workforceScalingPlanSchema.parse(artifact.contentJson);
    const createdAssignments = [];
    for (const role of plan.requiredRoles) {
      const agentId = agentIdForRole(role.role);
      for (let index = 0; index < role.recommendedAgentCount; index += 1) {
        const assignment = await this.db.agentAssignment.create({
          data: {
            workspaceId: input.workspaceId,
            agentId,
            role: role.role,
            currentTask: activationTask(role),
            assignedArtifactId: artifact.id,
            status: "working",
          },
        });
        createdAssignments.push({
          id: assignment.id,
          agentId: assignment.agentId,
          role: assignment.role,
          currentTask: assignment.currentTask,
          assignedArtifactId: assignment.assignedArtifactId,
          status: assignment.status,
        });
      }
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "WorkforceActivationService",
      action: "workforce.activation.completed",
      sourceArtifactIds: [artifact.id],
      targetArtifactIds: [artifact.id],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        workforceScalingPlanArtifactId: artifact.id,
        createdAssignmentCount: createdAssignments.length,
        roles: plan.requiredRoles.map((role) => ({
          role: role.role,
          recommendedAgentCount: role.recommendedAgentCount,
        })),
      },
    });

    return {
      workforceScalingPlanArtifactId: artifact.id,
      status: "activated",
      createdAssignments,
      existingAssignmentCount: 0,
      message: `Activated ${createdAssignments.length} AI team assignment${createdAssignments.length === 1 ? "" : "s"} from the approved recommendation.`,
    };
  }

  async listActivations(workspaceId: string) {
    return this.db.auditLog.findMany({
      where: {
        workspaceId,
        action: { in: ["workforce.activation.requested", "workforce.activation.completed", "workforce.activation.skipped"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
