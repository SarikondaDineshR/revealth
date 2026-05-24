export function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (["approved", "completed", "completed_dry_run", "ready_for_live_execution", "ok", "passed", "decision", "handoff", "review"].includes(status)) {
    return "good";
  }
  if (["pending", "pending_approval", "queued", "running", "not_run", "draft", "thinking", "working", "waiting_for_approval", "update", "question"].includes(status)) {
    return "warn";
  }
  if (["failed", "rejected", "cancelled", "error", "dirty", "blocked", "blocker"].includes(status)) {
    return "bad";
  }
  return "neutral";
}

export function compactId(id: string | null | undefined): string {
  if (!id) return "none";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function formatCountMap(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return "none";
  return entries.map(([key, value]) => `${key}: ${value}`).join(" | ");
}

export function dashboardReadinessLabel(input: {
  repoClean: boolean;
  latestPreflightStatus: string;
  readyForLiveExecution: boolean;
}): string {
  const repo = input.repoClean ? "repo clean" : "repo dirty";
  const ready = input.readyForLiveExecution ? "ready for live execution" : "not ready";
  return `${repo} | preflight ${input.latestPreflightStatus} | ${ready}`;
}

export function demoStatusLabel(input: {
  pendingApprovals: number;
  latestExecutionStatus: string | null;
  githubDryRunCount: number;
}): string {
  if (input.pendingApprovals > 0) return `${input.pendingApprovals} approvals waiting`;
  if (input.latestExecutionStatus === "completed_dry_run") return "demo smoke path complete";
  if (input.githubDryRunCount > 0) return "github dry-run ready";
  return "waiting for workflow progress";
}

export function readinessMessage(input: {
  executionMode: string;
  repoClean: boolean;
  protectedBranchWarning: string | null;
  readyForLiveExecution: boolean;
}): string {
  if (input.executionMode === "disabled") return "Execution starts are disabled. Dry-run mode is required for demo smoke.";
  if (input.protectedBranchWarning) return input.protectedBranchWarning;
  if (!input.repoClean) return "Executor repository is dirty. Clean or commit changes before future live readiness.";
  if (input.readyForLiveExecution) return "Run is marked ready, but live execution remains intentionally blocked.";
  return "Dry-run execution is available after an approved execution contract.";
}
