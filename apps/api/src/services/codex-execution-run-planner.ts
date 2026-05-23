import crypto from "node:crypto";
import type { CodexExecutionContract } from "@revealth/contracts";

export function assertApprovedCodexExecutionContract(input: { artifactType: string; status: string }) {
  if (input.artifactType !== "codex_execution_contract") {
    throw Object.assign(new Error("Codex execution runs can only be created from codex_execution_contract artifacts."), {
      statusCode: 409,
      code: "INVALID_CODEX_EXECUTION_RUN_SOURCE",
    });
  }

  if (input.status !== "approved") {
    throw Object.assign(new Error("Codex execution contract must be approved before creating an execution run."), {
      statusCode: 409,
      code: "CODEX_EXECUTION_CONTRACT_NOT_APPROVED",
    });
  }
}

export function buildExecutionRunIdempotencyKey(input: { workspaceId: string; contractArtifactId: string }) {
  return crypto.createHash("sha256").update(`${input.workspaceId}:${input.contractArtifactId}`).digest("hex");
}

export function uniqueValues(values: string[]) {
  return [...new Set(values)].sort();
}

export function extractRunSnapshot(contract: CodexExecutionContract) {
  const first = contract.contracts[0];
  if (!first) {
    throw Object.assign(new Error("Codex execution contract contains no contract items."), {
      statusCode: 409,
      code: "EMPTY_CODEX_EXECUTION_CONTRACT",
    });
  }

  return {
    sourceGitExecutionPlanId: contract.sourceGitExecutionPlanArtifactId,
    branchName: first.branchName,
    allowedFiles: uniqueValues(contract.contracts.flatMap((item) => item.exactAllowedFilesOrDirectories)),
    forbiddenFiles: uniqueValues(contract.contracts.flatMap((item) => item.forbiddenFiles)),
    allowedCommands: uniqueValues(contract.contracts.flatMap((item) => item.allowedCommands)),
    forbiddenCommands: uniqueValues(contract.contracts.flatMap((item) => item.forbiddenCommands)),
    requiredTests: uniqueValues(contract.contracts.flatMap((item) => item.requiredTests)),
  };
}

export function assertRunCanBeCancelled(status: string) {
  if (status !== "queued") {
    throw Object.assign(new Error("Only queued Codex execution runs can be cancelled before execution starts."), {
      statusCode: 409,
      code: "CODEX_EXECUTION_RUN_NOT_CANCELLABLE",
    });
  }
}
