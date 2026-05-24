import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ExecutorCheck, ExecutorPreflightReport, ExecutorPreflightRequest } from "@revealth/contracts";
import { validateSafetySnapshot } from "./safety.js";

const execFileAsync = promisify(execFile);

export interface CommandRunner {
  run(command: string, args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }>;
}

const defaultCommandRunner: CommandRunner = {
  async run(command, args, options) {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options?.cwd,
      windowsHide: true,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  },
};

export function createDefaultCommandRunner(): CommandRunner {
  return defaultCommandRunner;
}

export class ExecutorPreflightService {
  constructor(
    private readonly repositoryPath: string,
    private readonly commandRunner: CommandRunner = defaultCommandRunner,
  ) {}

  async run(runId: string, input: ExecutorPreflightRequest): Promise<ExecutorPreflightReport> {
    const checks: ExecutorCheck[] = [];
    checks.push(
      input.status === "queued"
        ? info("run.status", "CODEX_RUN_QUEUED", "Run status is queued.")
        : blocker("run.status", "CODEX_RUN_NOT_QUEUED", `Run status must be queued, received ${input.status}.`),
    );

    if (input.mode === "disabled") {
      checks.push(blocker("mode.enabled", "CODEX_EXECUTION_DISABLED", "CODEX_EXECUTION_MODE is disabled."));
    } else {
      checks.push(info("mode.enabled", "CODEX_EXECUTION_MODE_ENABLED", "CODEX_EXECUTION_MODE is not disabled.", { mode: input.mode }));
    }
    if (input.mode === "live") {
      checks.push(blocker("mode.live", "CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED", "Live Codex execution is intentionally not implemented."));
    }

    await this.checkTool("git", checks);
    await this.checkTool("node", checks);
    await this.checkTool("pnpm", checks);
    await this.checkRepository(checks);
    await this.checkGitState(checks);

    checks.push(
      input.requiredTests.length > 0
        ? info("required_tests.defined", "CODEX_REQUIRED_TESTS_DEFINED", "Required tests are defined.", {
            requiredTests: input.requiredTests,
          })
        : blocker("required_tests.defined", "CODEX_REQUIRED_TESTS_MISSING", "Required tests must be defined."),
    );

    try {
      validateSafetySnapshot(input);
      checks.push(info("safety.snapshot", "CODEX_SAFETY_SNAPSHOT_VALID", "Allowed and forbidden paths/commands are valid."));
      checks.push(info("forbidden.commands", "CODEX_FORBIDDEN_COMMANDS_ENFORCED", "Forbidden commands are enforced."));
    } catch (error) {
      checks.push(blocker("safety.snapshot", errorCode(error, "CODEX_SAFETY_SNAPSHOT_INVALID"), error instanceof Error ? error.message : "Safety snapshot validation failed."));
    }

    try {
      const manifestPath = await this.writeManifest(runId, input);
      await this.verifyManifest(manifestPath, runId, input);
      checks.push(info("workspace.manifest", "CODEX_EXECUTION_MANIFEST_CREATED", "Execution workspace manifest can be created.", { manifestPath }));
    } catch (error) {
      checks.push(blocker("workspace.manifest", errorCode(error, "CODEX_EXECUTION_MANIFEST_FAILED"), error instanceof Error ? error.message : "Manifest creation failed."));
    }

    const blockers = checks.filter((check) => !check.passed && check.severity === "blocker").map((check) => check.code);
    const warnings = checks.filter((check) => !check.passed && check.severity === "warning").map((check) => check.code);
    const passed = blockers.length === 0;
    return {
      passed,
      checks,
      blockers,
      warnings,
      nextAllowedAction: nextAllowedAction(input.mode, passed),
    };
  }

  private async checkTool(tool: "git" | "node" | "pnpm", checks: ExecutorCheck[]): Promise<void> {
    try {
      const result = await this.commandRunner.run(tool, ["--version"], { cwd: this.repositoryPath });
      checks.push(info(`tool.${tool}`, "CODEX_REQUIRED_TOOL_AVAILABLE", `${tool} is available.`, {
        version: result.stdout.trim() || result.stderr.trim(),
      }));
    } catch (error) {
      checks.push(blocker(`tool.${tool}`, "CODEX_REQUIRED_TOOL_MISSING", `${tool} is required but unavailable.`, {
        message: error instanceof Error ? error.message : "Unknown tool check failure.",
      }));
    }
  }

