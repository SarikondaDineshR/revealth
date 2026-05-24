import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import type { ApiEnv } from "./config/env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { requestContextPlugin } from "./plugins/request-context.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerApprovalRoutes } from "./routes/approvals.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerClientCommunicationRoutes } from "./routes/client-communication.js";
import { registerCodexRoutes } from "./routes/codex.js";
import { registerControlPlaneRoutes } from "./routes/control-plane.js";
import { registerGithubRoutes } from "./routes/github.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWorkforceRoutes } from "./routes/workforce.js";
import { registerWorkflowRoutes } from "./routes/workflows.js";
import { registerWorkspaceRoutes } from "./routes/workspaces.js";

declare module "fastify" {
  interface FastifyInstance {
    config: ApiEnv;
  }
}

export async function buildApp(config: ApiEnv) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
  });

  app.decorate("config", config);
  registerErrorHandler(app);

  await app.register(cors, { origin: [config.APP_URL], credentials: true });
  await app.register(sensible);
  await app.register(requestContextPlugin);

  await registerHealthRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerAgentRoutes(app);
  await registerArtifactRoutes(app);
  await registerApprovalRoutes(app);
  await registerWorkflowRoutes(app);
  await registerGithubRoutes(app);
  await registerCodexRoutes(app);
  await registerWorkforceRoutes(app);
  await registerClientCommunicationRoutes(app);
  await registerControlPlaneRoutes(app);
  await registerAuditRoutes(app);

  return app;
}
