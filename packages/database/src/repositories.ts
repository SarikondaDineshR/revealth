import type { Prisma, PrismaClient } from "@prisma/client";

export class WorkspaceRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: { ownerId: string; name: string }) {
    return this.db.workspace.create({
      data: {
        ownerId: input.ownerId,
        name: input.name,
        status: "active",
      },
    });
  }

  listByOwner(ownerId: string) {
    return this.db.workspace.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return this.db.workspace.findUnique({ where: { id } });
  }
}

export class ArtifactRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: {
    workspaceId: string;
    artifactType: string;
    schemaVersion: string;
    contentJson: Prisma.InputJsonValue;
    sourceArtifactIds: string[];
    parentArtifactId?: string | null;
    sourceWorkflowRunId?: string | null;
    sourceApprovalId?: string | null;
    generatedByAgent?: string | null;
    promptVersion?: string | null;
    modelProvider?: string | null;
    modelName?: string | null;
  }) {
    const latest = await this.db.artifact.findFirst({
      where: { workspaceId: input.workspaceId, artifactType: input.artifactType },
      orderBy: { version: "desc" },
    });
    return this.db.artifact.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: input.artifactType,
        version: latest ? latest.version + 1 : 1,
        status: "draft",
        schemaVersion: input.schemaVersion,
        contentJson: input.contentJson,
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

  list(workspaceId: string) {
    return this.db.artifact.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  find(workspaceId: string, artifactId: string) {
    return this.db.artifact.findFirst({ where: { id: artifactId, workspaceId } });
  }

  markPendingApproval(artifactId: string) {
    return this.db.artifact.update({
      where: { id: artifactId },
      data: { status: "pending_approval" },
    });
  }

  markApproved(artifactId: string) {
    return this.db.artifact.update({
      where: { id: artifactId },
      data: { status: "approved" },
    });
  }

  markRejected(artifactId: string) {
    return this.db.artifact.update({
      where: { id: artifactId },
      data: { status: "rejected" },
    });
  }

  markRevisionRequested(artifactId: string) {
    return this.db.artifact.update({
      where: { id: artifactId },
      data: { status: "draft" },
    });
  }
}

export class ApprovalRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: { workspaceId: string; artifactId: string; artifactVersion: number }) {
    return this.db.approval.create({
      data: {
        workspaceId: input.workspaceId,
        artifactId: input.artifactId,
        artifactVersion: input.artifactVersion,
        status: "pending",
      },
    });
  }

  find(workspaceId: string, approvalId: string) {
    return this.db.approval.findFirst({ where: { id: approvalId, workspaceId } });
  }

  transition(input: {
    workspaceId: string;
    approvalId: string;
    status: "approved" | "rejected" | "revision_requested";
    approverId: string;
    decisionNotes: string;
  }) {
    return this.db.approval.update({
      where: { id: input.approvalId },
      data: {
        status: input.status,
        approverId: input.approverId,
        decisionNotes: input.decisionNotes,
        decidedAt: new Date(),
      },
    });
  }
}

export class AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  append(input: Prisma.AuditLogUncheckedCreateInput) {
    return this.db.auditLog.create({ data: input });
  }

  list(workspaceId: string) {
    return this.db.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}

export class WorkflowRunRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: { workspaceId: string; workflowType: string; inputJson: Prisma.InputJsonValue }) {
    return this.db.workflowRun.create({
      data: {
        workspaceId: input.workspaceId,
        workflowType: input.workflowType,
        status: "queued",
        inputJson: input.inputJson,
      },
    });
  }

  updateStatus(id: string, status: string, outputJson?: Prisma.InputJsonValue) {
    return this.db.workflowRun.update({
      where: { id },
      data: {
        status,
        outputJson,
        completedAt: ["completed", "failed", "blocked"].includes(status) ? new Date() : undefined,
      },
    });
  }
}
