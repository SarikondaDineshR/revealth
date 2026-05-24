import type { Prisma } from "@prisma/client";
import { ApprovalRepository, ArtifactRepository, type DatabaseClient } from "@revealth/database";
import { AuditService } from "./audit-service.js";

const terminalStatuses = new Set(["approved", "rejected", "revision_requested", "expired", "superseded"]);
const workflowStatusByDecision = {
  approved: "completed",
  rejected: "blocked",
  revision_requested: "blocked",
} as const;

export class ApprovalService {
  private readonly approvals: ApprovalRepository;
  private readonly artifacts: ArtifactRepository;
  private readonly audit: AuditService;

  constructor(private readonly db: DatabaseClient) {
    this.approvals = new ApprovalRepository(db);
    this.artifacts = new ArtifactRepository(db);
    this.audit = new AuditService(db);
  }

  async create(input: { workspaceId: string; artifactId: string; artifactVersion: number; actorId: string }) {
    const artifact = await this.artifacts.find(input.workspaceId, input.artifactId);
    if (!artifact) throw Object.assign(new Error("Artifact not found."), { statusCode: 404 });
    if (artifact.version !== input.artifactVersion) {
      throw Object.assign(new Error("Artifact version does not match approval request."), {
        statusCode: 409,
        code: "STALE_APPROVAL",
      });
    }
    const newerArtifact = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: artifact.artifactType,
        version: { gt: input.artifactVersion },
      },
    });
    if (newerArtifact) {
      throw Object.assign(new Error("A newer artifact version already exists."), {
        statusCode: 409,
        code: "STALE_APPROVAL",
      });
    }
    const pending = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: input.artifactId,
        artifactVersion: input.artifactVersion,
        status: "pending",
      },
    });
    if (pending) return pending;

    const approval = await this.approvals.create(input);
    await this.artifacts.markPendingApproval(input.artifactId);
    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "approval.created",
      targetArtifactIds: [input.artifactId],
      approvalId: approval.id,
      status: "success",
      eventJson: { artifactVersion: input.artifactVersion },
    });
    return approval;
  }

  async transition(input: {
    workspaceId: string;
    approvalId: string;
    status: "approved" | "rejected" | "revision_requested";
    approverId: string;
    decisionNotes: string;
  }) {
    const existing = await this.approvals.find(input.workspaceId, input.approvalId);
    if (!existing) throw Object.assign(new Error("Approval not found."), { statusCode: 404 });
    if (terminalStatuses.has(existing.status)) {
      throw Object.assign(new Error("Approval is already in a terminal state."), { statusCode: 409 });
    }

    const artifact = await this.artifacts.find(input.workspaceId, existing.artifactId);
    if (!artifact) throw Object.assign(new Error("Artifact not found."), { statusCode: 404 });
    if (artifact.version !== existing.artifactVersion) {
      await this.db.approval.update({
        where: { id: existing.id },
        data: { status: "superseded" },
      });
      throw Object.assign(new Error("Approval is stale because the artifact version changed."), {
        statusCode: 409,
        code: "STALE_APPROVAL",
      });
    }
    const newerArtifact = await this.db.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactType: artifact.artifactType,
        version: { gt: existing.artifactVersion },
      },
    });
    if (newerArtifact) {
      await this.db.approval.update({
        where: { id: existing.id },
        data: { status: "superseded" },
      });
      throw Object.assign(new Error("Approval is stale because a newer artifact version exists."), {
        statusCode: 409,
        code: "STALE_APPROVAL",
      });
    }

    const result = await this.db.$transaction(
      async (tx) => {
        const approval = await tx.approval.update({
          where: { id: input.approvalId },
          data: {
            status: input.status,
            approverId: input.approverId,
            decisionNotes: input.decisionNotes,
            decidedAt: new Date(),
          },
        });

        const artifactStatus =
          input.status === "approved" ? "approved" : input.status === "rejected" ? "rejected" : "draft";
        const updatedArtifact = await tx.artifact.update({
          where: { id: existing.artifactId },
          data: { status: artifactStatus },
        });

        const workflow = await tx.workflowRun.findFirst({
          where: {
            workspaceId: input.workspaceId,
            status: "waiting_for_approval",
            outputJson: {
              path: ["approvalId"],
              equals: input.approvalId,
            },
          },
        });

        const updatedWorkflow = workflow
          ? await tx.workflowRun.update({
              where: { id: workflow.id },
              data: {
                status: workflowStatusByDecision[input.status],
                outputJson: {
                  ...((workflow.outputJson as Record<string, unknown> | null) ?? {}),
                  approvalDecision: input.status,
                  decidedAt: new Date().toISOString(),
                } as Prisma.InputJsonObject,
                completedAt: new Date(),
              },
            })
          : null;

        const audit = await tx.auditLog.create({
          data: {
            workspaceId: input.workspaceId,
            workflowRunId: updatedWorkflow?.id ?? null,
            actorType: "human",
            actorId: input.approverId,
            action: `approval.${input.status}`,
            sourceArtifactIds: [existing.artifactId],
            targetArtifactIds: [updatedArtifact.id],
            approvalId: approval.id,
            status: "success",
            eventJson: {
              decisionNotes: input.decisionNotes,
              artifactStatus,
              workflowStatus: updatedWorkflow?.status ?? null,
            },
          },
        });

        return { approval, updatedArtifact, updatedWorkflow, audit };
      },
      { timeout: 15_000 },
    );

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "ApprovalService",
      action: "approval.transition.completed",
      sourceArtifactIds: [existing.artifactId],
      targetArtifactIds: [result.updatedArtifact.id],
      approvalId: result.approval.id,
      status: "success",
      eventJson: {
        decision: input.status,
        artifactStatus: result.updatedArtifact.status,
        workflowRunId: result.updatedWorkflow?.id ?? null,
        workflowStatus: result.updatedWorkflow?.status ?? null,
      },
    });
    return result.approval;
  }
}
