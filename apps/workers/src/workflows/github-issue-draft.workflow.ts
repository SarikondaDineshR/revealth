import { proxyActivities } from "@temporalio/workflow";
import type * as artifactActivities from "../activities/artifact.activities.js";
import type * as workflowActivities from "../activities/workflow.activities.js";
import { validateUpstreamLineageGate } from "./lineage-validation.js";

const activities = proxyActivities<typeof artifactActivities & typeof workflowActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    initialInterval: "2 seconds",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface GithubIssueDraftWorkflowInput {
  workflowRunId: string;
  workspaceId: string;
  taskBatchArtifactId: string;
  sourceApprovalId?: string;
  repository: string;
}

export async function githubIssueDraftWorkflow(input: GithubIssueDraftWorkflowInput) {
  await activities.markWorkflowStatus({ workflowRunId: input.workflowRunId, status: "running" });
  const taskBatchArtifact = await activities.getArtifact({
    workspaceId: input.workspaceId,
    artifactId: input.taskBatchArtifactId,
  });
  const lineageGate = await activities.getLineageGateState({
    workspaceId: input.workspaceId,
    artifactId: taskBatchArtifact.id,
    artifactType: taskBatchArtifact.artifactType,
    artifactVersion: taskBatchArtifact.version,
    sourceApprovalId: input.sourceApprovalId,
  });
  const validation = validateUpstreamLineageGate({
    upstreamArtifactType: taskBatchArtifact.artifactType,
    upstreamStatus: taskBatchArtifact.status,
    expectedUpstreamArtifactType: "task_batch",
    downstreamArtifactType: "github_issue_batch",
    hasApprovedSourceApproval: lineageGate.hasApprovedSourceApproval,
    hasNewerUpstreamVersion: lineageGate.hasNewerUpstreamVersion,
  });
  if (!validation.ok) {
    await activities.markWorkflowStatus({
      workflowRunId: input.workflowRunId,
      status: "blocked",
      outputJson: { reason: validation.reason },
    });
    return { blocked: true, reason: validation.reason };
  }
  const content = taskBatchArtifact.contentJson as {
    schemaVersion: string;
    taskBatchId: string;
    tasks: Array<{ taskId: string; title: string; description: string; type: string; priority: string; acceptanceCriteria: string[] }>;
  };
  const issueBatch = {
    schemaVersion: "revealth.github_issue_batch.v1",
    githubIssueBatchId: taskBatchArtifact.id,
    repository: input.repository,
    issues: content.tasks.map((task) => ({
      title: task.title,
      body: `${task.description}\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")}`,
      labels: [task.type, task.priority],
      milestone: null,
      assignees: [],
      sourceTaskId: task.taskId,
    })),
    approvalRequired: true,
    sourceIds: [taskBatchArtifact.id],
  };
  const artifact = await activities.persistDraftArtifact({
    workspaceId: input.workspaceId,
    artifactType: "github_issue_batch",
    schemaVersion: issueBatch.schemaVersion,
    contentJson: issueBatch,
    sourceArtifactIds: [taskBatchArtifact.id],
    parentArtifactId: taskBatchArtifact.id,
    sourceWorkflowRunId: input.workflowRunId,
    sourceApprovalId: lineageGate.sourceApprovalId,
    generatedByAgent: "GitHubIssueDraftMapper",
    promptVersion: "system.github_issue_draft_mapper.v1",
    modelProvider: "none",
    modelName: "none",
  });
  const approval = await activities.createApprovalForArtifact({
    workspaceId: input.workspaceId,
    artifactId: artifact.id,
    artifactVersion: artifact.version,
  });
  await activities.markWorkflowStatus({
    workflowRunId: input.workflowRunId,
    status: "waiting_for_approval",
    outputJson: { artifactId: artifact.id, approvalId: approval.id },
  });
  return { artifactId: artifact.id, approvalId: approval.id };
}
