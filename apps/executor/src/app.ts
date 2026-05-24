import Fastify from "fastify";
import { executorPreflightRequestSchema } from "@revealth/contracts";
import type { ExecutorEnv } from "./config.js";
import { createDefaultCommandRunner, ExecutorPreflightService } from "./preflight.js";
import { ExecutorRepoStatusService } from "./repo-status.js";

export async function buildApp(config: ExecutorEnv) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });
  const commandRunner = createDefaultCommandRunner();
  const preflight = new ExecutorPreflightService(config.EXECUTOR_REPOSITORY_PATH, commandRunner);
  const repoStatus = new ExecutorRepoStatusService(config.EXECUTOR_REPOSITORY_PATH, commandRunner);

  app.get("/health", async (request) => ({
    data: {
      status: "ok",
      service: "revealth-executor",
      timestamp: new Date().toISOString(),
    },
    error: null,
    requestId: request.id,
  }));

  app.post("/executor/runs/:runId/preflight", async (request) => {
    const { runId } = request.params as { runId: string };
    const body = executorPreflightRequestSchema.parse(request.body);
    const data = await preflight.run(runId, body);
    return { data, error: null, requestId: request.id };
  });

  app.get("/executor/repo/status", async (request) => {
    const data = await repoStatus.getStatus();
    return { data, error: null, requestId: request.id };
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "executor request failed");
    void reply.status(400).send({
      data: null,
      error: {
        code: "EXECUTOR_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "Executor request failed.",
      },
      requestId: request.id,
    });
  });

  return app;
}
