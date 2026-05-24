import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExecutorPreflightService } from "./preflight.js";
import type { ExecutorPreflightRequest } from "@revealth/contracts";

let tempRepo = "";

const request: ExecutorPreflightRequest = {
  workspaceId: "7c2eae1b-0f75-4f3e-9d29-9e816fb324f0",
  contractArtifactId: "a5d711bd-88a8-4826-b793-3b2fbad2d3d2",
  mode: "dry_run",
  status: "queued",
  branchName: "codex/test",
  allowedFiles: ["apps/api/src/", "apps/api/src/routes/codex.ts"],
  forbiddenFiles: [".env", ".git/", "**/*secret*"],
  allowedCommands: ["corepack pnpm --filter @revealth/api test"],
  forbiddenCommands: ["git push", "git reset --hard", "rm -rf"],
  requiredTests: ["corepack pnpm --filter @revealth/api test"],
};

function runner(overrides: Record<string, { stdout?: string; stderr?: string; error?: Error }> = {}) {
  return {
    async run(command: string, args: string[]) {
      const key = `${command} ${args.join(" ")}`;
      const override = overrides[key];
      if (override?.error) throw override.error;
      if (override) return { stdout: override.stdout ?? "", stderr: override.stderr ?? "" };
      if (key === "git --version") return { stdout: "git version 2.45.0\n", stderr: "" };
      if (key === "node --version") return { stdout: "v20.0.0\n", stderr: "" };
      if (key === "pnpm --version") return { stdout: "9.15.4\n", stderr: "" };
      if (key === "git branch --show-current") return { stdout: "main\n", stderr: "" };
      if (key === "git status --porcelain") return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    },
  };
}

beforeEach(async () => {
  tempRepo = await fs.mkdtemp(path.join(os.tmpdir(), "revealth-executor-"));
});

afterEach(async () => {
  await fs.rm(tempRepo, { recursive: true, force: true });
});

describe("Executor preflight service", () => {
  it("passes dry-run preflight and writes manifest only", async () => {
    const service = new ExecutorPreflightService(tempRepo, runner());

    const report = await service.run("run-1", request);

    expect(report.passed).toBe(true);
    expect(report.nextAllowedAction).toBe("start_dry_run");
    const manifest = await fs.readFile(path.join(tempRepo, ".revealth/execution-runs/run-1/manifest.json"), "utf8");
    expect(manifest).toContain(request.contractArtifactId);
  });

  it("fails when git status is dirty", async () => {
    const service = new ExecutorPreflightService(
      tempRepo,
      runner({ "git status --porcelain": { stdout: " M apps/api/src/server.ts\n" } }),
    );

    const report = await service.run("run-1", request);

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_GIT_WORKTREE_DIRTY");
  });

  it("fails when git is missing", async () => {
    const service = new ExecutorPreflightService(tempRepo, runner({ "git --version": { error: new Error("missing") } }));

    const report = await service.run("run-1", request);

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_REQUIRED_TOOL_MISSING");
  });

  it("keeps live mode blocked", async () => {
    const service = new ExecutorPreflightService(tempRepo, runner());

    const report = await service.run("run-1", { ...request, mode: "live" });

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_LIVE_EXECUTION_NOT_IMPLEMENTED");
  });

  it("rejects unsafe file contracts", async () => {
    const service = new ExecutorPreflightService(tempRepo, runner());

    const report = await service.run("run-1", { ...request, allowedFiles: ["../outside.ts"] });

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_PATH_TRAVERSAL_REJECTED");
  });

  it("rejects wildcard allowed file scopes", async () => {
    const service = new ExecutorPreflightService(tempRepo, runner());

    const report = await service.run("run-1", { ...request, allowedFiles: ["apps/api/src/**/*.ts"] });

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_ALLOWED_FILE_WILDCARD_REJECTED");
  });

  it("rejects command shell control operators", async () => {
    const service = new ExecutorPreflightService(tempRepo, runner());

    const report = await service.run("run-1", {
      ...request,
      allowedCommands: ["corepack pnpm test && git push"],
    });

    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("CODEX_UNSAFE_COMMAND_OPERATOR_REJECTED");
  });
});
