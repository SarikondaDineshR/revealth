import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CodexExecutionRun, Prisma } from "@prisma/client";
import { codexExecutionContractSchema } from "@revealth/contracts";
import type { DatabaseClient } from "@revealth/database";
import type { ApiEnv } from "../config/env.js";
import { AuditService } from "./audit-service.js";
import { ExecutorClient } from "./executor-client.js";

export type CodexExecutionRunStartStatus = "queued" | "running" | "completed_dry_run" | "failed" | "cancelled";

export interface CodexPreflightCheck {
  name: string;
  passed: boolean;
  code: string;
  message: string;
  severity: "blocker" | "warning" | "info";
  metadata?: Record<string, unknown>;
}

export interface CodexPreflightReport {
  passed: boolean;
  checks: CodexPreflightCheck[];
  blockers: string[];
  warnings: string[];
  nextAllowedAction:
    | "start_dry_run"
    | "resolve_blockers"
    | "set_CODEX_EXECUTION_MODE_dry_run_for_validation"
    | "live_execution_blocked_not_implemented";
}


export interface CodexExecutionAdapter {
  validateRun(runId: string): Promise<CodexExecutionRun>;
  prepareWorkspace(runId: string): Promise<CodexExecutionRun>;
  executeDryRun(runId: string): Promise<CodexExecutionRun>;
  executeLive(runId: string): Promise<CodexExecutionRun>;
  collectLogs(runId: string): Promise<Prisma.JsonValue>;
  markRunStatus(runId: string, status: CodexExecutionRunStartStatus): Promise<CodexExecutionRun>;
  cleanupWorkspace(runId: string): Promise<CodexExecutionRun>;
  preflight(runId: string): Promise<CodexPreflightReport>;
}

type ExecutionLogEntry = Prisma.InputJsonObject;

const EXECUTION_WORKSPACE_ROOT = ".revealth/execution-runs";

export class SandboxedCodexExecutionAdapter implements CodexExecutionAdapter {
  private readonly audit: AuditService;
  private repositoryRoot: string | null = null;

  constructor(
    private readonly db: DatabaseClient,
    private readonly env: Pick<ApiEnv, "CODEX_EXECUTION_MODE"> & Partial<Pick<ApiEnv, "EXECUTOR_URL">>,
    private readonly executorClient: Pick<ExecutorClient, "preflight"> = new ExecutorClient(
      env.EXECUTOR_URL ?? "http://localhost:4100",
    ),
  ) {
    this.audit = new AuditService(db);
  }

  async validateRun(runId: string): Promise<CodexExecutionRun> {
    const run = await this.getRun(runId);
    if (run.status === "cancelled") {
      throw Object.assign(new Error("Cancelled Codex execution runs cannot be started."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_RUN_CANCELLED",
      });
    }
    if (run.status !== "queued") {
      throw Object.assign(new Error("Only queued Codex execution runs can be started."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_RUN_NOT_QUEUED",
      });
    }

    const contractArtifact = await this.db.artifact.findFirst({
      where: { id: run.contractArtifactId, workspaceId: run.workspaceId },
    });
    if (!contractArtifact) {
      throw Object.assign(new Error("Codex execution contract artifact not found."), {
        statusCode: 404,
        code: "CODEX_EXECUTION_CONTRACT_NOT_FOUND",
      });
    }
    if (contractArtifact.artifactType !== "codex_execution_contract" || contractArtifact.status !== "approved") {
      throw Object.assign(new Error("Codex execution run requires an approved codex_execution_contract artifact."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_CONTRACT_NOT_APPROVED",
      });
    }

    const approval = await this.db.approval.findFirst({
      where: {
        workspaceId: run.workspaceId,
        artifactId: contractArtifact.id,
        artifactVersion: contractArtifact.version,
        status: "approved",
      },
      orderBy: { decidedAt: "desc" },
    });
    if (!approval) {
      throw Object.assign(new Error("Approved Codex execution contract approval not found."), {
        statusCode: 409,
        code: "APPROVED_CODEX_EXECUTION_CONTRACT_APPROVAL_NOT_FOUND",
      });
    }

    codexExecutionContractSchema.parse(contractArtifact.contentJson);
    this.validateSafetySnapshot(run);

    await this.audit.append({
      workspaceId: run.workspaceId,
      actorType: "system",
      actorId: "SandboxedCodexExecutionAdapter",
      action: "codex.execution_run.validated",
      sourceArtifactIds: [run.contractArtifactId],
      targetArtifactIds: [run.contractArtifactId],
      approvalId: approval.id,
      status: "success",
      eventJson: {
        codexExecutionRunId: run.id,
        mode: this.env.CODEX_EXECUTION_MODE,
        branchName: run.branchName,
        codeExecutionStarted: false,
        branchCreated: false,
        pullRequestCreated: false,
      },
    });

    return run;
  }

