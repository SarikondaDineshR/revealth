export interface UpstreamLineageGateInput {
  upstreamArtifactType: string;
  upstreamStatus: string;
  expectedUpstreamArtifactType: string;
  downstreamArtifactType: string;
  hasApprovedSourceApproval: boolean;
  hasNewerUpstreamVersion: boolean;
}

export type UpstreamLineageGateResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
    };

export function validateUpstreamLineageGate(input: UpstreamLineageGateInput): UpstreamLineageGateResult {
  if (input.upstreamArtifactType !== input.expectedUpstreamArtifactType) {
    return {
      ok: false,
      reason: `${input.downstreamArtifactType} requires ${input.expectedUpstreamArtifactType}, received ${input.upstreamArtifactType}.`,
    };
  }

  if (input.upstreamStatus !== "approved") {
    return {
      ok: false,
      reason: `${input.downstreamArtifactType} requires approved ${input.expectedUpstreamArtifactType}.`,
    };
  }

  if (!input.hasApprovedSourceApproval) {
    return {
      ok: false,
      reason: `${input.downstreamArtifactType} requires an approved source approval.`,
    };
  }

  if (input.hasNewerUpstreamVersion) {
    return {
      ok: false,
      reason: `${input.downstreamArtifactType} cannot use a stale upstream artifact.`,
    };
  }

  return { ok: true };
}
