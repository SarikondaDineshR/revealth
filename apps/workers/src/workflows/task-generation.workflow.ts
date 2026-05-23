import { proxyActivities } from "@temporalio/workflow";
import type * as agentActivities from "../activities/agent.activities.js";
import type * as artifactActivities from "../activities/artifact.activities.js";
import type * as workflowActivities from "../activities/workflow.activities.js";
import { validateUpstreamLineageGate } from "./lineage-validation.js";

const activities = proxyActivities<typeof agentActivities & typeof artifactActivities & typeof workflowActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    initialInterval: "2 seconds",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface TaskGenerationWorkflowInput {
  workflowRunId: string;
  workspaceId: string;
  sdlcPlanArtifactId: string;
  sourceApprovalId?: string;
}

export async function taskGenerationWorkflow(input: TaskGenerationWorkflowInput) {
  await activities.markWorkflowStatus({ workflowRunId: input.workflowRunId, status: "running" });
  const sdlcPlanArtifact = await activities.getArtifact({
    workspaceId: input.workspaceId,
    artifactId: input.sdlcPlanArtifactId,
  });
  const lineageGate = await activities.getLineageGateState({
    workspaceId: input.workspaceId,
    artifactId: sdlcPlanArtifact.id,
    artifactType: sdlcPlanArtifact.artifactType,
    artifactVersion: sdlcPlanArtifact.version,
    sourceApprovalId: input.sourceApprovalId,
  });
  const validation = validateUpstreamLineageGate({
    upstreamArtifactType: sdlcPlanArtifact.artifactType,
    upstreamStatus: sdlcPlanArtifact.status,
    expectedUpstreamArtifactType: "sdlc_plan",
    downstreamArtifactType: "task_batch",
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
  const result = await activities.runTaskGenerationAgent({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    sdlcPlan: sdlcPlanArtifact.contentJson,
    sourceArtifactId: sdlcPlanArtifact.id,
  });
  const taskBatch = result.data;
  const artifact = await activities.persistDraftArtifact({
    workspaceId: input.workspaceId,
    artifactType: "task_batch",
    schemaVersion: taskBatch.schemaVersion,
    contentJson: taskBatch,
    sourceArtifactIds: [sdlcPlanArtifact.id],
    parentArtifactId: sdlcPlanArtifact.id,
    sourceWorkflowRunId: input.workflowRunId,
    sourceApprovalId: lineageGate.sourceApprovalId,
    generatedByAgent: result.metadata.agentName,
    promptVersion: result.metadata.promptVersion,
    modelProvider: result.metadata.modelProvider,
    modelName: result.metadata.modelName,
  });
  await activities.persistTasksFromBatch({
    workspaceId: input.workspaceId,
    sourceArtifactId: artifact.id,
    taskBatch,
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
