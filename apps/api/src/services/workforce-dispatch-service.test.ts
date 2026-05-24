import { describe, expect, it } from "vitest";
import { WorkforceDispatchService } from "./workforce-dispatch-service.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskBatchArtifactId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";

const taskBatchArtifact = {
  id: taskBatchArtifactId,
  artifactType: "task_batch",
  status: "approved",
  contentJson: {
    schemaVersion: "revealth.task_batch.v1",
    taskBatchId: "44444444-4444-4444-8444-444444444444",
    sourceIds: [],
    tasks: [
      {
        taskId,
        title: "Build API integration",
        description: "Review API integration requirements and backend service contracts.",
        type: "feature",
        priority: "p1",
        dependencies: [],
        acceptanceCriteria: ["API behavior is clear."],
        approvalRequired: true,
        sourceArtifactId: taskBatchArtifactId,
      },
    ],
  },
};

function createDb(input: { existingDispatch?: Record<string, unknown> | null; activated?: boolean } = {}) {
  const state = {
    dispatches: input.existingDispatch ? [input.existingDispatch] : ([] as Record<string, unknown>[]),
    messages: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  };
  const assignments = input.activated === false
    ? []
    : [
        {
          id: "assignment-1",
          agentId: "backend_developer",
          role: "Backend Developer Agent",
          currentTask: "Preparing service work",
          assignedArtifactId: "55555555-5555-4555-8555-555555555555",
        },
        {
          id: "assignment-2",
          agentId: "qa",
          role: "QA Agent",
          currentTask: "Reviewing quality",
          assignedArtifactId: "55555555-5555-4555-8555-555555555555",
        },
      ];

  const db = {
    artifact: {
      findFirst: async () => taskBatchArtifact,
    },
    agentAssignment: {
      findMany: async () => assignments,
      update: async () => ({}),
    },
    workforceDispatch: {
      findUnique: async () => state.dispatches[0] ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const dispatch = { id: "dispatch-1", startedAt: new Date(), completedAt: null, ...data };
        state.dispatches.push(dispatch);
        return dispatch;
      },
      findMany: async () => state.dispatches,
    },
    agentMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.messages.push(data);
        return { id: `message-${state.messages.length}`, ...data };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.audits.push(data);
        return { id: `audit-${state.audits.length}`, ...data };
      },
    },
  };
  return { db, state };
}

describe("WorkforceDispatchService", () => {
  it("requires activated workforce assignments", async () => {
    const { db } = createDb({ activated: false });
    const service = new WorkforceDispatchService(db as never);

    await expect(service.dispatch({ workspaceId, actorId: "owner" })).rejects.toThrow("Activate");
  });

  it("dispatches approved task batch tasks to activated agents with messages and audits", async () => {
    const { db, state } = createDb();
    const service = new WorkforceDispatchService(db as never);

    const result = await service.dispatch({ workspaceId, actorId: "owner" });

    expect(result.createdDispatchCount).toBe(1);
    expect(result.skippedDispatchCount).toBe(0);
    expect(state.dispatches[0]?.assignedAgentId).toBe("backend_developer");
    expect(state.messages.map((message) => message.messageType)).toEqual(expect.arrayContaining(["update", "handoff"]));
    expect(state.audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        "workforce.dispatch.started",
        "workforce.dispatch.assignment_created",
        "workforce.dispatch.handoff",
        "workforce.dispatch.completed",
      ]),
    );
  });

  it("skips existing dispatches idempotently", async () => {
    const { db } = createDb({ existingDispatch: { id: "dispatch-existing", taskId } });
    const service = new WorkforceDispatchService(db as never);

    const result = await service.dispatch({ workspaceId, actorId: "owner" });

    expect(result.createdDispatchCount).toBe(0);
    expect(result.skippedDispatchCount).toBe(1);
  });
});
