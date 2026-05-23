import { z } from "zod";
import { nonEmptyString, uuidSchema } from "./common.js";

export const generateCodexTaskPacketsRequestSchema = z.object({
  repository: z.string().trim().min(1).optional(),
});

export const generateGitExecutionPlanRequestSchema = z.object({
  requiredReviewers: z.array(z.string().trim().min(1)).default(["human-owner"]),
});

export const generateCodexExecutionContractRequestSchema = z.object({
  maxExecutionScope: z.string().trim().min(1).default("single approved Git execution plan only"),
});

export const codexExecutionRunStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);

export const createCodexExecutionRunRequestSchema = z.object({});

export const cancelCodexExecutionRunRequestSchema = z.object({
  reason: z.string().trim().min(1).default("Cancelled by human owner before execution started."),
});

export const codexExecutionRunSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  contractArtifactId: uuidSchema,
  sourceGitExecutionPlanId: uuidSchema,
  idempotencyKey: nonEmptyString,
  branchName: nonEmptyString,
  status: codexExecutionRunStatusSchema,
  allowedFiles: z.array(nonEmptyString),
  forbiddenFiles: z.array(nonEmptyString),
  allowedCommands: z.array(nonEmptyString),
  forbiddenCommands: z.array(nonEmptyString),
  requiredTests: z.array(nonEmptyString),
  executionLogs: z.unknown(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
});

export const codexTaskPacketRouteParamsSchema = z.object({
  workspaceId: uuidSchema,
  taskBatchArtifactId: uuidSchema,
});

export type GenerateCodexTaskPacketsRequest = z.infer<typeof generateCodexTaskPacketsRequestSchema>;
export type GenerateGitExecutionPlanRequest = z.infer<typeof generateGitExecutionPlanRequestSchema>;
export type GenerateCodexExecutionContractRequest = z.infer<typeof generateCodexExecutionContractRequestSchema>;
export type CodexExecutionRunStatus = z.infer<typeof codexExecutionRunStatusSchema>;
export type CodexExecutionRun = z.infer<typeof codexExecutionRunSchema>;
