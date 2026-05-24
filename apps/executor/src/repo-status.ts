import type { ExecutorRepoStatus } from "@revealth/contracts";
import type { CommandRunner } from "./preflight.js";

export class ExecutorRepoStatusService {
  constructor(
    private readonly repositoryPath: string,
    private readonly commandRunner: CommandRunner,
  ) {}

  async getStatus(): Promise<ExecutorRepoStatus> {
    try {
      const [branchResult, statusResult] = await Promise.all([
        this.commandRunner.run("git", ["branch", "--show-current"], { cwd: this.repositoryPath }),
        this.commandRunner.run("git", ["status", "--porcelain=v1"], { cwd: this.repositoryPath }),
      ]);
      const currentBranch = branchResult.stdout.trim();
      const parsed = parsePorcelainStatus(statusResult.stdout);
      const isClean = parsed.changedFiles.length === 0;
      const isMain = currentBranch === "main" || currentBranch === "master";

      return {
        currentBranch,
        isClean,
        changedFiles: parsed.changedFiles,
        untrackedFiles: parsed.untrackedFiles,
        stagedFiles: parsed.stagedFiles,
        warning: isMain ? "Current branch is a protected base branch. Future live execution should use a feature branch." : null,
        recommendedNextAction: recommendedNextAction({ isClean, isMain }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Repository status could not be read.";
      return {
        currentBranch: "",
        isClean: false,
        changedFiles: [],
        untrackedFiles: [],
        stagedFiles: [],
        warning: message,
        recommendedNextAction: "resolve_repository_status_error",
      };
    }
  }
}

export function parsePorcelainStatus(output: string): Pick<ExecutorRepoStatus, "changedFiles" | "untrackedFiles" | "stagedFiles"> {
  const changedFiles: string[] = [];
  const untrackedFiles: string[] = [];
  const stagedFiles: string[] = [];

  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const status = rawLine.slice(0, 2);
    const filePath = rawLine.slice(3).trim();
    if (!filePath) continue;

    changedFiles.push(filePath);
    if (status === "??") {
      untrackedFiles.push(filePath);
      continue;
    }
    if (status[0] !== " ") {
      stagedFiles.push(filePath);
    }
  }

  return { changedFiles, untrackedFiles, stagedFiles };
}

function recommendedNextAction(input: { isClean: boolean; isMain: boolean }): ExecutorRepoStatus["recommendedNextAction"] {
  if (!input.isClean) return "review_and_commit_or_stash_changes";
  if (input.isMain) return "create_feature_branch_before_execution";
  return "ready_for_preflight";
}
