import { z } from "zod";
import { uuidSchema } from "./common.js";

export const executorCheckSchema = z.object({
  name: z.string().min(1),
  passed: z.boolean(),
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["blocker", "warning", "info"]),
  metadata: z.record(z.unknown()).optional(),
});

export const executorPreflightReportSchema = z.object({
  passed: z.boolean(),
  checks: z.array(executorCheckSchema),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  nextAllowedAction: z.enum([
    "start_dry_run",
    "resolve_blockers",
    "set_CODEX_EXECUTION_MODE_dry_run_for_validation",
    "live_execution_blocked_not_implemented",
  ]),
});

export const executorPreflightRequestSchema = z.object({
  workspaceId: uuidSchema,
  contractArtifactId: uuidSchema,
  mode: z.enum(["disabled", "dry_run", "live"]),
  status: z.string().min(1),
  branchName: z.string().min(1),
  allowedFiles: z.array(z.string().min(1)),
  forbiddenFiles: z.array(z.string().min(1)),
  allowedCommands: z.array(z.string().min(1)),
  forbiddenCommands: z.array(z.string().min(1)),
  requiredTests: z.array(z.string().min(1)),
});

export const executorRepoStatusSchema = z.object({
  currentBranch: z.string(),
  isClean: z.boolean(),
  changedFiles: z.array(z.string()),
  untrackedFiles: z.array(z.string()),
  stagedFiles: z.array(z.string()),
  warning: z.string().nullable(),
  recommendedNextAction: z.enum([
    "ready_for_preflight",
    "create_feature_branch_before_execution",
    "review_and_commit_or_stash_changes",
    "resolve_repository_status_error",
  ]),
});

export type ExecutorCheck = z.infer<typeof executorCheckSchema>;
export type ExecutorPreflightReport = z.infer<typeof executorPreflightReportSchema>;
export type ExecutorPreflightRequest = z.infer<typeof executorPreflightRequestSchema>;
export type ExecutorRepoStatus = z.infer<typeof executorRepoStatusSchema>;
