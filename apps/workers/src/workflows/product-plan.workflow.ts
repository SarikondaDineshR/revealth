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

export interface ProductPlanWorkflowInput {
  workflowRunId: string;
  workspaceId: string;
  projectBriefArtifactId: string;
  sourceApprovalId?: string;
}

export async function productPlanWorkflow(input: ProductPlanWorkflowInput) {
  await activities.markWorkflowStatus({ workflowRunId: input.workflowRunId, status: "running" });
  const projectBrief = await activities.getArtifact({
    workspaceId: input.workspaceId,
    artifactId: input.projectBriefArtifactId,
  });
  if (projectBrief.status !== "approved") {
    await activities.markWorkflowStatus({
      workflowRunId: input.workflowRunId,
      status: "blocked",
      outputJson: { reason: "Project brief must be approved before product planning." },
    });
    return { blocked: true, reason: "Project brief must be approved before product planning." };
  }
  await activities.assertNoNewerArtifactVersion({
    workspaceId: input.workspaceId,
    artifactType: projectBrief.artifactType,
    version: projectBrief.version,
  });
  const sourceApproval = await activities.getApprovedApprovalForArtifact({
    workspaceId: input.workspaceId,
    artifactId: projectBrief.id,
    sourceApprovalId: input.sourceApprovalId,
  });

  const productPlanResult = await activities.runProductPlanAgent({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    projectBrief: projectBrief.contentJson,
  });
  const productPlan = productPlanResult.data;
  const artifact = await activities.persistDraftArtifact({
    workspaceId: input.workspaceId,
    artifactType: "product_plan",
    schemaVersion: productPlan.schemaVersion,
    contentJson: productPlan,
    sourceArtifactIds: [projectBrief.id],
    parentArtifactId: projectBrief.id,
    sourceWorkflowRunId: input.workflowRunId,
    sourceApprovalId: sourceApproval.id,
    generatedByAgent: productPlanResult.metadata.agentName,
    promptVersion: productPlanResult.metadata.promptVersion,
    modelProvider: productPlanResult.metadata.modelProvider,
    modelName: productPlanResult.metadata.modelName,
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
