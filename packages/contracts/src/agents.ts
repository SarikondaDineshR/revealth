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

