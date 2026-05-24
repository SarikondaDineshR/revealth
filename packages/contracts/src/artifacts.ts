import { z } from "zod";
import {
  artifactStatusSchema,
  isoDateTimeSchema,
  nonEmptyString,
  prioritySchema,
  taskTypeSchema,
  uuidSchema,
} from "./common.js";

export const artifactTypeSchema = z.enum([
  "project_brief",
  "product_plan",
  "architecture_plan",
  "sdlc_plan",
  "task_batch",
  "github_issue_batch",
  "codex_task_packet_batch",
  "git_execution_plan",
  "codex_execution_contract",
  "branch_preparation_plan",
]);

export const projectBriefSchema = z.object({
  schemaVersion: z.literal("revealth.project_brief.v1"),
  projectBriefId: uuidSchema,
  problem: nonEmptyString,
  targetUsers: z.array(nonEmptyString).min(1),
  businessGoals: z.array(nonEmptyString),
  knownConstraints: z.array(nonEmptyString),
  openQuestions: z.array(nonEmptyString),
  assumptions: z.array(nonEmptyString),
  riskFlags: z.array(nonEmptyString),
  sourceIds: z.array(uuidSchema).default([]),
});

export const productPlanSchema = z.object({
  schemaVersion: z.literal("revealth.product_plan.v1"),
  productPlanId: uuidSchema,
  mission: nonEmptyString,
  personas: z.array(
    z.object({
      name: nonEmptyString,
      goals: z.array(nonEmptyString),
      painPoints: z.array(nonEmptyString),
    }),
  ),
  mvpScope: z.array(nonEmptyString).min(1),
  outOfScope: z.array(nonEmptyString),
  successMetrics: z.array(nonEmptyString),
  assumptions: z.array(nonEmptyString),
  sourceIds: z.array(uuidSchema).default([]),
});

export const architecturePlanSchema = z.object({
  schemaVersion: z.literal("revealth.architecture_plan.v1"),
  architecturePlanId: uuidSchema,
  verifiedFacts: z.array(nonEmptyString),
  assumptions: z.array(nonEmptyString),
  constraints: z.array(nonEmptyString),
  risks: z.array(nonEmptyString),
  recommendedStack: z.array(nonEmptyString),
  sourceIds: z.array(uuidSchema).default([]),
});

export const sdlcPlanSchema = z.object({
  schemaVersion: z.literal("revealth.sdlc_plan.v1"),
  sdlcPlanId: uuidSchema,
  phases: z.array(
    z.object({
      phaseName: nonEmptyString,
      objective: nonEmptyString,
      dependencies: z.array(nonEmptyString),
      exitCriteria: z.array(nonEmptyString).min(1),
      approvalRequired: z.literal(true),
    }),
  ).min(1),
  sourceIds: z.array(uuidSchema).default([]),
});

export const taskSchema = z.object({
  taskId: uuidSchema,
  title: nonEmptyString,
  description: nonEmptyString,
  type: taskTypeSchema,
  priority: prioritySchema,
  dependencies: z.array(uuidSchema),
  acceptanceCriteria: z.array(nonEmptyString).min(1),
  approvalRequired: z.literal(true),
  sourceArtifactId: uuidSchema,
});

export const taskBatchSchema = z.object({
  schemaVersion: z.literal("revealth.task_batch.v1"),
  taskBatchId: uuidSchema,
  tasks: z.array(taskSchema).min(1),
  sourceIds: z.array(uuidSchema).default([]),
});

export const githubIssueDraftSchema = z.object({
  title: nonEmptyString,
  body: nonEmptyString,
  labels: z.array(nonEmptyString),
  milestone: z.string().nullable(),
  assignees: z.array(z.string()),
  sourceTaskId: uuidSchema,
});

export const githubIssueBatchSchema = z.object({
  schemaVersion: z.literal("revealth.github_issue_batch.v1"),
  githubIssueBatchId: uuidSchema,
  repository: nonEmptyString,
  issues: z.array(githubIssueDraftSchema).min(1),
  approvalRequired: z.literal(true),
  sourceIds: z.array(uuidSchema).default([]),
});

