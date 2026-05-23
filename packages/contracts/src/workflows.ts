import { z } from "zod";
import { isoDateTimeSchema, nonEmptyString, uuidSchema, workflowStatusSchema } from "./common.js";

export const startIntakeWorkflowRequestSchema = z.object({
  rawProjectIdea: nonEmptyString.min(20),
});

export const startProductPlanWorkflowRequestSchema = z.object({
  projectBriefArtifactId: uuidSchema,
  sourceApprovalId: uuidSchema.optional(),
});

export const startSdlcPlanWorkflowRequestSchema = z.object({
  projectBriefArtifactId: uuidSchema,
  sourceApprovalId: uuidSchema.optional(),
});

export const startTaskGenerationWorkflowRequestSchema = z.object({
  sdlcPlanArtifactId: uuidSchema,
  sourceApprovalId: uuidSchema.optional(),
});

export const startGithubIssueDraftWorkflowRequestSchema = z.object({
  taskBatchArtifactId: uuidSchema,
  sourceApprovalId: uuidSchema.optional(),
  repository: nonEmptyString.default("draft/repository"),
});

export const workflowRunSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  workflowType: nonEmptyString,
  status: workflowStatusSchema,
  inputJson: z.unknown(),
  outputJson: z.unknown().nullable(),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
});

export type StartIntakeWorkflowRequest = z.infer<typeof startIntakeWorkflowRequestSchema>;
export type StartProductPlanWorkflowRequest = z.infer<typeof startProductPlanWorkflowRequestSchema>;
export type StartSdlcPlanWorkflowRequest = z.infer<typeof startSdlcPlanWorkflowRequestSchema>;
export type StartTaskGenerationWorkflowRequest = z.infer<typeof startTaskGenerationWorkflowRequestSchema>;
export type StartGithubIssueDraftWorkflowRequest = z.infer<typeof startGithubIssueDraftWorkflowRequestSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