  async prepareWorkspace(runId: string): Promise<CodexExecutionRun> {
    const run = await this.getRun(runId);
    const manifest = {
      runId: run.id,
      workspaceId: run.workspaceId,
      sourceContractId: run.contractArtifactId,
      allowedFiles: run.allowedFiles,
      forbiddenFiles: run.forbiddenFiles,
      branchName: run.branchName,
      createdAt: new Date().toISOString(),
      mode: this.env.CODEX_EXECUTION_MODE,
    };
    const manifestPath = await this.writeWorkspaceManifest(run.id, manifest);

    const withManifest = await this.db.codexExecutionRun.update({
      where: { id: run.id },
      data: { executionWorkspaceManifestPath: manifestPath },
    });

    return this.appendRunLog(withManifest, {
      level: "info",
      message:
        "Dry-run execution workspace metadata created. No repository files were copied, modified, or branched.",
      at: new Date().toISOString(),
      metadata: {
        allowedFiles: run.allowedFiles,
        forbiddenFiles: run.forbiddenFiles,
        branchName: run.branchName,
        manifestPath,
      },
    });
  }

  async executeDryRun(runId: string): Promise<CodexExecutionRun> {
    const validated = await this.validateRun(runId);
    if (this.env.CODEX_EXECUTION_MODE === "disabled") {
      await this.audit.append({
        workspaceId: validated.workspaceId,
        actorType: "system",
        actorId: "SandboxedCodexExecutionAdapter",
        action: "codex.execution_run.start.blocked",
        sourceArtifactIds: [validated.contractArtifactId],
        targetArtifactIds: [validated.contractArtifactId],
        status: "failed",
        errorCode: "CODEX_EXECUTION_DISABLED",
        eventJson: {
          codexExecutionRunId: validated.id,
          mode: this.env.CODEX_EXECUTION_MODE,
        },
      });
      throw Object.assign(new Error("Codex execution is disabled by CODEX_EXECUTION_MODE."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_DISABLED",
      });
    }
    if (this.env.CODEX_EXECUTION_MODE === "live") {
      return this.executeLive(runId);
    }

    const running = await this.markRunStatus(runId, "running");
    await this.audit.append({
      workspaceId: running.workspaceId,
      actorType: "system",
      actorId: "SandboxedCodexExecutionAdapter",
      action: "codex.execution_run.dry_run.started",
      sourceArtifactIds: [running.contractArtifactId],
      targetArtifactIds: [running.contractArtifactId],
      status: "success",
      eventJson: {
        codexExecutionRunId: running.id,
        mode: this.env.CODEX_EXECUTION_MODE,
        codeExecutionStarted: false,
        branchCreated: false,
        pullRequestCreated: false,
      },
    });

    const prepared = await this.prepareWorkspace(runId);
    const withPlan = await this.appendRunLog(prepared, {
      level: "info",
      message: "Dry-run execution plan collected. No arbitrary shell commands were executed.",
      at: new Date().toISOString(),
      metadata: {
        allowedCommands: prepared.allowedCommands,
        forbiddenCommands: prepared.forbiddenCommands,
        requiredTests: prepared.requiredTests,
      },
    });
    const completed = await this.markRunStatus(withPlan.id, "completed_dry_run");

    await this.audit.append({
      workspaceId: completed.workspaceId,
      actorType: "system",
      actorId: "SandboxedCodexExecutionAdapter",
      action: "codex.execution_run.dry_run.completed",
      sourceArtifactIds: [completed.contractArtifactId],
      targetArtifactIds: [completed.contractArtifactId],
      status: "success",
      eventJson: {
        codexExecutionRunId: completed.id,
        mode: this.env.CODEX_EXECUTION_MODE,
        status: completed.status,
        codeExecutionStarted: false,
        filesModified: false,
        branchCreated: false,
        pullRequestCreated: false,
      },
    });

    return completed;
  }

