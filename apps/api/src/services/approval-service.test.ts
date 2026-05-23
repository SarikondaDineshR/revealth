import { describe, expect, it } from "vitest";
import type { DatabaseClient } from "@revealth/database";
import { ApprovalService } from "./approval-service.js";

function createMockDb() {
  const state = {
    artifact: {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      artifactType: "project_brief",
      version: 1,
      status: "pending_approval",
    },
    newerArtifactExists: false,
    approval: {
      id: "33333333-3333-4333-8333-333333333333",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      artifactId: "11111111-1111-4111-8111-111111111111",
      artifactVersion: 1,
      status: "pending",
    },
    workflow: {
      id: "44444444-4444-4444-8444-444444444444",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      status: "waiting_for_approval",
      outputJson: {
        approvalId: "33333333-3333-4333-8333-333333333333",
        artifactId: "11111111-1111-4111-8111-111111111111",
      },
    },
    auditEvents: [] as Array<{ action: string; approvalId?: string | null }>,
  };

  interface MockDb {
    artifact: {
      findFirst: (input?: { where?: { version?: { gt?: number } } }) => Promise<typeof state.artifact | null>;
      update: (input: { data: { status: string } }) => Promise<typeof state.artifact>;
    };
    approval: {
      findFirst: () => Promise<typeof state.approval>;
      update: (input: { data: { status: string; approverId?: string } }) => Promise<typeof state.approval>;
      create: () => Promise<typeof state.approval>;
    };
    workflowRun: {
      findFirst: () => Promise<typeof state.workflow>;
      update: (input: { data: { status: string; outputJson?: unknown } }) => Promise<typeof state.workflow>;
    };
    auditLog: {
      create: (input: { data: { action: string; approvalId?: string | null } }) => Promise<{
        action: string;
        approvalId?: string | null;
      }>;
    };
    $transaction: <T>(fn: (tx: MockDb) => Promise<T>) => Promise<T>;
  }

  const db: MockDb = {
    artifact: {
      findFirst: async (input?: { where?: { version?: { gt?: number } } }) => {
        if (input?.where?.version?.gt !== undefined) {
          return state.newerArtifactExists ? { ...state.artifact, version: input.where.version.gt + 1 } : null;
        }
        return state.artifact;
      },
      update: async ({ data }: { data: { status: string } }) => {
        state.artifact.status = data.status;
        return state.artifact;
      },
    },
    approval: {
      findFirst: async () => state.approval,
      update: async ({ data }: { data: { status: string; approverId?: string } }) => {
        state.approval.status = data.status;
        return { ...state.approval, ...data };
      },
      create: async () => state.approval,
    },
    workflowRun: {
      findFirst: async () => state.workflow,
      update: async ({ data }: { data: { status: string; outputJson?: unknown } }) => {
        state.workflow.status = data.status;
        if (data.outputJson) state.workflow.outputJson = data.outputJson as typeof state.workflow.outputJson;
        return state.workflow;
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; approvalId?: string | null } }) => {
        state.auditEvents.push(data);
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
  };

  return { state, db: db as unknown as DatabaseClient };
}

describe("ApprovalService", () => {
  it("approves artifact and completes waiting workflow", async () => {
    const { db, state } = createMockDb();
    const service = new ApprovalService(db);

    const approval = await service.transition({
      workspaceId: state.approval.workspaceId,
      approvalId: state.approval.id,
      status: "approved",
      approverId: "00000000-0000-4000-8000-000000000001",
      decisionNotes: "Approved.",
    });

    expect(approval.status).toBe("approved");
    expect(state.artifact.status).toBe("approved");
    expect(state.workflow.status).toBe("completed");
    expect(state.auditEvents.map((event) => event.action)).toContain("approval.approved");
  });

  it("rejects artifact and blocks waiting workflow", async () => {
    const { db, state } = createMockDb();
    const service = new ApprovalService(db);

    await service.transition({
      workspaceId: state.approval.workspaceId,
      approvalId: state.approval.id,
      status: "rejected",
      approverId: "00000000-0000-4000-8000-000000000001",
      decisionNotes: "Rejected.",
    });

    expect(state.artifact.status).toBe("rejected");
    expect(state.workflow.status).toBe("blocked");
  });

  it("requests revision and returns artifact to draft", async () => {
    const { db, state } = createMockDb();
    const service = new ApprovalService(db);

    await service.transition({
      workspaceId: state.approval.workspaceId,
      approvalId: state.approval.id,
      status: "revision_requested",
      approverId: "00000000-0000-4000-8000-000000000001",
      decisionNotes: "Needs revision.",
    });

    expect(state.artifact.status).toBe("draft");
    expect(state.workflow.status).toBe("blocked");
  });

  it("rejects stale approvals when artifact version changed", async () => {
    const { db, state } = createMockDb();
    state.artifact.version = 2;
    const service = new ApprovalService(db);

    await expect(
      service.transition({
        workspaceId: state.approval.workspaceId,
        approvalId: state.approval.id,
        status: "approved",
        approverId: "00000000-0000-4000-8000-000000000001",
        decisionNotes: "Approved.",
      }),
    ).rejects.toThrow("Approval is stale");

    expect(state.approval.status).toBe("superseded");
    expect(state.artifact.status).toBe("pending_approval");
  });

  it("rejects stale approvals when a newer artifact version exists", async () => {
    const { db, state } = createMockDb();
    state.newerArtifactExists = true;
    const service = new ApprovalService(db);

    await expect(
      service.transition({
        workspaceId: state.approval.workspaceId,
        approvalId: state.approval.id,
        status: "approved",
        approverId: "00000000-0000-4000-8000-000000000001",
        decisionNotes: "Approved.",
      }),
    ).rejects.toThrow("newer artifact version");

    expect(state.approval.status).toBe("superseded");
    expect(state.artifact.status).toBe("pending_approval");
  });
});
