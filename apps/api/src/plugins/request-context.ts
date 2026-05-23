import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    actor: {
      id: string;
      type: "human";
    };
  }
}

export const requestContextPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    request.actor = {
      id: request.headers["x-user-id"]?.toString() ?? app.config.LOCAL_OWNER_ID,
      type: "human",
    };
    reply.header("x-request-id", request.requestId);
  });
});