  private async checkRepository(checks: ExecutorCheck[]): Promise<void> {
    try {
      await fs.access(this.repositoryPath);
      checks.push(info("repo.available", "CODEX_REPOSITORY_AVAILABLE", "Repository workspace is available.", {
        repositoryPath: this.repositoryPath,
      }));
    } catch (error) {
      checks.push(blocker("repo.available", "CODEX_REPOSITORY_UNAVAILABLE", "Repository workspace is not available.", {
        message: error instanceof Error ? error.message : "Unknown repository access failure.",
      }));
    }
  }

  private async checkGitState(checks: ExecutorCheck[]): Promise<void> {
    try {
      const branch = await this.commandRunner.run("git", ["branch", "--show-current"], { cwd: this.repositoryPath });
      checks.push(info("git.branch", "CODEX_GIT_BRANCH_READ", "Current git branch was read.", { branch: branch.stdout.trim() }));
    } catch (error) {
      checks.push(blocker("git.branch", "CODEX_GIT_BRANCH_UNAVAILABLE", "Current git branch could not be read.", {
        message: error instanceof Error ? error.message : "Unknown git branch failure.",
      }));
    }

    try {
      const status = await this.commandRunner.run("git", ["status", "--porcelain"], { cwd: this.repositoryPath });
      const changedFiles = status.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      checks.push(
        changedFiles.length === 0
          ? info("git.clean", "CODEX_GIT_WORKTREE_CLEAN", "Git worktree is clean.")
          : blocker("git.clean", "CODEX_GIT_WORKTREE_DIRTY", "Git worktree has uncommitted files.", { changedFiles }),
      );
    } catch (error) {
      checks.push(blocker("git.clean", "CODEX_GIT_STATUS_UNAVAILABLE", "Git worktree status could not be checked.", {
        message: error instanceof Error ? error.message : "Unknown git status failure.",
      }));
    }
  }

  private async writeManifest(runId: string, input: ExecutorPreflightRequest): Promise<string> {
    const manifestPath = `.revealth/execution-runs/${runId}/manifest.json`;
    const absoluteManifestPath = path.resolve(this.repositoryPath, manifestPath);
    const executionRoot = path.resolve(this.repositoryPath, ".revealth/execution-runs");
    if (!absoluteManifestPath.startsWith(`${executionRoot}${path.sep}`)) {
      throw Object.assign(new Error("Execution manifest path escaped execution workspace root."), {
        code: "CODEX_EXECUTION_WORKSPACE_PATH_ESCAPE",
      });
    }
    await fs.mkdir(path.dirname(absoluteManifestPath), { recursive: true });
    await fs.writeFile(
      absoluteManifestPath,
      `${JSON.stringify(
        {
          runId,
          workspaceId: input.workspaceId,
          sourceContractId: input.contractArtifactId,
          allowedFiles: input.allowedFiles,
          forbiddenFiles: input.forbiddenFiles,
          branchName: input.branchName,
          createdAt: new Date().toISOString(),
          mode: input.mode,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    return manifestPath;
  }

  private async verifyManifest(manifestPath: string, runId: string, input: ExecutorPreflightRequest): Promise<void> {
    const absoluteManifestPath = path.resolve(this.repositoryPath, manifestPath);
    const parsed = JSON.parse(await fs.readFile(absoluteManifestPath, "utf8")) as {
      runId?: string;
      workspaceId?: string;
      sourceContractId?: string;
      allowedFiles?: string[];
      forbiddenFiles?: string[];
      branchName?: string;
      mode?: string;
    };
    const valid =
      parsed.runId === runId &&
      parsed.workspaceId === input.workspaceId &&
      parsed.sourceContractId === input.contractArtifactId &&
      parsed.branchName === input.branchName &&
      parsed.mode === input.mode &&
      sameList(parsed.allowedFiles ?? [], input.allowedFiles) &&
      sameList(parsed.forbiddenFiles ?? [], input.forbiddenFiles);
    if (!valid) {
      throw Object.assign(new Error("Execution workspace manifest failed integrity verification."), {
        code: "CODEX_EXECUTION_MANIFEST_INTEGRITY_FAILED",
      });
    }
  }
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function nextAllowedAction(mode: ExecutorPreflightRequest["mode"], passed: boolean): ExecutorPreflightReport["nextAllowedAction"] {
  if (mode === "disabled") return "set_CODEX_EXECUTION_MODE_dry_run_for_validation";
  if (mode === "live") return "live_execution_blocked_not_implemented";
  return passed ? "start_dry_run" : "resolve_blockers";
}

function info(name: string, code: string, message: string, metadata?: Record<string, unknown>): ExecutorCheck {
  return { name, passed: true, code, message, severity: "info", metadata };
}

function blocker(name: string, code: string, message: string, metadata?: Record<string, unknown>): ExecutorCheck {
  return { name, passed: false, code, message, severity: "blocker", metadata };
}

function errorCode(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return fallback;
}
