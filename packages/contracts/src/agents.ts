import { z } from "zod";
import { agentRunStatusSchema, nonEmptyString, uuidSchema } from "./common.js";

export const agentRequestEnvelopeSchema = z.object({
  contractVersion: z.literal("2026-05-22.v1"),
  workflowRunId: uuidSchema,
  workspaceId: uuidSchema,
  agentName: nonEmptyString,
  task: nonEmptyString,
  inputArtifacts: z.array(
    z.object({
      artifactId: uuidSchema,
      artifactType: nonEmptyString,
      version: z.number().int().positive(),
      status: nonEmptyString,
      contentJson: z.unknown(),
    }),
  ),
  contextBundle: z.object({
    canonicalMemoryIds: z.array(uuidSchema),
    draftMemoryIds: z.array(uuidSchema),
    auditLogIds: z.array(uuidSchema),
  }),
  constraints: z.object({
    approvalRequired: z.boolean(),
    externalSideEffectsAllowed: z.literal(false),
    outputSchema: nonEmptyString,
  }),
});

export const agentResponseEnvelopeSchema = z.object({
  contractVersion: z.literal("2026-05-22.v1"),
  workflowRunId: uuidSchema,
  agentRunId: uuidSchema,
  agentName: nonEmptyString,
  status: agentRunStatusSchema,
  outputArtifacts: z.array(
    z.object({
      artifactType: nonEmptyString,
      schemaVersion: nonEmptyString,
      contentJson: z.unknown(),
      sourceArtifactIds: z.array(uuidSchema),
      approvalRequired: z.literal(true),
    }),
  ),
  openQuestions: z.array(nonEmptyString),
  assumptions: z.array(nonEmptyString),
  errors: z.array(
    z.object({
      code: nonEmptyString,
      message: nonEmptyString,
      recoverable: z.boolean(),
    }),
  ),
  auditEvent: z.object({
    action: nonEmptyString,
    status: z.enum(["success", "failed", "blocked"]),
  }),
});

export type AgentRequestEnvelope = z.infer<typeof agentRequestEnvelopeSchema>;
export type AgentResponseEnvelope = z.infer<typeof agentResponseEnvelopeSchema>;

export const aiCompanyAgentStatusSchema = z.enum([
  "idle",
  "thinking",
  "working",
  "blocked",
  "waiting_for_approval",
  "completed",
]);

export const agentMessageTypeSchema = z.enum(["update", "blocker", "decision", "question", "handoff", "review"]);
export const agentMessageVisibilitySchema = z.enum(["internal", "client_visible"]);
export const workforceDispatchStatusSchema = z.enum(["assigned", "in_progress", "blocked", "review", "completed"]);

export const agentRegistryItemSchema = z.object({
  agentId: nonEmptyString,
  role: nonEmptyString,
  displayName: nonEmptyString,
  simpleStatusLabel: nonEmptyString,
});

export const createAgentAssignmentSchema = z.object({
  agentId: nonEmptyString,
  role: nonEmptyString,
  currentTask: nonEmptyString,
  assignedArtifactId: uuidSchema.nullish(),
  status: aiCompanyAgentStatusSchema.default("idle"),
});

export const createAgentMessageSchema = z.object({
  agentId: nonEmptyString,
  agentRole: nonEmptyString,
  messageType: agentMessageTypeSchema,
  relatedArtifactId: uuidSchema.nullish(),
  relatedWorkflowRunId: uuidSchema.nullish(),
  visibility: agentMessageVisibilitySchema.default("internal"),
  message: nonEmptyString,
});

export type AiCompanyAgentStatus = z.infer<typeof aiCompanyAgentStatusSchema>;
export type AgentMessageType = z.infer<typeof agentMessageTypeSchema>;
export type AgentMessageVisibility = z.infer<typeof agentMessageVisibilitySchema>;
export type AgentRegistryItem = z.infer<typeof agentRegistryItemSchema>;
export type WorkforceDispatchStatus = z.infer<typeof workforceDispatchStatusSchema>;
