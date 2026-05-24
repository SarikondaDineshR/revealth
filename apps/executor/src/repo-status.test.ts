import { describe, expect, it } from "vitest";
import { ExecutorRepoStatusService, parsePorcelainStatus } from "./repo-status.js";

function runner(overrides: Record<string, { stdout?: string; stderr?: string; error?: Error }> = {}) {
  return {
    async run(command: string, args: string[]) {
      const key = `${command} ${args.join(" ")}`;
      const override = overrides[key];
      if (override?.error) throw override.error;
      if (override) return { stdout: override.stdout ?? "", stderr: override.stderr ?? "" };
      if (key === "git branch --show-current") return { stdout: "codex/test\n", stderr: "" };
      if (key === "git status --porcelain=v1") return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    },
  };
}

describe("Executor repo status service", () => {
  it("reports a clean feature branch as ready", async () => {
    const service = new ExecutorRepoStatusService("/repo", runner());

    const status = await service.getStatus();

    expect(status.currentBranch).toBe("codex/test");
    expect(status.isClean).toBe(true);
    expect(status.changedFiles).toEqual([]);
    expect(status.recommendedNextAction).toBe("ready_for_preflight");
  });

  it("warns when clean but on main", async () => {
    const service = new ExecutorRepoStatusService(
      "/repo",
      runner({ "git branch --show-current": { stdout: "main\n" } }),
    );

    const status = await service.getStatus();

    expect(status.isClean).toBe(true);
    expect(status.warning).toContain("protected base branch");
    expect(status.recommendedNextAction).toBe("create_feature_branch_before_execution");
  });

  it("separates staged, unstaged, and untracked files", async () => {
    const service = new ExecutorRepoStatusService(
      "/repo",
      runner({
        "git status --porcelain=v1": {
          stdout: "M  apps/api/src/routes/codex.ts\n M docs/executor-service.md\n?? apps/executor/src/repo-status.ts\n",
        },
      }),
    );

    const status = await service.getStatus();

    expect(status.isClean).toBe(false);
    expect(status.changedFiles).toEqual([
      "apps/api/src/routes/codex.ts",
      "docs/executor-service.md",
      "apps/executor/src/repo-status.ts",
    ]);
    expect(status.stagedFiles).toEqual(["apps/api/src/routes/codex.ts"]);
    expect(status.untrackedFiles).toEqual(["apps/executor/src/repo-status.ts"]);
    expect(status.recommendedNextAction).toBe("review_and_commit_or_stash_changes");
  });

  it("returns an error readiness state when git status cannot be read", async () => {
    const service = new ExecutorRepoStatusService(
      "/repo",
      runner({ "git status --porcelain=v1": { error: new Error("not a git repository") } }),
    );

    const status = await service.getStatus();

    expect(status.isClean).toBe(false);
    expect(status.warning).toContain("not a git repository");
    expect(status.recommendedNextAction).toBe("resolve_repository_status_error");
  });
});

describe("parsePorcelainStatus", () => {
  it("parses porcelain output without mutating repository state", () => {
    expect(parsePorcelainStatus("A  src/a.ts\n D src/b.ts\n?? src/c.ts\n")).toEqual({
      changedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
      stagedFiles: ["src/a.ts"],
      untrackedFiles: ["src/c.ts"],
    });
  });
});
