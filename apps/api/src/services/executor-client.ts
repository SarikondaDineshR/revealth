import {
  executorPreflightReportSchema,
  executorRepoStatusSchema,
  type ExecutorPreflightRequest,
} from "@revealth/contracts";

export class ExecutorClient {
  constructor(private readonly baseUrl: string) {}

  async preflight(runId: string, input: ExecutorPreflightRequest) {
    const response = await fetch(`${this.baseUrl}/executor/runs/${runId}/preflight`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json()) as unknown;
    if (!response.ok) {
      throw Object.assign(new Error("Executor preflight request failed."), {
        statusCode: 502,
        code: "EXECUTOR_PREFLIGHT_FAILED",
        details: body,
      });
    }

    return executorPreflightReportSchema.parse((body as { data?: unknown }).data);
  }

  async repoStatus() {
    const response = await fetch(`${this.baseUrl}/executor/repo/status`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
    });

    const body = (await response.json()) as unknown;
    if (!response.ok) {
      throw Object.assign(new Error("Executor repository status request failed."), {
        statusCode: 502,
        code: "EXECUTOR_REPO_STATUS_FAILED",
        details: body,
      });
    }

    return executorRepoStatusSchema.parse((body as { data?: unknown }).data);
  }
}
