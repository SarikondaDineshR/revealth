import crypto from "node:crypto";
import type { GitHubIssueBatch } from "@revealth/contracts";

export type GithubIssueCreationMode = "dry_run" | "live";

export function assertApprovedGithubIssueBatch(input: { artifactType: string; status: string }) {
  if (input.artifactType !== "github_issue_batch") {
    throw Object.assign(new Error("GitHub issues can only be created from github_issue_batch artifacts."), {
      statusCode: 409,
      code: "INVALID_GITHUB_SOURCE_ARTIFACT",
    });
  }

  if (input.status !== "approved") {
    throw Object.assign(new Error("GitHub issue batch must be approved before creating GitHub issues."), {
      statusCode: 409,
      code: "GITHUB_ISSUE_BATCH_NOT_APPROVED",
    });
  }
}

export function resolveDryRun(input: { requestedDryRun?: boolean; mode: GithubIssueCreationMode }): boolean {
  return input.requestedDryRun ?? input.mode === "dry_run";
}

export function buildGithubIssueIdempotencyKey(input: {
  workspaceId: string;
  sourceArtifactId: string;
  sourceTaskId: string;
  repository: string;
}) {
  return crypto
    .createHash("sha256")
    .update(`${input.workspaceId}:${input.repository}:${input.sourceArtifactId}:${input.sourceTaskId}`)
    .digest("hex");
}

export function buildGithubIssuePayload(issue: GitHubIssueBatch["issues"][number]) {
  return {
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    assignees: issue.assignees,
    ...(issue.milestone && /^\d+$/.test(issue.milestone) ? { milestone: Number(issue.milestone) } : {}),
  };
}
