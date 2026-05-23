import type { z } from "zod";
import { createModelProvider } from "@revealth/model-providers";
import type { ModelProvider } from "@revealth/model-providers";
import { prisma } from "@revealth/database";

export interface AgentExecutionInput<TSchema extends z.ZodType> {
  workspaceId: string;
  workflowRunId: string;
  agentName: string;
  promptVersion: string;
  system: string;
  user: string;
  schemaName: string;
  schema: TSchema;
}

export interface AgentExecutionResult<T> {
  data: T;
  metadata: {
    agentName: string;
    promptVersion: string;
    modelProvider: string;
    modelName: string;
  };
}

export class AgentRuntime {
  private readonly provider: ModelProvider;

  constructor(env: NodeJS.ProcessEnv) {
    this.provider = createModelProvider(env);
  }

  async execute<TSchema extends z.ZodType>(
    input: AgentExecutionInput<TSchema>,
  ): Promise<AgentExecutionResult<z.infer<TSchema>>> {
    const modelName = process.env.DEFAULT_PLANNING_MODEL ?? "local-planning-model";
    const agentRun = await prisma.agentRun.create({
      data: {
        workspaceId: input.workspaceId,
        workflowRunId: input.workflowRunId,
        agentName: input.agentName,
        status: "running",
        inputJson: {
          promptVersion: input.promptVersion,
          schemaName: input.schemaName,
          user: input.user,
        },
        modelProvider: this.provider.name,
        modelName,
        promptVersion: input.promptVersion,
      },
    });

    try {
      const result = await this.provider.generateJson<z.infer<TSchema>>({
        system: input.system,
        user: input.user,
        schemaName: input.schemaName,
        schema: input.schema,
        model: modelName,
      });

      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "completed",
          outputJson: result.data,
          completedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          workflowRunId: input.workflowRunId,
          agentRunId: agentRun.id,
          actorType: "agent",
          actorId: input.agentName,
          action: "agent.completed",
          status: "success",
          eventJson: {
            provider: result.provider,
            model: result.model,
            promptVersion: input.promptVersion,
          },
        },
      });

      return {
        data: result.data,
        metadata: {
          agentName: input.agentName,
          promptVersion: input.promptVersion,
          modelProvider: result.provider,
          modelName: result.model,
        },
      };
    } catch (error: unknown) {
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "failed",
          errorJson: { message: error instanceof Error ? error.message : "Unknown error" },
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
