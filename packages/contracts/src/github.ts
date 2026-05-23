import { z } from "zod";
import { githubIssueBatchSchema } from "./artifacts.js";
import { nonEmptyString, uuidSchema } from "./common.js";

export const githubRepositorySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Repository must use owner/name format.");

export const githubConnectionRequestSchema = z.object({
  repository: githubRepositorySchema,
});

export const publishGithubIssuesRequestSchema = z.object({
  dryRun: z.boolean().optional(),
});

export const githubIssueRecordSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  sourceArtifactId: uuidSchema,
  sourceApprovalId: uuidSchema.nullable(),
  idempotencyKey: nonEmptyString,
  repository: githubRepositorySchema,
  title: nonEmptyString,
  githubIssueNumber: z.number().int().positive().nullable(),
  githubIssueUrl: z.string().url().nullable(),
  githubNodeId: z.string().nullable(),
  status: nonEmptyString,
  dryRun: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const approvedGithubIssueBatchSchema = githubIssueBatchSchema.extend({
  repository: githubRepositorySchema,
});

export type GithubConnectionRequest = z.infer<typeof githubConnectionRequestSchema>;
export type PublishGithubIssuesRequest = z.infer<typeof publishGithubIssuesRequestSchema>;
export type GithubIssueRecord = z.infer<typeof githubIssueRecordSchema>;
