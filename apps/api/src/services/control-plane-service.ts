import type { Artifact, AuditLog, CodexExecutionRun, Prisma } from "@prisma/client";
import type { DatabaseClient } from "@revealth/database";
import type { ApiEnv } from "../config/env.js";
import { ExecutorClient } from "./executor-client.js";

const GOVERNED_LINEAGE = [
  "project_brief",
  "sdlc_plan",
  "task_batch",
  "github_issue_batch",
  "codex_task_packet_batch",
  "git_execution_plan",
  "codex_execution_contract",
] as const;

export function countByStatus<T extends { status: string }>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function buildGovernedLineage(artifacts: Artifact[], runs: CodexExecutionRun[]) {
  const artifactNodes = GOVERNED_LINEAGE.map((artifactType) => {
    const matches = artifacts.filter((artifact) => artifact.artifactType === artifactType);
    const latest = matches.sort((a, b) => b.version - a.version)[0] ?? null;
    return {
      key: artifactType,
      label: artifactType,
      artifactId: latest?.id ?? null,
      status: latest?.status ?? "missing",
      version: latest?.version ?? null,
      createdAt: latest?.createdAt ?? null,
    };
  });
  const latestRun = runs[0] ?? null;
  return [
    ...artifactNodes,
    {
      key: "execution_run",
      label: "execution_run",
      artifactId: latestRun?.id ?? null,
      status: latestRun?.status ?? "missing",
      version: null,
      createdAt: latestRun?.createdAt ?? null,
    },
  ];
}

export class ControlPlaneService {
  private readonly executorClient: Pick<ExecutorClient, "repoStatus">;

  constructor(
    private readonly db: DatabaseClient,
    private readonly env: Pick<ApiEnv, "EXECUTOR_URL" | "CODEX_EXECUTION_MODE" | "TEMPORAL_ADDRESS" | "TEMPORAL_NAMESPACE" | "TEMPORAL_TASK_QUEUE">,
    executorClient?: Pick<ExecutorClient, "repoStatus">,
    private readonly executorHealthReader?: () => Promise<{ status: string; data?: unknown; error?: string }>,
  ) {
    this.executorClient = executorClient ?? new ExecutorClient(env.EXECUTOR_URL);
  }

  async getWorkspaceDashboard(workspaceId: string) {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw Object.assign(new Error("Workspace not found."), {
        statusCode: 404,
        code: "WORKSPACE_NOT_FOUND",
      });
    }

    const [
      workflowRuns,
      artifacts,
      approvals,
      executionRuns,
      auditEvents,
      githubIssues,
      agentAssignments,
      agentMessages,
      executorHealth,
      executorRepoStatus,
    ] = await Promise.all([
      this.db.workflowRun.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.db.artifact.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.approval.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.codexExecutionRun.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.db.auditLog.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.gitHubIssue.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.db.agentAssignment.findMany({ where: { workspaceId }, orderBy: [{ status: "asc" }, { startedAt: "desc" }], take: 50 }),
      this.db.agentMessage.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.getExecutorHealth(),
      this.getExecutorRepoStatus(),
    ]);

    const branchPreparationPlans = artifacts.filter((artifact: Artifact) => artifact.artifactType === "branch_preparation_plan");
    const latestExecutionRun = executionRuns[0] ?? null;
    const latestPreflight = auditEvents.find((event: AuditLog) =>
      event.action === "codex.execution_run.preflight.passed" || event.action === "codex.execution_run.preflight.failed",
    );

    return {
      workspace,
      services: {
        api: { status: "ok" },
        executor: executorHealth,
        temporal: {
          status: "configured",
          address: this.env.TEMPORAL_ADDRESS,
          namespace: this.env.TEMPORAL_NAMESPACE,
          taskQueue: this.env.TEMPORAL_TASK_QUEUE,
        },
      },
      readiness: {
        executionMode: this.env.CODEX_EXECUTION_MODE,
        repoClean: executorRepoStatus.data?.isClean ?? false,
        currentBranch: executorRepoStatus.data?.currentBranch ?? null,
        protectedBranchWarning: executorRepoStatus.data?.warning ?? null,
        repoStatus: executorRepoStatus,
        latestPreflightStatus: latestPreflight?.action.endsWith(".passed")
          ? "passed"
          : latestPreflight?.action.endsWith(".failed")
            ? "failed"
            : "not_run",
        latestPreflightErrorCode: latestPreflight?.errorCode ?? null,
        readyForLiveExecution: latestExecutionRun?.status === "ready_for_live_execution",
      },
      lineage: buildGovernedLineage(artifacts, executionRuns),
      workflowRuns,
      workflowStatusCounts: countByStatus(workflowRuns),
      artifacts,
      artifactStatusCounts: countByStatus(artifacts),
      approvals,
      approvalStatusCounts: countByStatus(approvals),
      executionRuns,
      executionRunStatusCounts: countByStatus(executionRuns),
      auditEvents,
      branchPreparationPlans,
      githubIssues,
      agentAssignments,
      agentMessages,
      clientVisibleAgentMessages: agentMessages.filter((message) => message.visibility === "client_visible"),
    };
  }

  private async fetchExecutorHealth() {
    try {
      const response = await fetch(`${this.env.EXECUTOR_URL}/health`, { cache: "no-store" });
      const body = (await response.json()) as unknown;
      return { status: response.ok ? "ok" : "error", data: body };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Executor health request failed.",
      };
    }
  }

  private getExecutorHealth() {
    return this.executorHealthReader ? this.executorHealthReader() : this.fetchExecutorHealth();
  }

  private async getExecutorRepoStatus() {
    try {
      const data = await this.executorClient.repoStatus();
      return { status: "ok", data };
    } catch (error) {
      return {
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "Executor repo status request failed.",
      };
    }
  }
}

export type ControlPlaneDashboard = Prisma.PromiseReturnType<ControlPlaneService["getWorkspaceDashboard"]>;
