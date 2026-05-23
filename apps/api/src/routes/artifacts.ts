import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { createArtifactRequestSchema } from "@revealth/contracts";
import { ArtifactRepository, prisma } from "@revealth/database";
import { AuditService } from "../services/audit-service.js";

export async function registerArtifactRoutes(app: FastifyInstance): Promise<void> {
  const artifacts = new ArtifactRepository(prisma);
  const audit = new AuditService(prisma);

  app.get("/workspaces/:workspaceId/artifacts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const data = await artifacts.list(workspaceId);
    return { data, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/artifacts/:artifactId", async (request) => {
    const { workspaceId, artifactId } = request.params as { workspaceId: string; artifactId: string };
    const artifact = await artifacts.find(workspaceId, artifactId);
    if (!artifact) throw Object.assign(new Error("Artifact not found."), { statusCode: 404 });
    return { data: artifact, error: null, requestId: request.requestId };
  });

  app.post("/workspaces/:workspaceId/artifacts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createArtifactRequestSchema.parse(request.body);
    const artifact = await artifacts.create({
      workspaceId,
      artifactType: body.artifactType,
      schemaVersion: body.schemaVersion,
      contentJson: body.contentJson as Prisma.InputJsonValue,
      sourceArtifactIds: body.sourceArtifactIds,
      parentArtifactId: body.parentArtifactId,
      sourceWorkflowRunId: body.sourceWorkflowRunId,
      sourceApprovalId: body.sourceApprovalId,
      generatedByAgent: body.generatedByAgent,
      promptVersion: body.promptVersion,
      modelProvider: body.modelProvider,
      modelName: body.modelName,
    });
    await audit.append({
      workspaceId,
      actorType: "human",
      actorId: request.actor.id,
      action: "artifact.created",
      targetArtifactIds: [artifact.id],
      status: "success",
      eventJson: { artifactType: body.artifactType, schemaVersion: body.schemaVersion },
    });
    return { data: artifact, error: null, requestId: request.requestId };
  });

  app.get("/workspaces/:workspaceId/artifacts/:artifactId/lineage", async (request) => {
    const { workspaceId, artifactId } = request.params as { workspaceId: string; artifactId: string };
    const allArtifacts = await prisma.artifact.findMany({
      where: { workspaceId },
      orderBy: [{ artifactType: "asc" }, { version: "asc" }],
    });
    const root = allArtifacts.find((artifact) => artifact.id === artifactId);
    if (!root) throw Object.assign(new Error("Artifact not found."), { statusCode: 404 });

    const byId = new Map(allArtifacts.map((artifact) => [artifact.id, artifact]));
    const visited = new Set<string>();
    const queue = [artifactId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);
      const current = byId.get(currentId);
      if (!current) continue;

      const upstreamIds = [
        current.parentArtifactId,
        ...current.sourceArtifactIds,
      ].filter((id): id is string => Boolean(id));
      const downstreamIds = allArtifacts
        .filter(
          (artifact) =>
            artifact.parentArtifactId === current.id || artifact.sourceArtifactIds.includes(current.id),
        )
        .map((artifact) => artifact.id);

      for (const nextId of [...upstreamIds, ...downstreamIds]) {
        if (!visited.has(nextId) && byId.has(nextId)) queue.push(nextId);
      }
    }

    const nodeSet = new Set(visited);
    const nodes = allArtifacts.filter((artifact) => nodeSet.has(artifact.id));
    const edgeKeys = new Set<string>();
    const edges: Array<{ fromArtifactId: string; toArtifactId: string; relationship: "parent" | "source" }> = [];

    for (const artifact of nodes) {
      if (artifact.parentArtifactId && nodeSet.has(artifact.parentArtifactId)) {
        const key = `${artifact.parentArtifactId}:${artifact.id}:parent`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ fromArtifactId: artifact.parentArtifactId, toArtifactId: artifact.id, relationship: "parent" });
        }
      }
      for (const sourceArtifactId of artifact.sourceArtifactIds) {
        if (!nodeSet.has(sourceArtifactId)) continue;
        const key = `${sourceArtifactId}:${artifact.id}:source`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ fromArtifactId: sourceArtifactId, toArtifactId: artifact.id, relationship: "source" });
        }
      }
    }

    return {
      data: {
        rootArtifactId: artifactId,
        nodes,
        edges,
      },
      error: null,
      requestId: request.requestId,
    };
  });
}
