import { describe, expect, it } from "vitest";
import { compactId, dashboardReadinessLabel, formatCountMap, statusTone } from "./control-plane";

describe("control plane UI helpers", () => {
  it("maps operational statuses to tones", () => {
    expect(statusTone("ready_for_live_execution")).toBe("good");
    expect(statusTone("queued")).toBe("warn");
    expect(statusTone("failed")).toBe("bad");
    expect(statusTone("missing")).toBe("neutral");
  });

  it("compacts ids for dense dashboard display", () => {
    expect(compactId("12345678-1234-4000-8000-123456789abc")).toBe("12345678...9abc");
    expect(compactId(null)).toBe("none");
  });

  it("formats count maps predictably", () => {
    expect(formatCountMap({ running: 1, queued: 2 })).toBe("queued: 2 | running: 1");
    expect(formatCountMap({})).toBe("none");
  });

  it("renders dashboard readiness wording for operators", () => {
    expect(
      dashboardReadinessLabel({
        repoClean: false,
        latestPreflightStatus: "failed",
        readyForLiveExecution: false,
      }),
    ).toBe("repo dirty | preflight failed | not ready");
  });
});
