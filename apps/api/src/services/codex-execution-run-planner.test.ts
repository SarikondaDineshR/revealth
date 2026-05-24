import { describe, expect, it } from "vitest";
import {
  assertApprovedCodexExecutionContract,
  assertRunCanBeCancelled,
  buildExecutionRunIdempotencyKey,
  extractRunSnapshot,
  uniqueValues,
} from "./codex-execution-run-planner.js";

const contract = {
  schemaVersion: "revealth.codex_execution_contract.v1" as const,
  codexExecutionContractId: "b5ada466-0948-4858-a6f4-739d9a0d7a84",
  sourceGitExecutionPlanArtifactId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
  contracts: [
    {
      sourceGitExecutionPlanId: "e9c253cc-2a49-4f02-b760-0c8f7445e606",
      sourceCodexPacketId: "codex-packet-49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
      sourceTaskId: "49d6c8a0-dedb-42aa-876a-9fff9a5a1438",
      exactAllowedFilesOrDirectories: ["apps/api/src/", "packages/contracts/src/", "apps/api/src/"],
      forbiddenFiles: [".env", ".git/"],
      allowedCommands: ["corepack pnpm --filter @revealth/api typecheck"],
      forbiddenCommands: ["git push", "git reset --hard"],
      requiredTests: ["Run API typecheck.", "Run API tests."],
      maxExecutionScope: "single approved Git execution plan only",
      branchName: "codex/feature-implement-approval-gated-artifact-lineage",
      rollbackInstructions: "Revert only the implementation commits.",
      prRequirements: {
        title: "Implement approval-gated artifact lineage",
        bodyMustInclude: ["Objective", "Tests Required"],
        requiredReviewers: ["human-owner"],
        mergeGateChecklist: ["Human owner approves the pull request before merge."],
      },
      humanApprovalRequirements: ["Human owner must approve execution."],
      secretHandlingRules: ["Do not read .env files."],
      securityConstraints: ["No external side effects."],
    },
  ],
  approvalRequired: true as const,
  codeExecutionAllowed: false as const,
  branchCreationAllowed: false as const,
  pullRequestCreationAllowed: false as const,
  sourceIds: ["e9c253cc-2a49-4f02-b760-0c8f7445e606"],
};

describe("Codex execution run planner", () => {
  it("requires approved codex execution contracts", () => {
    expect(() =>
      assertApprovedCodexExecutionContract({ artifactType: "codex_execution_contract", status: "pending_approval" }),
    ).toThrow("must be approved");
    expect(() => assertApprovedCodexExecutionContract({ artifactType: "git_execution_plan", status: "approved" })).toThrow(
      "codex_execution_contract",
    );
    expect(() =>
      assertApprovedCodexExecutionContract({ artifactType: "codex_execution_contract", status: "approved" }),
    ).not.toThrow();
  });

  it("builds stable idempotency keys for a contract", () => {
    const input = {
      workspaceId: "cb97c9da-1d51-4ae8-8fec-d246a628d1d5",
      contractArtifactId: "b5ada466-0948-4858-a6f4-739d9a0d7a84",
    };

    expect(buildExecutionRunIdempotencyKey(input)).toEqual(buildExecutionRunIdempotencyKey(input));
    expect(buildExecutionRunIdempotencyKey(input)).not.toEqual(
      buildExecutionRunIdempotencyKey({ ...input, contractArtifactId: "47c1a8cb-5825-4543-91e0-fb3799852b52" }),
    );
  });

  it("extracts a deduplicated execution safety snapshot", () => {
    const snapshot = extractRunSnapshot(contract);

    expect(snapshot.branchName).toBe("codex/feature-implement-approval-gated-artifact-lineage");
    expect(snapshot.sourceGitExecutionPlanId).toBe("e9c253cc-2a49-4f02-b760-0c8f7445e606");
    expect(snapshot.allowedFiles).toEqual(["apps/api/src/", "packages/contracts/src/"]);
    expect(snapshot.forbiddenCommands).toContain("git push");
  });

  it("only allows queued runs to be cancelled before running", () => {
    expect(() => assertRunCanBeCancelled("queued")).not.toThrow();
    expect(() => assertRunCanBeCancelled("running")).toThrow("Only queued");
    expect(() => assertRunCanBeCancelled("completed_dry_run")).toThrow("Only queued");
  });

  it("sorts unique values deterministically", () => {
    expect(uniqueValues(["b", "a", "b"])).toEqual(["a", "b"]);
  });
});
