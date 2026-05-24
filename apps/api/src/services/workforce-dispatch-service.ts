import { taskBatchSchema, type TaskRecord, type WorkforceDispatchStatus } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";

type ActivatedAssignment = {
  id: string;
  agentId: string;
  role: string;
  currentTask: string;
  assignedArtifactId: string | null;
};

function taskText(task: Pick<TaskRecord, "title" | "description" | "type">) {
  return `${task.title} ${task.description} ${task.type}`.toLowerCase();
}

function estimateTaskComplexity(task: TaskRecord) {
  if (task.priority === "p0" || task.acceptanceCriteria.length >= 5) return "large";
  if (task.priority === "p1" || task.dependencies.length > 0 || task.acceptanceCriteria.length >= 3) return "medium";
  return "small";
}

function roleScore(task: TaskRecord, assignment: ActivatedAssignment) {
  const text = taskText(task);
  let score = 0;
  if (assignment.role.includes("Product Manager")) score += text.includes("requirement") || text.includes("scope") ? 5 : 1;
  if (assignment.role.includes("Backend")) score += text.includes("api") || text.includes("backend") || text.includes("database") || text.includes("service") ? 8 : 0;
  if (assignment.role.includes("Frontend")) score += text.includes("ui") || text.includes("frontend") || text.includes("screen") || text.includes("dashboard") ? 8 : 0;
  if (assignment.role.includes("Designer")) score += text.includes("design") || text.includes("ux") || text.includes("interface") ? 8 : 0;
  if (assignment.role.includes("DevOps")) score += text.includes("docker") || text.includes("deploy") || text.includes("infra") || text.includes("health") ? 8 : 0;
  if (assignment.role.includes("QA")) score += task.type === "test" || text.includes("test") || text.includes("quality") ? 8 : 0;
  if (assignment.role.includes("Engineering Manager")) score += text.includes("plan") || text.includes("coordinate") || text.includes("dependency") ? 5 : 2;
  if (assignment.role.includes("CTO")) score += text.includes("security") || text.includes("architecture") || text.includes("contract") ? 7 : 1;
  return score;
}

function selectAgent(task: TaskRecord, assignments: ActivatedAssignment[]) {
  return assignments
    .map((assignment) => ({ assignment, score: roleScore(task, assignment) }))
    .sort((a, b) => b.score - a.score || a.assignment.role.localeCompare(b.assignment.role))[0]?.assignment;
}

function progressMessage(task: TaskRecord, role: string) {
  const text = taskText(task);
  if (role.includes("Backend") || text.includes("api")) return "Reviewing API integration requirements.";
  if (role.includes("Frontend") || text.includes("ui")) return "Breaking frontend work into components.";
  if (role.includes("QA") || task.type === "test") return "QA review in progress.";
  if (role.includes("Product Manager")) return "Waiting for approval before continuing.";
  if (role.includes("Engineering Manager")) return "Coordinating team handoffs for the next step.";
  return "Reviewing assigned work and preparing a safe next step.";
}

function dispatchStatus(task: TaskRecord, role: string): WorkforceDispatchStatus {
  if (task.priority === "p0") return "blocked";
  if (role.includes("QA") || task.type === "test") return "review";
  return "in_progress";
}

function handoffFor(role: string) {
  if (role.includes("Product Manager")) return { toAgentId: "backend_developer", toRole: "Backend Developer Agent" };
  if (role.includes("Backend")) return { toAgentId: "qa", toRole: "QA Agent" };
  if (role.includes("Frontend")) return { toAgentId: "qa", toRole: "QA Agent" };
  if (role.includes("Engineering Manager")) return { toAgentId: "qa", toRole: "QA Agent" };
  if (role.includes("QA")) return { toAgentId: "engineering_manager", toRole: "Engineering Manager Agent" };
  return null;
}

