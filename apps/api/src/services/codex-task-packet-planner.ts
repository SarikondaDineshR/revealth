import crypto from "node:crypto";
import type { CodexTaskPacket, TaskBatch, TaskRecord } from "@revealth/contracts";

export function assertApprovedTaskBatch(input: { artifactType: string; status: string }) {
  if (input.artifactType !== "task_batch") {
    throw Object.assign(new Error("Codex task packets can only be generated from task_batch artifacts."), {
      statusCode: 409,
      code: "INVALID_CODEX_PACKET_SOURCE_ARTIFACT",
    });
  }

  if (input.status !== "approved") {
    throw Object.assign(new Error("Task batch must be approved before generating Codex task packets."), {
      statusCode: 409,
      code: "TASK_BATCH_NOT_APPROVED",
    });
  }
}

export function recommendBranchName(task: Pick<TaskRecord, "taskId" | "title" | "type">) {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `codex/${task.type}-${slug || task.taskId.slice(0, 8)}`;
}

export function inferLikelyFiles(task: Pick<TaskRecord, "title" | "description" | "type">) {
  const text = `${task.title} ${task.description}`.toLowerCase();
  const files = new Set<string>();

  if (text.includes("api") || text.includes("route") || text.includes("service")) {
    files.add("apps/api/src/routes/**/*.ts");
    files.add("apps/api/src/services/**/*.ts");
  }
  if (text.includes("worker") || text.includes("temporal") || text.includes("workflow")) {
    files.add("apps/workers/src/workflows/**/*.ts");
    files.add("apps/workers/src/activities/**/*.ts");
  }
  if (text.includes("schema") || text.includes("database") || text.includes("prisma") || text.includes("persist")) {
    files.add("packages/database/prisma/schema.prisma");
    files.add("packages/database/prisma/migrations/**/migration.sql");
  }
  if (text.includes("contract") || text.includes("zod") || text.includes("validation")) {
    files.add("packages/contracts/src/**/*.ts");
  }
  if (text.includes("ui") || text.includes("frontend") || text.includes("screen")) {
    files.add("apps/web/src/app/**/*.tsx");
    files.add("apps/web/src/lib/**/*.ts");
  }
  if (task.type === "test" || text.includes("test")) {
    files.add("apps/**/src/**/*.test.ts");
    files.add("packages/**/src/**/*.test.ts");
  }

  if (files.size === 0) {
    files.add("apps/api/src/**/*.ts");
    files.add("packages/contracts/src/**/*.ts");
    files.add("packages/database/prisma/schema.prisma");
  }

  return [...files];
}

export function buildCodexTaskPacket(input: {
  task: TaskRecord;
  sourceTaskBatchArtifactId: string;
  sourceTaskBatchApprovalId: string;
  sourceWorkflowRunId: string | null;
  parentArtifactId: string | null;
  sourceArtifactIds: string[];
}): CodexTaskPacket {
  return {
    codexTaskPacketId: `codex-packet-${input.task.taskId}`,
    taskId: input.task.taskId,
    sourceArtifactLineage: {
      sourceTaskBatchArtifactId: input.sourceTaskBatchArtifactId,
      sourceTaskBatchApprovalId: input.sourceTaskBatchApprovalId,
      sourceWorkflowRunId: input.sourceWorkflowRunId,
      parentArtifactId: input.parentArtifactId,
      sourceArtifactIds: input.sourceArtifactIds,
    },
    businessObjective: input.task.description,
    technicalObjective: `Implement the ${input.task.type} task: ${input.task.title}.`,
    filesLikelyInvolved: inferLikelyFiles(input.task),
    implementationConstraints: [
      "Do not begin code changes until a human approves this Codex task packet batch.",
      "Create or reference GitHub issue tracking before any future implementation work.",
      "Preserve existing architecture and schema contracts unless the approved task explicitly requires changes.",
      "Keep changes scoped to this task and maintain artifact lineage in audit logs.",
    ],
    acceptanceCriteria: input.task.acceptanceCriteria,
    testExpectations: [
      "Run relevant type checks for every touched TypeScript package.",
      "Add or update focused tests for modified service, route, workflow, or contract behavior.",
      "Run existing tests in the affected workspace packages before requesting review.",
    ],
    branchNameRecommendation: recommendBranchName(input.task),
    prTitleRecommendation: `${input.task.title}`,
    rollbackNotes:
      "Rollback should revert only the future implementation commit(s) for this task and leave planning artifacts, approvals, and audit logs intact.",
    securityNotes: [
      "Do not add secrets to source control, logs, artifacts, or generated prompts.",
      "Avoid broad external side effects; require explicit approval before network, GitHub, deployment, or billing actions.",
      "Validate all request and artifact payloads with shared schemas before persistence.",
    ],
  };
}

export function buildCodexTaskPacketBatch(input: {
  taskBatch: TaskBatch;
  sourceTaskBatchArtifactId: string;
  sourceTaskBatchApprovalId: string;
  sourceWorkflowRunId: string | null;
  parentArtifactId: string | null;
  sourceArtifactIds: string[];
}) {
  return {
    schemaVersion: "revealth.codex_task_packet_batch.v1" as const,
    codexTaskPacketBatchId: crypto.randomUUID(),
    sourceTaskBatchArtifactId: input.sourceTaskBatchArtifactId,
    packets: input.taskBatch.tasks.map((task) =>
      buildCodexTaskPacket({
        task,
        sourceTaskBatchArtifactId: input.sourceTaskBatchArtifactId,
        sourceTaskBatchApprovalId: input.sourceTaskBatchApprovalId,
        sourceWorkflowRunId: input.sourceWorkflowRunId,
        parentArtifactId: input.parentArtifactId,
        sourceArtifactIds: input.sourceArtifactIds,
      }),
    ),
    approvalRequired: true as const,
    executionAllowed: false as const,
    branchCreationAllowed: false as const,
    pullRequestCreationAllowed: false as const,
    sourceIds: [input.sourceTaskBatchArtifactId],
  };
}
