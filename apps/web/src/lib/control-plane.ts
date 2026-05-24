export function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (["approved", "completed", "completed_dry_run", "ready_for_live_execution", "ok", "passed"].includes(status)) {
    return "good";
  }
  if (["pending", "pending_approval", "queued", "running", "not_run", "draft"].includes(status)) {
    return "warn";
  }
  if (["failed", "rejected", "cancelled", "error", "dirty"].includes(status)) {
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
