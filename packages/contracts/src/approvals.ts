import { z } from "zod";
import { approvalStatusSchema, isoDateTimeSchema, nonEmptyString, uuidSchema } from "./common.js";

export const createApprovalRequestSchema = z.object({
  artifactId: uuidSchema,
  artifactVersion: z.number().int().positive(),
  reason: nonEmptyString,
});

export const approvalDecisionRequestSchema = z.object({
  decisionNotes: z.string().max(4000).default(""),
});

export const approvalSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  artifactId: uuidSchema,
  artifactVersion: z.number().int().positive(),
  status: approvalStatusSchema,
  approverId: uuidSchema.nullable(),
  decisionNotes: z.string().nullable(),
  decidedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export type CreateApprovalRequest = z.infer<typeof createApprovalRequestSchema>;
export type ApprovalDecisionRequest = z.infer<typeof approvalDecisionRequestSchema>;
export type Approval = z.infer<typeof approvalSchema>;

