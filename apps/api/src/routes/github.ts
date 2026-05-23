import type { FastifyInstance } from "fastify";
import { githubConnectionRequestSchema, publishGithubIssuesRequestSchema } from "@revealth/contracts";
import { prisma } from "@revealth/database";
import { GitHubIssueService } from "../services/github-issue-service.js";

export async function registerGithubRoutes(app: FastifyInstance): Promise<void> {
  const service = new GitHubIssueService(prisma, app.config);

  app.get("/workspaces/:workspaceId/github/connections", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listConnections(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/github/connections", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = githubConnectionRequestSchema.parse(request.body);
    const data = await service.upsertConnection({
      workspaceId,
      repository: body.repository,
      actorId: request.actor.id,
    });
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/github/issues", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await service.listIssues(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts/:artifactId/github-issues", async (request) => {
    const { workspaceId, artifactId } = request.params as { workspaceId: string; artifactId: string };
    const body = publishGithubIssuesRequestSchema.parse(request.body ?? {});
    const data = await service.publishApprovedBatch({
      workspaceId,
      artifactId,
      actorId: request.actor.id,
      requestedDryRun: body.dryRun,
    });
    return { data, error: null, requestId: request.requestId };
  });
}
