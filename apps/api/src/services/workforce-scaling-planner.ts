import crypto from "node:crypto";
import type { TaskBatch, TaskRecord, WorkforceRoleRecommendation, WorkforceScalingPlan } from "@revealth/contracts";

export function assertApprovedTaskBatchForWorkforceScaling(input: { artifactType: string; status: string }) {
  if (input.artifactType !== "task_batch") {
    throw Object.assign(new Error("Workforce scaling plans can only be generated from task_batch artifacts."), {
      statusCode: 409,
      code: "INVALID_WORKFORCE_SCALING_SOURCE_ARTIFACT",
    });
  }

  if (input.status !== "approved") {
    throw Object.assign(new Error("Task batch must be approved before generating a workforce scaling plan."), {
      statusCode: 409,
      code: "TASK_BATCH_NOT_APPROVED",
    });
  }
}

export function estimateProjectComplexity(taskBatch: TaskBatch): WorkforceScalingPlan["projectComplexity"] {
  const taskCount = taskBatch.tasks.length;
  const p0OrP1Count = taskBatch.tasks.filter((task) => task.priority === "p0" || task.priority === "p1").length;
  const typeCount = new Set(taskBatch.tasks.map((task) => task.type)).size;

  if (taskCount >= 18 || p0OrP1Count >= 8 || typeCount >= 6) return "enterprise";
  if (taskCount >= 10 || p0OrP1Count >= 5 || typeCount >= 5) return "large";
  if (taskCount >= 5 || p0OrP1Count >= 2 || typeCount >= 3) return "medium";
  return "small";
}

function taskText(task: TaskRecord) {
  return `${task.title} ${task.description} ${task.type}`.toLowerCase();
}

function hasAnyTask(taskBatch: TaskBatch, keywords: string[]) {
  return taskBatch.tasks.some((task) => keywords.some((keyword) => taskText(task).includes(keyword)));
}

function countForRole(complexity: WorkforceScalingPlan["projectComplexity"], role: string) {
  if (complexity === "enterprise") return role.includes("Developer") || role === "QA Agent" ? 3 : 2;
  if (complexity === "large") return role.includes("Developer") || role === "QA Agent" ? 2 : 1;
  return 1;
}

export function recommendWorkforceRoles(taskBatch: TaskBatch): WorkforceRoleRecommendation[] {
  const complexity = estimateProjectComplexity(taskBatch);
  const roles = new Map<string, string>();

  roles.set("Product Manager Agent", "Keeps the work tied to user outcomes, scope, and owner approvals.");
  roles.set("Engineering Manager Agent", "Coordinates sequencing, dependencies, handoffs, and delivery risk.");
  roles.set("QA Agent", "Reviews acceptance criteria, test expectations, and safety before work advances.");

  if (hasAnyTask(taskBatch, ["api", "backend", "database", "prisma", "workflow", "service", "integration"])) {
    roles.set("Backend Developer Agent", "Owns backend services, data persistence, APIs, and workflow implementation planning.");
  }
  if (hasAnyTask(taskBatch, ["ui", "frontend", "screen", "dashboard", "view", "client", "design"])) {
    roles.set("Frontend Developer Agent", "Owns user-facing screens, control-plane usability, and interaction states.");
  }
  if (hasAnyTask(taskBatch, ["design", "ux", "interface", "visual", "prototype"])) {
    roles.set("Designer Agent", "Improves clarity and non-technical usability before implementation planning proceeds.");
  }
  if (hasAnyTask(taskBatch, ["docker", "deploy", "infra", "temporal", "observability", "health", "codespaces"])) {
    roles.set("DevOps Agent", "Reviews infrastructure, reliability, and operational readiness risks.");
  }
  if (hasAnyTask(taskBatch, ["security", "approval", "audit", "contract", "validation", "test"])) {
    roles.set("CTO Agent", "Reviews technical governance, architecture fit, and safety constraints.");
  }

  return [...roles.entries()].map(([role, reason]) => ({
    role,
    recommendedAgentCount: countForRole(complexity, role),
    reason,
  }));
}

export function buildWorkforceScalingPlan(input: {
  taskBatch: TaskBatch;
  sourceTaskBatchArtifactId: string;
}): WorkforceScalingPlan {
  const complexity = estimateProjectComplexity(input.taskBatch);
  const requiredRoles = recommendWorkforceRoles(input.taskBatch);
  const totalAgents = requiredRoles.reduce((sum, role) => sum + role.recommendedAgentCount, 0);
  const bottlenecks = [
    "Owner approvals can pause progress at governance checkpoints.",
    "QA and safety review may become the pacing step when many tasks change shared contracts.",
  ];

  if (requiredRoles.some((role) => role.role === "Backend Developer Agent")) {
    bottlenecks.push("Backend sequencing can block frontend or GitHub planning when API contracts are unsettled.");
  }
  if (requiredRoles.some((role) => role.role === "DevOps Agent")) {
    bottlenecks.push("Infrastructure readiness can slow validation if local Docker or Temporal services are unstable.");
  }

  return {
    schemaVersion: "revealth.workforce_scaling_plan.v1",
    workforceScalingPlanId: crypto.randomUUID(),
    sourceTaskBatchArtifactId: input.sourceTaskBatchArtifactId,
    projectComplexity: complexity,
    requiredRoles,
    assignmentStrategy:
      "Keep one owner-facing coordinator, assign specialist agents by task area, and route every blocker back through approval and audit before expanding scope.",
    expectedBottlenecks: bottlenecks,
    humanReadableSummary: `This looks like a ${complexity} project. Revealth recommends ${totalAgents} AI team member${totalAgents === 1 ? "" : "s"} across ${requiredRoles.length} role${requiredRoles.length === 1 ? "" : "s"} before moving deeper into execution planning.`,
    approvalRequired: true,
    automaticAgentCreationAllowed: false,
    sourceIds: [input.sourceTaskBatchArtifactId],
  };
}
