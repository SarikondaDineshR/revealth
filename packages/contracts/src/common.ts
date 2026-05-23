import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime();

export const actorTypeSchema = z.enum(["human", "agent", "system"]);
export const artifactStatusSchema = z.enum(["draft", "pending_approval", "approved", "rejected", "superseded"]);
export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "revision_requested",
  "expired",
  "superseded",
]);
export const workflowStatusSchema = z.enum(["queued", "running", "waiting_for_approval", "completed", "failed", "blocked"]);
export const agentRunStatusSchema = z.enum(["queued", "running", "completed", "blocked", "failed"]);
export const prioritySchema = z.enum(["p0", "p1", "p2", "p3"]);
export const taskTypeSchema = z.enum(["feature", "bug", "chore", "research", "documentation", "test"]);

export const nonEmptyString = z.string().trim().min(1);

export type ActorType = z.infer<typeof actorTypeSchema>;
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type TaskType = z.infer<typeof taskTypeSchema>;

