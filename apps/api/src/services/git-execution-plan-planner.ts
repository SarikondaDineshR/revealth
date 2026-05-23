import crypto from "node:crypto";
import type { CodexTaskPacket, CodexTaskPacketBatch, GitExecutionPlanItem } from "@revealth/contracts";

export function assertApprovedCodexTaskPacketBatch(input: { artifactType: string; status: string }) {
  if (input.artifactType !== "codex_task_packet_batch") {
    throw Object.assign(new Error("Git execution plans can only be generated from codex_task_packet_batch artifacts."), {
      statusCode: 409,
      code: "INVALID_GIT_PLAN_SOURCE_ARTIFACT",
    });
  }

  if (input.status !== "approved") {
    throw Object.assign(new Error("Codex task packet batch must be approved before generating Git execution plans."), {
      statusCode: 409,
      code: "CODEX_TASK_PACKET_BATCH_NOT_APPROVED",
    });
  }
}

export function resolveCodexPacketId(input: { packet: CodexTaskPacket; batch: CodexTaskPacketBatch }) {
  return input.packet.codexTaskPacketId ?? `codex-packet-${input.batch.codexTaskPacketBatchId}-${input.packet.taskId}`;
}

export function buildPrBodyDraft(packet: CodexTaskPacket) {
  return [
    `## Objective`,
    packet.businessObjective,
    "",
    `## Technical Plan`,
    packet.technicalObjective,
    "",
    `## Acceptance Criteria`,
    ...packet.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    `## Tests Required`,
    ...packet.testExpectations.map((test) => `- ${test}`),
    "",
    `## Security Notes`,
    ...packet.securityNotes.map((note) => `- ${note}`),
    "",
    `## Rollback`,
    packet.rollbackNotes,
  ].join("\n");
}

export function buildGitExecutionPlanItem(input: {
  packet: CodexTaskPacket;
  batch: CodexTaskPacketBatch;
  requiredReviewers: string[];
}): GitExecutionPlanItem {
  return {
    sourceCodexPacketId: resolveCodexPacketId({ packet: input.packet, batch: input.batch }),
    sourceTaskId: input.packet.taskId,
    branchName: input.packet.branchNameRecommendation,
    commitStrategy:
      "Use one focused implementation commit for this task, followed by a separate test/documentation commit only if the change naturally splits.",
    prTitle: input.packet.prTitleRecommendation,
    prBodyDraft: buildPrBodyDraft(input.packet),
    requiredTests: input.packet.testExpectations,
    requiredReviewers: input.requiredReviewers,
    rollbackPlan: input.packet.rollbackNotes,
    mergeGateChecklist: [
      "Source Codex task packet batch is approved.",
      "GitHub issue tracking exists before implementation begins.",
      "All acceptance criteria are satisfied.",
      "Required tests pass locally or in CI.",
      "Human owner approves the pull request before merge.",
      "No secrets or unapproved external side effects are introduced.",
    ],
  };
}

export function buildGitExecutionPlan(input: {
  batch: CodexTaskPacketBatch;
  sourceCodexTaskPacketBatchArtifactId: string;
  requiredReviewers: string[];
}) {
  return {
    schemaVersion: "revealth.git_execution_plan.v1" as const,
    gitExecutionPlanId: crypto.randomUUID(),
    sourceCodexTaskPacketBatchArtifactId: input.sourceCodexTaskPacketBatchArtifactId,
    plans: input.batch.packets.map((packet) =>
      buildGitExecutionPlanItem({
        packet,
        batch: input.batch,
        requiredReviewers: input.requiredReviewers,
      }),
    ),
    approvalRequired: true as const,
    branchCreationAllowed: false as const,
    pullRequestCreationAllowed: false as const,
    codeExecutionAllowed: false as const,
    sourceIds: [input.sourceCodexTaskPacketBatchArtifactId],
  };
}
