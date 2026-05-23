import { describe, expect, it } from "vitest";
import {
  assertApprovedGithubIssueBatch,
  buildGithubIssueIdempotencyKey,
  buildGithubIssuePayload,
  resolveDryRun,
} from "./github-issue-publishing.js";

describe("github issue publishing guards", () => {
  it("blocks issue creation from unapproved github_issue_batch artifacts", () => {
    expect(() =>
      assertApprovedGithubIssueBatch({
        artifactType: "github_issue_batch",
        status: "pending_approval",
      }),
    ).toThrow("must be approved");
  });

  it("blocks issue creation from non-github issue artifacts", () => {
    expect(() =>
      assertApprovedGithubIssueBatch({
        artifactType: "task_batch",
        status: "approved",
      }),
    ).toThrow("github_issue_batch");
  });

  it("uses dry-run mode by default unless explicitly overridden", () => {
    expect(resolveDryRun({ mode: "dry_run" })).toBe(true);
    expect(resolveDryRun({ mode: "live" })).toBe(false);
    expect(resolveDryRun({ mode: "live", requestedDryRun: true })).toBe(true);
  });

  it("builds stable idempotency keys for retries", () => {
    const input = {
      workspaceId: "workspace-1",
      repository: "owner/repo",
      sourceArtifactId: "artifact-1",
      sourceTaskId: "task-1",
    };

    expect(buildGithubIssueIdempotencyKey(input)).toEqual(buildGithubIssueIdempotencyKey(input));
    expect(buildGithubIssueIdempotencyKey(input)).not.toEqual(
      buildGithubIssueIdempotencyKey({ ...input, sourceTaskId: "task-2" }),
    );
  });

  it("omits nonnumeric milestones from GitHub issue payloads", () => {
    expect(
      buildGithubIssuePayload({
        title: "Create governed GitHub issue publishing",
        body: "Body",
        labels: ["feature"],
        milestone: "MVP",
        assignees: [],
        sourceTaskId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toEqual({
      title: "Create governed GitHub issue publishing",
      body: "Body",
      labels: ["feature"],
      assignees: [],
    });
  });
});