  async executeLive(runId: string): Promise<CodexExecutionRun> {
    const run = await this.getRun(runId);
    await this.audit.append({
      workspaceId: run.workspaceId,
      actorType: "system",
      actorId: "SandboxedCodexExecutionAdapter",
      action: "codex.execution_run.live.blocked",
      sourceArtifactIds: [run.contractArtifactId],
      targetArtifactIds: [run.contractArtifactId],
      status: "failed",
      errorCode: "CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED",
      eventJson: {
        codexExecutionRunId: run.id,
        mode: this.env.CODEX_EXECUTION_MODE,
      },
    });
    throw Object.assign(new Error("Live Codex execution is not implemented."), {
      statusCode: 409,
      code: "CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED",
    });
  }

  async collectLogs(runId: string): Promise<Prisma.JsonValue> {
    const run = await this.getRun(runId);
    return run.executionLogs;
  }

  async markRunStatus(runId: string, status: CodexExecutionRunStartStatus): Promise<CodexExecutionRun> {
    const run = await this.getRun(runId);
    const now = new Date();
    const data: Prisma.CodexExecutionRunUpdateInput = {
      status,
      executionLogs: [
        ...this.readLogs(run),
        {
          level: "info",
          message: `Codex execution run status changed from ${run.status} to ${status}.`,
          at: now.toISOString(),
        },
      ] as Prisma.InputJsonArray,
    };

    if (status === "running") data.startedAt = now;
    if (status === "completed_dry_run" || status === "failed" || status === "cancelled") data.completedAt = now;
    if (status === "cancelled") data.cancelledAt = now;

    return this.db.codexExecutionRun.update({ where: { id: run.id }, data });
  }

  async cleanupWorkspace(runId: string): Promise<CodexExecutionRun> {
    const run = await this.getRun(runId);
    if (!["completed_dry_run", "failed", "cancelled"].includes(run.status)) {
      throw Object.assign(new Error("Only completed_dry_run, failed, or cancelled Codex execution runs can be cleaned up."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_RUN_NOT_CLEANABLE",
      });
    }

    const manifestPath = run.executionWorkspaceManifestPath;
    if (manifestPath) {
      const manifestDirectory = path.dirname(this.resolveWorkspacePath(manifestPath));
      await fs.rm(manifestDirectory, { recursive: true, force: true });
    }

    const cleaned = await this.db.codexExecutionRun.update({
      where: { id: run.id },
      data: {
        executionWorkspaceManifestPath: null,
        executionLogs: [
          ...this.readLogs(run),
          {
            level: "info",
            message: "Execution workspace metadata cleaned up.",
            at: new Date().toISOString(),
            metadata: { previousManifestPath: manifestPath ?? null },
          },
        ] as Prisma.InputJsonArray,
      },
    });

    await this.audit.append({
      workspaceId: cleaned.workspaceId,
      actorType: "system",
      actorId: "SandboxedCodexExecutionAdapter",
      action: "codex.execution_workspace.cleaned",
      sourceArtifactIds: [cleaned.contractArtifactId],
      targetArtifactIds: [cleaned.contractArtifactId],
      status: "success",
      eventJson: {
        codexExecutionRunId: cleaned.id,
        previousManifestPath: manifestPath ?? null,
      },
    });

    return cleaned;
  }

