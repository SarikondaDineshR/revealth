import type { Prisma } from "@prisma/client";
import { approvedGithubIssueBatchSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import type { ApiEnv } from "../config/env.js";
import { AuditService } from "./audit-service.js";
import {
  assertApprovedGithubIssueBatch,
  buildGithubIssueIdempotencyKey,
  buildGithubIssuePayload,
  resolveDryRun,
} from "./github-issue-publishing.js";

interface GitHubCreateIssueResponse {
  number: number;
  html_url: string;
  node_id?: string;
}

export class GitHubIssueService {
  private readonly audit: AuditService;

  constructor(
    private readonly db: DatabaseClient,
    private readonly env: ApiEnv,
  ) {
    this.audit = new AuditService(db);
  }

  async upsertConnection(input: { workspaceId: string; repository: string; actorId: string }) {
    const connection = await this.db.gitHubConnection.upsert({
      where: {
        workspaceId_repository: {
          workspaceId: input.workspaceId,
          repository: input.repository,
        },
      },
      update: {
        status: "active",
        tokenSource: "env",
      },
      create: {
        workspaceId: input.workspaceId,
        repository: input.repository,
        status: "active",
        tokenSource: "env",
      },
    });

    await this.audit.append({
      workspaceId: input.workspaceId,
      actorType: "human",
      actorId: input.actorId,
      action: "github.repository_connection.configured",
      status: "success",
      eventJson: {
        repository: input.repository,
        tokenSource: "env",
        tokenStored: false,
      },
    });

    return connection;
  }

  listConnections(workspaceId: string) {
    return this.db.gitHubConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  listIssues(workspaceId: string) {
    return this.db.gitHubIssue.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async publishApprovedBatch(input: {
    workspaceId: string;
    artifactId: string;
    actorId: string;
    requestedDryRun?: boolean;
  }) {
    const artifact = await this.db.artifact.findFirst({
      where: { id: input.artifactId, workspaceId: input.workspaceId },
    });
    if (!artifact) throw Object.assign(new Error("Artifact not found."), { statusCode: 404 });
    assertApprovedGithubIssueBatch({ artifactType: artifact.artifactType, status: artifact.status });

    const approval = await this.db.approval.findFirst({
      where: {
        workspaceId: input.workspaceId,
        artifactId: artifact.id,
        artifactVersion: artifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!approval) {
      throw Object.assign(new Error("Approved GitHub issue batch approval not found."), {
        statusCode: 409,
        code: "APPROVED_GITHUB_BATCH_APPROVAL_NOT_FOUND",
      });
    }

    const content = approvedGithubIssueBatchSchema.parse(artifact.contentJson);
    const repository = content.repository || this.env.GITHUB_DEFAULT_REPOSITORY;
    const connection = await this.db.gitHubConnection.findFirst({
      where: { workspaceId: input.workspaceId, repository, status: "active" },
    });
    if (!connection) {
      throw Object.assign(new Error("GitHub repository connection is not configured for this workspace."), {
        statusCode: 409,
        code: "GITHUB_REPOSITORY_NOT_CONFIGURED",
      });
    }

    const dryRun = resolveDryRun({
      requestedDryRun: input.requestedDryRun,
      mode: this.env.GITHUB_ISSUE_CREATION_MODE,
    });
    if (!dryRun && !this.env.GITHUB_TOKEN) {
      throw Object.assign(new Error("GITHUB_TOKEN is required when GitHub issue creation mode is live."), {
        statusCode: 409,
        code: "GITHUB_TOKEN_REQUIRED",
      });
    }

    const results = [];
    for (const issue of content.issues) {
      const idempotencyKey = buildGithubIssueIdempotencyKey({
        workspaceId: input.workspaceId,
        sourceArtifactId: artifact.id,
        sourceTaskId: issue.sourceTaskId,
        repository,
      });
      const existing = await this.db.gitHubIssue.findUnique({ where: { idempotencyKey } });
      if (existing) {
        await this.audit.append({
          workspaceId: input.workspaceId,
          actorType: "system",
          actorId: "GitHubIssueService",
          action: "github.issue.create.skipped",
          sourceArtifactIds: [artifact.id],
          targetArtifactIds: [artifact.id],
          approvalId: approval.id,
          status: "success",
          eventJson: {
            reason: "idempotency_key_exists",
            idempotencyKey,
            githubIssueId: existing.id,
            githubIssueUrl: existing.githubIssueUrl,
            sourceTaskId: issue.sourceTaskId,
            repository,
          },
        });
        results.push(existing);
        continue;
      }

      await this.audit.append({
        workspaceId: input.workspaceId,
        actorType: "system",
        actorId: "GitHubIssueService",
        action: "github.issue.create.attempted",
        sourceArtifactIds: [artifact.id],
        targetArtifactIds: [],
        approvalId: approval.id,
        status: "success",
        eventJson: {
          dryRun,
          idempotencyKey,
          sourceTaskId: issue.sourceTaskId,
          repository,
          title: issue.title,
        },
      });

      try {
        const created = dryRun
          ? null
          : await this.createGitHubIssue({
              repository,
              payload: buildGithubIssuePayload(issue),
            });
        const record = await this.db.gitHubIssue.create({
          data: {
            workspaceId: input.workspaceId,
            taskId: issue.sourceTaskId,
            sourceArtifactId: artifact.id,
            sourceApprovalId: approval.id,
            idempotencyKey,
            repository,
            title: issue.title,
            githubIssueNumber: created?.number ?? null,
            githubIssueUrl: created?.html_url ?? null,
            githubNodeId: created?.node_id ?? null,
            status: dryRun ? "dry_run" : "created",
            dryRun,
          },
        });

        await this.audit.append({
          workspaceId: input.workspaceId,
          actorType: "system",
          actorId: "GitHubIssueService",
          action: "github.issue.create.succeeded",
          sourceArtifactIds: [artifact.id],
          targetArtifactIds: [artifact.id],
          approvalId: approval.id,
          status: "success",
          eventJson: {
            dryRun,
            idempotencyKey,
            githubIssueId: record.id,
            githubIssueNumber: record.githubIssueNumber,
            githubIssueUrl: record.githubIssueUrl,
            sourceTaskId: issue.sourceTaskId,
            repository,
          },
        });
        results.push(record);
      } catch (error) {
        await this.audit.append({
          workspaceId: input.workspaceId,
          actorType: "system",
          actorId: "GitHubIssueService",
          action: "github.issue.create.failed",
          sourceArtifactIds: [artifact.id],
          targetArtifactIds: [],
          approvalId: approval.id,
          status: "failed",
          errorCode: "GITHUB_ISSUE_CREATE_FAILED",
          eventJson: {
            idempotencyKey,
            sourceTaskId: issue.sourceTaskId,
            repository,
            message: error instanceof Error ? error.message : "Unknown GitHub issue creation failure.",
          },
        });
        throw error;
      }
    }

    return {
      artifactId: artifact.id,
      approvalId: approval.id,
      repository,
      dryRun,
      issues: results,
    };
  }

  private async createGitHubIssue(input: {
    repository: string;
    payload: Prisma.InputJsonObject;
  }): Promise<GitHubCreateIssueResponse> {
    const response = await fetch(`https://api.github.com/repos/${input.repository}/issues`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify(input.payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw Object.assign(new Error(`GitHub issue creation failed with ${response.status}: ${body}`), {
        statusCode: response.status >= 500 ? 502 : 409,
        code: "GITHUB_ISSUE_CREATE_FAILED",
      });
    }

    return (await response.json()) as GitHubCreateIssueResponse;
  }
}
