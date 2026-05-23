import { describe, expect, it } from "vitest";
import { validateUpstreamLineageGate } from "./lineage-validation.js";

const validGate = {
  upstreamArtifactType: "project_brief",
  upstreamStatus: "approved",
  expectedUpstreamArtifactType: "project_brief",
  downstreamArtifactType: "sdlc_plan",
  hasApprovedSourceApproval: true,
  hasNewerUpstreamVersion: false,
};

describe("validateUpstreamLineageGate", () => {
  it("rejects invalid lineage for the requested downstream artifact", () => {
    const result = validateUpstreamLineageGate({
      ...validGate,
      upstreamArtifactType: "task_batch",
    });

    expect(result).toEqual({
      ok: false,
      reason: "sdlc_plan requires project_brief, received task_batch.",
    });
  });

  it("rejects missing upstream approval", () => {
    const result = validateUpstreamLineageGate({
      ...validGate,
      hasApprovedSourceApproval: false,
    });

    expect(result).toEqual({
      ok: false,
      reason: "sdlc_plan requires an approved source approval.",
    });
  });

  it("rejects stale upstream artifacts", () => {
    const result = validateUpstreamLineageGate({
      ...validGate,
      hasNewerUpstreamVersion: true,
    });

    expect(result).toEqual({
      ok: false,
      reason: "sdlc_plan cannot use a stale upstream artifact.",
    });
  });

  it("allows successful chain continuation when lineage is valid", () => {
    expect(validateUpstreamLineageGate(validGate)).toEqual({ ok: true });
  });
});