  async preflight(runId: string): Promise<CodexPreflightReport> {
    const checks: CodexPreflightCheck[] = [];
    const push = (check: CodexPreflightCheck) => checks.push(check);
    let run: CodexExecutionRun | null = null;

    try {
      run = await this.getRun(runId);
    } catch (error) {
      push(this.blocker("run.exists", "CODEX_EXECUTION_RUN_NOT_FOUND", error instanceof Error ? error.message : "Run not found."));
      return this.finalizePreflight(null, checks);
    }

    await this.audit.append({
      workspaceId: run.workspaceId,
      actorType: "system",
      actorId: "SandboxedCodexExecutionAdapter",
      action: "codex.execution_run.preflight.started",
      sourceArtifactIds: [run.contractArtifactId],
      targetArtifactIds: [run.contractArtifactId],
      status: "success",
      eventJson: {
        codexExecutionRunId: run.id,
        mode: this.env.CODEX_EXECUTION_MODE,
      },
    });

    push(
      run.status === "queued"
        ? this.info("run.status", "CODEX_RUN_QUEUED", "Run status is queued.")
        : this.blocker("run.status", "CODEX_RUN_NOT_QUEUED", `Run status must be queued, received ${run.status}.`),
    );

    const contractArtifact = await this.db.artifact.findFirst({
      where: { id: run.contractArtifactId, workspaceId: run.workspaceId },
    });
    const contractApproved =
      contractArtifact?.artifactType === "codex_execution_contract" && contractArtifact.status === "approved";
    push(
      contractApproved
        ? this.info("contract.approved", "CODEX_CONTRACT_APPROVED", "Contract artifact is approved.")
        : this.blocker(
            "contract.approved",
            "CODEX_EXECUTION_CONTRACT_NOT_APPROVED",
            "Contract artifact must be an approved codex_execution_contract.",
          ),
    );
    if (contractArtifact) {
      try {
        codexExecutionContractSchema.parse(contractArtifact.contentJson);
        push(this.info("contract.schema", "CODEX_CONTRACT_SCHEMA_VALID", "Contract schema is valid."));
      } catch (error) {
        push(this.blocker("contract.schema", "CODEX_CONTRACT_SCHEMA_INVALID", "Contract schema validation failed.", {
          message: error instanceof Error ? error.message : "Unknown schema failure.",
        }));
      }
    }

    if (this.env.CODEX_EXECUTION_MODE === "disabled") {
      push(this.blocker("mode.enabled", "CODEX_EXECUTION_DISABLED", "CODEX_EXECUTION_MODE is disabled."));
    } else {
      push(this.info("mode.enabled", "CODEX_EXECUTION_MODE_ENABLED", "CODEX_EXECUTION_MODE is not disabled.", {
        mode: this.env.CODEX_EXECUTION_MODE,
      }));
    }
    if (this.env.CODEX_EXECUTION_MODE === "live") {
      push(
        this.blocker(
          "mode.live",
          "CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED",
          "Live Codex execution is intentionally not implemented.",
        ),
      );
    }

    try {
      const executorReport = await this.executorClient.preflight(run.id, {
        workspaceId: run.workspaceId,
        contractArtifactId: run.contractArtifactId,
        mode: this.env.CODEX_EXECUTION_MODE,
        status: run.status,
        branchName: run.branchName,
        allowedFiles: run.allowedFiles,
        forbiddenFiles: run.forbiddenFiles,
        allowedCommands: run.allowedCommands,
        forbiddenCommands: run.forbiddenCommands,
        requiredTests: run.requiredTests,
      });
      checks.push(...executorReport.checks);
      for (const blockerCode of executorReport.blockers) {
        if (!checks.some((check: CodexPreflightCheck) => check.code === blockerCode)) {
          checks.push(
            this.blocker(
              "executor.blocker",
              blockerCode,
              `Executor reported blocker ${blockerCode}.`,
            ),
          );
        }
      }
      const manifestCheck = executorReport.checks.find(
        (check: CodexPreflightCheck) => check.code === "CODEX_EXECUTION_MANIFEST_CREATED",
      );
      const manifestPath =
        typeof manifestCheck?.metadata?.manifestPath === "string" ? manifestCheck.metadata.manifestPath : null;
      if (manifestPath) {
        await this.db.codexExecutionRun.update({
          where: { id: run.id },
          data: { executionWorkspaceManifestPath: manifestPath },
        });
      }
    } catch (error) {
      push(
        this.blocker(
          "executor.preflight",
          this.errorCode(error, "CODEX_EXECUTOR_PREFLIGHT_UNAVAILABLE"),
          error instanceof Error ? error.message : "Executor preflight failed.",
        ),
      );
    }

    return this.finalizePreflight(run, checks);
  }

