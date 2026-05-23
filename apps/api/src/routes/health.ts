import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (request) => ({
    data: {
      status: "ok",
      service: "revealth-api",
      timestamp: new Date().toISOString(),
    },
    error: null,
    requestId: request.requestId,
  }));
}