export class WorkforceDispatchService {
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditService(db);
  }

  async dispatch(input: { workspaceId: string; actorId: string }) {
    const taskBatchArtifact = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: "task_batch", status: "approved" },
      orderBy: { createdAt: "desc" },
    });
    if (!taskBatchArtifact) {
      throw Object.assign(new Error("Approved task batch not found for dispatch."), {
        statusCode: 409,
        code: "APPROVED_TASK_BATCH_NOT_FOUND",
      });
    }

    const activatedAssignments = await this.db.agentAssignment.findMany({
      where: {
        workspaceId: input.workspaceId,
        assignedArtifactId: { not: null },
      },
      orderBy: { startedAt: "asc" },
    });
    if (activatedAssignments.length === 0) {
      throw Object.assign(new Error("Activate an approved workforce scaling plan before dispatching work."), {
        statusCode: 409,
        code: "WORKFORCE_NOT_ACTIVATED",
      });
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "workforce.dispatch.started",
      sourceArtifactIds: [taskBatchArtifact.id],
      targetArtifactIds: [],
      status: "success",
      eventJson: {
        taskBatchArtifactId: taskBatchArtifact.id,
        activatedAssignmentCount: activatedAssignments.length,
      },
    });

    const taskBatch = taskBatchSchema.parse(taskBatchArtifact.contentJson);
    const created = [];
    const skipped = [];

    for (const task of taskBatch.tasks) {
      const existing = await this.db.workforceDispatch.findUnique({
        where: { workspaceId_taskId: { workspaceId: input.workspaceId, taskId: task.taskId } },
      });
      if (existing) {
        skipped.push(existing);
        continue;
      }

      const assignment = selectAgent(task, activatedAssignments);
      if (!assignment) continue;
      const status = dispatchStatus(task, assignment.role);
      const dispatch = await this.db.workforceDispatch.create({
        data: {
          workspaceId: input.workspaceId,
          taskId: task.taskId,
          assignedAgentId: assignment.agentId,
          assignedAgentRole: assignment.role,
          assignmentReason: `${assignment.role} is best matched to "${task.title}" based on task type, keywords, and current activated team capacity.`,
          estimatedComplexity: estimateTaskComplexity(task),
          status,
          completedAt: status === "completed" ? new Date() : null,
        },
      });
      created.push(dispatch);

      await this.db.agentAssignment.update({
        where: { id: assignment.id },
        data: {
          currentTask: progressMessage(task, assignment.role),
          status: status === "review" ? "working" : status === "blocked" ? "blocked" : "working",
        },
      });

      await this.db.agentMessage.create({
        data: {
          workspaceId: input.workspaceId,
          agentId: assignment.agentId,
          agentRole: assignment.role,
          messageType: status === "blocked" ? "blocker" : status === "review" ? "review" : "update",
          relatedArtifactId: taskBatchArtifact.id,
          visibility: status === "blocked" ? "internal" : "client_visible",
          message: progressMessage(task, assignment.role),
        },
      });

      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "WorkforceDispatchService",
        action: "workforce.dispatch.assignment_created",
        sourceArtifactIds: [taskBatchArtifact.id],
        targetArtifactIds: [taskBatchArtifact.id],
        status: "success",
        eventJson: {
          dispatchId: dispatch.id,
          taskId: task.taskId,
          assignedAgentId: assignment.agentId,
          assignedAgentRole: assignment.role,
          status,
        },
      });

      const handoff = handoffFor(assignment.role);
      if (handoff) {
        await this.db.agentMessage.create({
          data: {
            workspaceId: input.workspaceId,
            agentId: assignment.agentId,
            agentRole: assignment.role,
            messageType: "handoff",
            relatedArtifactId: taskBatchArtifact.id,
            visibility: "internal",
            message: `${assignment.role} handed off next review to ${handoff.toRole}.`,
          },
        });
        await this.audit.append({
          workspaceId: input.workspaceId,
          actorType: "agent",
          actorId: assignment.agentId,
          action: "workforce.dispatch.handoff",
          sourceArtifactIds: [taskBatchArtifact.id],
          targetArtifactIds: [taskBatchArtifact.id],
          status: "success",
          eventJson: {
            dispatchId: dispatch.id,
            fromAgentId: assignment.agentId,
            fromRole: assignment.role,
            toAgentId: handoff.toAgentId,
            toRole: handoff.toRole,
          },
        });
      }
    }

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "WorkforceDispatchService",
      action: "workforce.dispatch.completed",
      sourceArtifactIds: [taskBatchArtifact.id],
      targetArtifactIds: [taskBatchArtifact.id],
      status: "success",
      eventJson: {
        taskBatchArtifactId: taskBatchArtifact.id,
        createdDispatchCount: created.length,
        skippedDispatchCount: skipped.length,
      },
    });

    return {
      taskBatchArtifactId: taskBatchArtifact.id,
      createdDispatchCount: created.length,
      skippedDispatchCount: skipped.length,
      dispatches: [...created, ...skipped],
    };
  }

  listDispatches(workspaceId: string) {
    return this.db.workforceDispatch.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      take: 100,
    });
  }
}
