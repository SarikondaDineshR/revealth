import { prisma } from "@revealth/database";
import type { Prisma } from "@prisma/client";

export async function persistDraftArtifact(input: {
  workspaceId: string;
  artifactType: string;
  schemaVersion: string;
  contentJson: unknown;
  sourceArtifactIds: string[];
  parentArtifactId?: string | null;
  sourceWorkflowRunId?: string | null;
  sourceApprovalId?: string | null;
  generatedByAgent?: string | null;
  promptVersion?: string | null;
  modelProvider?: string | null;
  modelName?: string | null;
}) {
  const latest = await prisma.artifact.findFirst({
    where: { workspaceId: input.workspaceId, artifactType: input.artifactType },
    orderBy: { version: "desc" },
  });
  return prisma.artifact.create({
    data: {
      workspaceId: input.workspaceId,
      artifactType: input.artifactType,
      version: latest ? latest.version + 1 : 1,
      status: "draft",
      schemaVersion: input.schemaVersion,
      contentJson: input.contentJson as Prisma.InputJsonValue,
      sourceArtifactIds: input.sourceArtifactIds,
      parentArtifactId: input.parentArtifactId ?? null,
      sourceWorkflowRunId: input.sourceWorkflowRunId ?? null,
      sourceApprovalId: input.sourceApprovalId ?? null,
      generatedByAgent: input.generatedByAgent ?? null,
      promptVersion: input.promptVersion ?? null,
      modelProvider: input.modelProvider ?? null,
      modelName: input.modelName ?? null,
    },
  });
}

export async function getArtifact(input: { workspaceId: string; artifactId: string }) {
  const artifact = await prisma.artifact.findFirst({
    where: { workspaceId: input.workspaceId, id: input.artifactId },
  });
  if (!artifact) throw new Error("Artifact not found.");
  return artifact;
}

export async function createApprovalForArtifact(input: { workspaceId: string; artifactId: string; artifactVersion: number }) {
  const approval = await prisma.approval.create({
    data: {
      workspaceId: input.workspaceId,
      artifactId: input.artifactId,
      artifactVersion: input.artifactVersion,
      status: "pending",
    },
  });
  await prisma.artifact.update({
    where: { id: input.artifactId },
    data: { status: "pending_approval" },
  });
  return approval;
}

export async function getApprovedApprovalForArtifact(input: {
  workspaceId: string;
  artifactId: string;
  sourceApprovalId?: string | null;
}) {
  const approval = await prisma.approval.findFirst({
    where: {
      workspaceId: input.workspaceId,
      artifactId: input.artifactId,
      status: "approved",
      ...(input.sourceApprovalId ? { id: input.sourceApprovalId } : {}),
    },
    orderBy: { decidedAt: "desc" },
  });
  if (!approval) throw new Error("Approved source approval not found.");
  return approval;
}

export async function getLineageGateState(input: {
  workspaceId: string;
  artifactId: string;
  artifactType: string;
  artifactVersion: number;
  sourceApprovalId?: string | null;
}) {
  const [approval, newerArtifact] = await Promise.all([
    prisma.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: input.artifactId,
        status: "approved",
        ...(input.sourceApprovalId ? { id: input.sourceApprovalId } : {}),
      },
      orderBy: { decidedAt: "desc" },
    }),
    prisma.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: input.artifactType,
        version: { gt: input.artifactVersion },
      },
    }),
  ]);

  return {
    sourceApprovalId: approval?.id ?? null,
    hasApprovedSourceApproval: Boolean(approval),
    hasNewerUpstreamVersion: Boolean(newerArtifact),
  };
}

export async function assertNoNewerArtifactVersion(input: {
  workspaceId: string;
  artifactType: string;
  version: number;
}) {
  const newer = await prisma.artifact.findFirst({
    where: {
      workspaceId: input.workspaceId,
      artifactType: input.artifactType,
      version: { gt: input.version },
    },
  });
  if (newer) throw new Error("Source artifact is stale because a newer version exists.");
  return { ok: true };
}

export async function persistTasksFromBatch(input: {
  workspaceId: string;
  sourceArtifactId: string;
  taskBatch: {
    tasks: Array<{
      taskId: string;
      title: string;
      description: string;
      type: string;
      priority: string;
      acceptanceCriteria: string[];
      dependencies: string[];
    }>;
  };
}) {
  await prisma.task.createMany({
    data: input.taskBatch.tasks.map((task) => ({
      id: task.taskId,
      workspaceId: input.workspaceId,
      sourceArtifactId: input.sourceArtifactId,
      title: task.title,
      description: task.description,
      taskType: task.type,
      priority: task.priority,
      status: "draft",
      acceptanceCriteria: task.acceptanceCriteria as Prisma.InputJsonValue,
      dependencies: task.dependencies,
    })),
    skipDuplicates: true,
  });
  return { count: input.taskBatch.tasks.length };
}
