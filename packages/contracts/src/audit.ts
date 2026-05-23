import { z } from "zod";
import { actorTypeSchema, isoDateTimeSchema, nonEmptyString, uuidSchema } from "./common.js";

export const auditEventStatusSchema = z.enum(["success", "failed", "blocked"]);

export const auditEventInputSchema = z.object({
  workspaceId: uuidSchema,
  workflowRunId: uuidSchema.nullable().default(null),
  agentRunId: uuidSchema.nullable().default(null),
  actorType: actorTypeSchema,
  actorId: nonEmptyString,
  action: nonEmptyString,
  sourceArtifactIds: z.array(uuidSchema).default([]),
  targetArtifactIds: z.array(uuidSchema).default([]),
  inputHash: z.string().nullable().default(null),
  outputHash: z.string().nullable().default(null),
  approvalId: uuidSchema.nullable().default(null),
  status: auditEventStatusSchema,
  errorCode: z.string().nullable().default(null),
  eventJson: z.record(z.unknown()).default({}),
});

export const auditEventSchema = auditEventInputSchema.extend({
  id: uuidSchema,
  createdAt: isoDateTimeSchema,
});

export type AuditEventInput = z.infer<typeof auditEventInputSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;

