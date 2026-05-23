import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.requestId ?? "unknown";
    request.log.error({ err: error, requestId }, "request failed");

    if (error instanceof ZodError) {
      void reply.status(400).send({
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request failed validation.",
          details: error.flatten(),
        },
        requestId,
      });
      return;
    }

    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : statusCode === 404
          ? "NOT_FOUND"
          : statusCode >= 500
            ? "INTERNAL_ERROR"
            : "REQUEST_ERROR";
    void reply.status(statusCode).send({
      data: null,
      error: {
        code,
        message: statusCode === 500 ? "Unexpected server error." : message,
      },
      requestId,
    });
  });
}
