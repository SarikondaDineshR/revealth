import { proxyActivities } from "@temporalio/workflow";
import type * as agentActivities from "../activities/agent.activities.js";
import type * as artifactActivities from "../activities/artifact.activities.js";
import type * as workflowActivities from "../activities/workflow.activities.js";

const activities = proxyActivities<typeof agentActivities & typeof artifactActivities & typeof workflowActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    initialInterval: "2 seconds",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface IntakeWorkflowInput {
  workflowRunId: string;
  workspaceId: string;
  ownerId: string;
  rawProjectIdea: string;
}

export async function intakeWorkflow(input: IntakeWorkflowInput) {
  await activities.markWorkflowStatus({ workflowRunId: input.workflowRunId, status: "running" });
  await activities.appendWorkflowAudit({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    actorId: "IntakeWorkflow",
    action: "workflow.started",
    status: "success",
    eventJson: { workflowType: "intake" },
  });

  const briefResult = await activities.runIntakeAgent({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    rawProjectIdea: input.rawProjectIdea,
  });
  const brief = briefResult.data;
  const artifact = await activities.persistDraftArtifact({
    workspaceId: input.workspaceId,
    artifactType: "project_brief",
    schemaVersion: brief.schemaVersion,
    contentJson: brief,
    sourceArtifactIds: brief.sourceIds,
    sourceWorkflowRunId: input.workflowRunId,
    generatedByAgent: briefResult.metadata.agentName,
    promptVersion: briefResult.metadata.promptVersion,
    modelProvider: briefResult.metadata.modelProvider,
    modelName: briefResult.metadata.modelName,
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