export const codexTaskPacketSchema = z.object({
  codexTaskPacketId: nonEmptyString.optional(),
  taskId: uuidSchema,
  sourceArtifactLineage: z.object({
    sourceTaskBatchArtifactId: uuidSchema,
    sourceTaskBatchApprovalId: uuidSchema,
    sourceWorkflowRunId: uuidSchema.nullable(),
    parentArtifactId: uuidSchema.nullable(),
    sourceArtifactIds: z.array(uuidSchema),
  }),
  businessObjective: nonEmptyString,
  technicalObjective: nonEmptyString,
  filesLikelyInvolved: z.array(nonEmptyString),
  implementationConstraints: z.array(nonEmptyString).min(1),
  acceptanceCriteria: z.array(nonEmptyString).min(1),
  testExpectations: z.array(nonEmptyString).min(1),
  branchNameRecommendation: nonEmptyString,
  prTitleRecommendation: nonEmptyString,
  rollbackNotes: nonEmptyString,
  securityNotes: z.array(nonEmptyString).min(1),
});

export const gitExecutionPlanItemSchema = z.object({
  sourceCodexPacketId: nonEmptyString,
  sourceTaskId: uuidSchema,
  branchName: nonEmptyString,
  commitStrategy: nonEmptyString,
  prTitle: nonEmptyString,
  prBodyDraft: nonEmptyString,
  requiredTests: z.array(nonEmptyString).min(1),
  requiredReviewers: z.array(nonEmptyString).min(1),
  rollbackPlan: nonEmptyString,
  mergeGateChecklist: z.array(nonEmptyString).min(1),
});

export const gitExecutionPlanSchema = z.object({
  schemaVersion: z.literal("revealth.git_execution_plan.v1"),
  gitExecutionPlanId: uuidSchema,
  sourceCodexTaskPacketBatchArtifactId: uuidSchema,
  plans: z.array(gitExecutionPlanItemSchema).min(1),
  approvalRequired: z.literal(true),
  branchCreationAllowed: z.literal(false),
  pullRequestCreationAllowed: z.literal(false),
  codeExecutionAllowed: z.literal(false),
  sourceIds: z.array(uuidSchema).default([]),
});

export const codexExecutionContractItemSchema = z.object({
  sourceGitExecutionPlanId: uuidSchema,
  sourceCodexPacketId: nonEmptyString,
  sourceTaskId: uuidSchema,
  exactAllowedFilesOrDirectories: z.array(nonEmptyString).min(1),
  forbiddenFiles: z.array(nonEmptyString).min(1),
  allowedCommands: z.array(nonEmptyString).min(1),
  forbiddenCommands: z.array(nonEmptyString).min(1),
  requiredTests: z.array(nonEmptyString).min(1),
  maxExecutionScope: nonEmptyString,
  branchName: nonEmptyString,
  rollbackInstructions: nonEmptyString,
  prRequirements: z.object({
    title: nonEmptyString,
    bodyMustInclude: z.array(nonEmptyString).min(1),
    requiredReviewers: z.array(nonEmptyString).min(1),
    mergeGateChecklist: z.array(nonEmptyString).min(1),
  }),
  humanApprovalRequirements: z.array(nonEmptyString).min(1),
  secretHandlingRules: z.array(nonEmptyString).min(1),
  securityConstraints: z.array(nonEmptyString).min(1),
});

export const codexExecutionContractSchema = z.object({
  schemaVersion: z.literal("revealth.codex_execution_contract.v1"),
  codexExecutionContractId: uuidSchema,
  sourceGitExecutionPlanArtifactId: uuidSchema,
  contracts: z.array(codexExecutionContractItemSchema).min(1),
  approvalRequired: z.literal(true),
  codeExecutionAllowed: z.literal(false),
  branchCreationAllowed: z.literal(false),
  pullRequestCreationAllowed: z.literal(false),
  sourceIds: z.array(uuidSchema).default([]),
});