  private async getRun(runId: string): Promise<CodexExecutionRun> {
    const run = await this.db.codexExecutionRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw Object.assign(new Error("Codex execution run not found."), {
        statusCode: 404,
        code: "CODEX_EXECUTION_RUN_NOT_FOUND",
      });
    }
    return run;
  }

  private validateSafetySnapshot(run: CodexExecutionRun): void {
    this.assertNonEmpty("allowed files", run.allowedFiles);
    this.assertNonEmpty("forbidden files", run.forbiddenFiles);
    this.assertNonEmpty("allowed commands", run.allowedCommands);
    this.assertNonEmpty("forbidden commands", run.forbiddenCommands);

    for (const file of [...run.allowedFiles, ...run.forbiddenFiles]) {
      this.assertSafeRepoPath(file);
    }
    for (const command of [...run.allowedCommands, ...run.forbiddenCommands]) {
      this.assertSafeCommand(command);
    }

    const allowedDirectories = run.allowedFiles
      .filter((file) => file.endsWith("/"))
      .map((file) => this.normalizeRepoPath(file));
    const fileEntriesOutsideAllowedDirectories = run.allowedFiles
      .filter((file) => !file.endsWith("/"))
      .filter((file) => allowedDirectories.length > 0 && !this.isInsideAllowedDirectory(file, allowedDirectories));
    if (fileEntriesOutsideAllowedDirectories.length > 0) {
      throw Object.assign(new Error("Allowed files must be inside allowed directories."), {
        statusCode: 409,
        code: "CODEX_FILE_OUTSIDE_ALLOWED_DIRECTORIES",
        details: { fileEntriesOutsideAllowedDirectories },
      });
    }

    const overlappingFiles = run.allowedFiles.filter((file) =>
      run.forbiddenFiles.some((forbiddenFile) => this.pathMatchesPattern(file, forbiddenFile)),
    );
    const overlappingCommands = run.allowedCommands.filter((command) =>
      run.forbiddenCommands.some((forbiddenCommand) => this.commandMatchesPattern(command, forbiddenCommand)),
    );

    if (overlappingFiles.length > 0) {
      throw Object.assign(new Error("Allowed files cannot also be forbidden files."), {
        statusCode: 409,
        code: "CODEX_FORBIDDEN_FILE_CONFLICT",
        details: { overlappingFiles },
      });
    }
    if (overlappingCommands.length > 0) {
      throw Object.assign(new Error("Allowed commands cannot also be forbidden commands."), {
        statusCode: 409,
        code: "CODEX_FORBIDDEN_COMMAND_CONFLICT",
        details: { overlappingCommands },
      });
    }
  }

  private assertNonEmpty(label: string, values: string[]): void {
    if (values.length === 0) {
      throw Object.assign(new Error(`Codex execution run must include ${label}.`), {
        statusCode: 409,
        code: "CODEX_EXECUTION_SAFETY_SNAPSHOT_INCOMPLETE",
      });
    }
  }

  private async appendRunLog(run: CodexExecutionRun, entry: ExecutionLogEntry): Promise<CodexExecutionRun> {
    return this.db.codexExecutionRun.update({
      where: { id: run.id },
      data: {
        executionLogs: [...this.readLogs(run), entry] as Prisma.InputJsonArray,
      },
    });
  }

  private readLogs(run: CodexExecutionRun): ExecutionLogEntry[] {
    return Array.isArray(run.executionLogs) ? (run.executionLogs as unknown as ExecutionLogEntry[]) : [];
  }

  private async writeWorkspaceManifest(runId: string, manifest: Prisma.InputJsonObject): Promise<string> {
    const manifestPath = `${EXECUTION_WORKSPACE_ROOT}/${runId}/manifest.json`;
    const absoluteManifestPath = this.resolveWorkspacePath(manifestPath);
    await fs.mkdir(path.dirname(absoluteManifestPath), { recursive: true });
    await fs.writeFile(absoluteManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifestPath;
  }

  private resolveWorkspacePath(relativePath: string): string {
    this.assertSafeRepoPath(relativePath);
    const repositoryRoot = this.getRepositoryRoot();
    const root = path.resolve(repositoryRoot, EXECUTION_WORKSPACE_ROOT);
    const resolved = path.resolve(repositoryRoot, relativePath);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw Object.assign(new Error("Execution workspace path must stay inside .revealth/execution-runs."), {
        statusCode: 409,
        code: "CODEX_EXECUTION_WORKSPACE_PATH_ESCAPE",
      });
    }
    return resolved;
  }

  private getRepositoryRoot(): string {
    if (this.repositoryRoot) return this.repositoryRoot;
    let current = process.cwd();
    while (true) {
      if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
        this.repositoryRoot = current;
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        this.repositoryRoot = process.cwd();
        return this.repositoryRoot;
      }
      current = parent;
    }
  }

  private async finalizePreflight(run: CodexExecutionRun | null, checks: CodexPreflightCheck[]): Promise<CodexPreflightReport> {
    const blockers = checks.filter((check) => !check.passed && check.severity === "blocker").map((check) => check.code);
    const warnings = checks.filter((check) => !check.passed && check.severity === "warning").map((check) => check.code);
    const passed = blockers.length === 0;
    const report: CodexPreflightReport = {
      passed,
      checks,
      blockers,
      warnings,
      nextAllowedAction: this.nextAllowedAction(passed),
    };

    if (run) {
      await this.audit.append({
        workspaceId: run.workspaceId,
        actorType: "system",
        actorId: "SandboxedCodexExecutionAdapter",
        action: passed ? "codex.execution_run.preflight.passed" : "codex.execution_run.preflight.failed",
        sourceArtifactIds: [run.contractArtifactId],
        targetArtifactIds: [run.contractArtifactId],
        status: passed ? "success" : "failed",
        errorCode: passed ? null : blockers[0] ?? "CODEX_PREFLIGHT_FAILED",
        eventJson: {
          codexExecutionRunId: run.id,
          mode: this.env.CODEX_EXECUTION_MODE,
          passed,
          blockers,
          warnings,
          nextAllowedAction: report.nextAllowedAction,
        },
      });
    }

    return report;
  }

  private nextAllowedAction(passed: boolean): CodexPreflightReport["nextAllowedAction"] {
    if (this.env.CODEX_EXECUTION_MODE === "disabled") return "set_CODEX_EXECUTION_MODE_dry_run_for_validation";
    if (this.env.CODEX_EXECUTION_MODE === "live") return "live_execution_blocked_not_implemented";
    return passed ? "start_dry_run" : "resolve_blockers";
  }

  private info(
    name: string,
    code: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): CodexPreflightCheck {
    return { name, passed: true, code, message, severity: "info", metadata };
  }

  private blocker(
    name: string,
    code: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): CodexPreflightCheck {
    return { name, passed: false, code, message, severity: "blocker", metadata };
  }

  private errorCode(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
      return error.code;
    }
    return fallback;
  }

  private assertSafeRepoPath(value: string): void {
    if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
      throw Object.assign(new Error("Execution contract paths must be repository-relative."), {
        statusCode: 409,
        code: "CODEX_ABSOLUTE_PATH_REJECTED",
        details: { value },
      });
    }
    const normalized = this.normalizeRepoPath(value);
    if (
      normalized === ".." ||
      normalized.startsWith("../") ||
      normalized.includes("/../") ||
      normalized.endsWith("/..")
    ) {
      throw Object.assign(new Error("Execution contract paths cannot contain path traversal."), {
        statusCode: 409,
        code: "CODEX_PATH_TRAVERSAL_REJECTED",
        details: { value },
      });
    }
  }

  private assertSafeCommand(value: string): void {
    if (value.trim().length === 0) {
      throw Object.assign(new Error("Execution contract commands cannot be empty."), {
        statusCode: 409,
        code: "CODEX_EMPTY_COMMAND_REJECTED",
      });
    }
  }

  private normalizeRepoPath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  private isInsideAllowedDirectory(file: string, allowedDirectories: string[]): boolean {
    const normalized = this.normalizeRepoPath(file);
    return allowedDirectories.some((directory) => normalized.startsWith(directory));
  }

  private pathMatchesPattern(value: string, pattern: string): boolean {
    const normalizedValue = this.normalizeRepoPath(value);
    const normalizedPattern = this.normalizeRepoPath(pattern);
    if (normalizedValue === normalizedPattern) return true;
    if (normalizedPattern.endsWith("/") && normalizedValue.startsWith(normalizedPattern)) return true;
    return new RegExp(`^${this.wildcardPatternToRegex(normalizedPattern)}$`).test(normalizedValue);
  }

  private commandMatchesPattern(command: string, pattern: string): boolean {
    if (command === pattern) return true;
    const escaped = this.wildcardPatternToRegex(pattern, ".*");
    return new RegExp(`^${escaped}$`).test(command);
  }

  private wildcardPatternToRegex(pattern: string, singleStarReplacement = "[^/]*"): string {
    let regex = "";
    for (let index = 0; index < pattern.length; index += 1) {
      const char = pattern.charAt(index);
      const next = pattern[index + 1];
      if (char === "*" && next === "*") {
        regex += ".*";
        index += 1;
        continue;
      }
      if (char === "*") {
        regex += singleStarReplacement;
        continue;
      }
      regex += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return regex;
  }
}
