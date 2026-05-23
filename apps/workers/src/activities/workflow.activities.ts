import { prisma } from "@revealth/database";
import type { Prisma } from "@prisma/client";

export async function markWorkflowStatus(input: { workflowRunId: string; status: string; outputJson?: unknown }) {
  return prisma.workflowRun.update({
    where: { id: input.workflowRunId },
    data: {
      status: input.status,
      outputJson: input.outputJson as Prisma.InputJsonValue | undefined,
      completedAt: ["completed", "failed", "blocked"].includes(input.status) ? new Date() : undefined,
    },
  });
}

export async function appendWorkflowAudit(input: {
  workspaceId: string;
  workflowRunId: string;
  actorId: string;
  action: string;
  status: "success" | "failed" | "blocked";
  eventJson: Record<string, unknown>;
  targetArtifactIds?: string[];
}) {
  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId,
      actorType: "system",
      actorId: input.actorId,
      action: input.action,
      status: input.status,
      eventJson: input.eventJson as Prisma.InputJsonValue,
      targetArtifactIds: input.targetArtifactIds ?? [],
    },
  });
}