export const branchPreparationPlanSchema = z.object({
  schemaVersion: z.literal("revealth.branch_preparation_plan.v1"),
  branchPreparationPlanId: uuidSchema,
  sourceRunId: uuidSchema,
  sourceContractId: uuidSchema,
  recommendedBranchName: nonEmptyString,
  baseBranch: nonEmptyString,
  branchCreationCommandPreview: nonEmptyString,
  rollbackCommandPreview: nonEmptyString,
  protectedBranchWarning: z.string().nullable(),
  allowedFilesSummary: z.array(nonEmptyString).min(1),
  requiredTestsSummary: z.array(nonEmptyString).min(1),
  approvalRequirements: z.array(nonEmptyString).min(1),
  approvalRequired: z.literal(true),
  branchCreationAllowed: z.literal(false),
  codeExecutionAllowed: z.literal(false),
  pullRequestCreationAllowed: z.literal(false),
  sourceIds: z.array(uuidSchema).default([]),
});

export const codexTaskPacketBatchSchema = z.object({
  schemaVersion: z.literal("revealth.codex_task_packet_batch.v1"),
  codexTaskPacketBatchId: uuidSchema,
  sourceTaskBatchArtifactId: uuidSchema,
  packets: z.array(codexTaskPacketSchema).min(1),
  approvalRequired: z.literal(true),
  executionAllowed: z.literal(false),
  branchCreationAllowed: z.literal(false),
  pullRequestCreationAllowed: z.literal(false),
  sourceIds: z.array(uuidSchema).default([]),
});

export const artifactEnvelopeSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  parentArtifactId: uuidSchema.nullable().optional(),
  sourceWorkflowRunId: uuidSchema.nullable().optional(),
  sourceApprovalId: uuidSchema.nullable().optional(),
  generatedByAgent: z.string().nullable().optional(),
  promptVersion: z.string().nullable().optional(),
  modelProvider: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
  artifactType: artifactTypeSchema,
  version: z.number().int().positive(),
  status: artifactStatusSchema,
  schemaVersion: nonEmptyString,
  contentJson: z.unknown(),
  sourceArtifactIds: z.array(uuidSchema),
  createdAt: isoDateTimeSchema,
});

export const createArtifactRequestSchema = z.object({
  artifactType: artifactTypeSchema,
  schemaVersion: nonEmptyString,
  contentJson: z.unknown(),
  sourceArtifactIds: z.array(uuidSchema).default([]),
  parentArtifactId: uuidSchema.nullable().optional(),
  sourceWorkflowRunId: uuidSchema.nullable().optional(),
  sourceApprovalId: uuidSchema.nullable().optional(),
  generatedByAgent: z.string().nullable().optional(),
  promptVersion: z.string().nullable().optional(),
  modelProvider: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
});

export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type ProjectBrief = z.infer<typeof projectBriefSchema>;
export type ProductPlan = z.infer<typeof productPlanSchema>;
export type ArchitecturePlan = z.infer<typeof architecturePlanSchema>;
export type SdlcPlan = z.infer<typeof sdlcPlanSchema>;
export type TaskRecord = z.infer<typeof taskSchema>;
export type TaskBatch = z.infer<typeof taskBatchSchema>;
export type GitHubIssueBatch = z.infer<typeof githubIssueBatchSchema>;
export type CodexTaskPacket = z.infer<typeof codexTaskPacketSchema>;
export type CodexTaskPacketBatch = z.infer<typeof codexTaskPacketBatchSchema>;
export type GitExecutionPlanItem = z.infer<typeof gitExecutionPlanItemSchema>;
export type GitExecutionPlan = z.infer<typeof gitExecutionPlanSchema>;
export type CodexExecutionContractItem = z.infer<typeof codexExecutionContractItemSchema>;
export type CodexExecutionContract = z.infer<typeof codexExecutionContractSchema>;
export type BranchPreparationPlan = z.infer<typeof branchPreparationPlanSchema>;
export type ArtifactEnvelope = z.infer<typeof artifactEnvelopeSchema>;
export type CreateArtifactRequest = z.infer<typeof createArtifactRequestSchema>;
