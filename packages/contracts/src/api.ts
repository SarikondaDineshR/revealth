import { z } from "zod";
import { nonEmptyString, uuidSchema } from "./common.js";

export const workspaceCreateRequestSchema = z.object({
  name: nonEmptyString.min(2).max(120),
});

export const workspaceSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  name: nonEmptyString,
  status: nonEmptyString,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const apiErrorSchema = z.object({
  code: nonEmptyString,
  message: nonEmptyString,
  details: z.unknown().optional(),
});

export const apiResponseSchema = z.object({
  data: z.unknown().nullable(),
  error: apiErrorSchema.nullable(),
  requestId: nonEmptyString,
});

export type WorkspaceCreateRequest = z.infer<typeof workspaceCreateRequestSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;

