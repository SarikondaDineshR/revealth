import { productPlanSchema, projectBriefSchema, sdlcPlanSchema, taskBatchSchema } from "@revealth/contracts";
import { AgentRuntime } from "../agents/runtime.js";
import { promptRegistry } from "../agents/prompts.js";

export async function runIntakeAgent(input: {
  workspaceId: string;
  workflowRunId: string;
  rawProjectIdea: string;
}) {
  const runtime = new AgentRuntime(process.env);
  const prompt = promptRegistry.intake;
  return runtime.execute({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    agentName: "IntakeAgent",
    promptVersion: prompt.id,
    system: prompt.system,
    user: prompt.user({ rawProjectIdea: input.rawProjectIdea }),
    schemaName: "project_brief",
    schema: projectBriefSchema,
  });
}

export async function runProductPlanAgent(input: {
  workspaceId: string;
  workflowRunId: string;
  projectBrief: unknown;
}) {
  const runtime = new AgentRuntime(process.env);
  const prompt = promptRegistry.productPlan;
  return runtime.execute({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    agentName: "ProductStrategyAgent",
    promptVersion: prompt.id,
    system: prompt.system,
    user: prompt.user({ projectBrief: input.projectBrief }),
    schemaName: "product_plan",
    schema: productPlanSchema,
  });
}

export async function runSdlcPlanAgent(input: {
  workspaceId: string;
  workflowRunId: string;
  projectBrief: unknown;
}) {
  const runtime = new AgentRuntime(process.env);
  const prompt = promptRegistry.sdlcPlan;
  return runtime.execute({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    agentName: "SdlcOrchestrationAgent",
    promptVersion: prompt.id,
    system: prompt.system,
    user: prompt.user({ projectBrief: input.projectBrief }),
    schemaName: "sdlc_plan",
    schema: sdlcPlanSchema,
  });
}

export async function runTaskGenerationAgent(input: {
  workspaceId: string;
  workflowRunId: string;
  sdlcPlan: unknown;
  sourceArtifactId: string;
}) {
  const runtime = new AgentRuntime(process.env);
  const prompt = promptRegistry.taskGeneration;
  const result = await runtime.execute({
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    agentName: "TaskGenerationAgent",
    promptVersion: prompt.id,
    system: prompt.system,
    user: prompt.user({ sdlcPlan: input.sdlcPlan }),
    schemaName: "task_batch",
    schema: taskBatchSchema,
  });
  result.data.sourceIds = [input.sourceArtifactId];
  result.data.tasks = result.data.tasks.map((task) => ({
    ...task,
    sourceArtifactId: input.sourceArtifactId,
  }));
  return result;
}
