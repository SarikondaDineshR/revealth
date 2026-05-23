import type { FastifyInstance } from "fastify";
import { approvalDecisionRequestSchema, createApprovalRequestSchema } from "@revealth/contracts";
import { ApprovalService } from "../services/approval-service.js";
import { prisma } from "@revealth/database";
import { WorkflowChainService } from "../services/workflow-chain-service.js";
import { GitHubIssueService } from "../services/github-issue-service.js";

export async function registerApprovalRoutes(app: FastifyInstance): Promise<void> {
  const service = new ApprovalService(prisma);
  const chainService = new WorkflowChainService(prisma, app.config);
  const githubIssueService = new GitHubIssueService(prisma, app.config);

  app.get("/workspaces/:workspaceId/approvals", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await prisma.approval.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/approvals", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createApprovalRequestSchema.parse(request.body);
    const approval = await service.create({
      workspaceId,
      artifactId: body.artifactId,
      artifactVersion: body.artifactVersion,
      actorId: request.actor.id,
    });
    return { data: approval, error: null, requestId: request.requestId };
  });

  const decisionRoutes = [
    ["approved", "approved"],
    ["approve", "approved"],
    ["rejected", "rejected"],
    ["reject", "rejected"],
    ["revision_requested", "revision_requested"],
    ["request-revision", "revision_requested"],
  ] as const;

  for (const [routeDecision, status] of decisionRoutes) {
    app.post(`/workspaces/:workspaceId/approvals/:approvalId/${routeDecision}`, async (request) => {
      const { workspaceId, approvalId } = request.params as { workspaceId: string; approvalId: string };
      const body = approvalDecisionRequestSchema.parse(request.body);
      const approval = await service.transition({
        workspaceId,
        approvalId,
        status,
        approverId: request.actor.id,
        decisionNotes: body.decisionNotes,
      });
      if (status === "approved") {
        await chainService.continueAfterApproval({
          workspaceId,
          approvalId,
          actorId: request.actor.id,
        });
        const approvedArtifact = await prisma.artifact.findFirst({
          where: {
            workspaceId,
            approvals: {
              some: { id: approvalId },
            },
          },
        });
        if (approvedArtifact?.artifactType === "github_issue_batch") {
          try {
            await githubIssueService.publishApprovedBatch({
              workspaceId,
              artifactId: approvedArtifact.id,
              actorId: request.actor.id,
            });
          } catch (error) {
            request.log.error({ err: error, approvalId, artifactId: approvedArtifact.id }, "github issue publishing failed");
          }
        }
      }
      return { data: approval, error: null, requestId: request.requestId };
    });
  }
}
