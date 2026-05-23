const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const localOwnerId = "00000000-0000-4000-8000-000000000001";

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  requestId: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-user-id": localOwnerId,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error) {
    throw new Error(envelope.error?.message ?? `Request failed with ${response.status}`);
  }
  if (envelope.data === null) {
    throw new Error("API returned no data.");
  }
  return envelope.data;
}

export interface Workspace {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  artifactType: string;
  version: number;
  status: string;
  schemaVersion: string;
  contentJson: unknown;
  createdAt: string;
}

export interface Approval {
  id: string;
  artifactId: string;
  artifactVersion: number;
  status: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  status: string;
  eventJson: unknown;
  createdAt: string;
}

export const api = {
  listWorkspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (name: string) =>
    request<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  listArtifacts: (workspaceId: string) => request<Artifact[]>(`/workspaces/${workspaceId}/artifacts`),
  listApprovals: (workspaceId: string) => request<Approval[]>(`/workspaces/${workspaceId}/approvals`),
  getArtifact: (workspaceId: string, artifactId: string) =>
    request<Artifact>(`/workspaces/${workspaceId}/artifacts/${artifactId}`),
  createApproval: (workspaceId: string, artifactId: string, artifactVersion: number) =>
    request<Approval>(`/workspaces/${workspaceId}/approvals`, {
      method: "POST",
      body: JSON.stringify({ artifactId, artifactVersion, reason: "Founder review required." }),
    }),
  decideApproval: (
    workspaceId: string,
    approvalId: string,
    status: "approved" | "rejected" | "revision_requested",
    decisionNotes: string,
  ) =>
    request<Approval>(`/workspaces/${workspaceId}/approvals/${approvalId}/${status}`, {
      method: "POST",
      body: JSON.stringify({ decisionNotes }),
    }),
  startIntake: (workspaceId: string, rawProjectIdea: string) =>
    request<{ id: string }>(`/workspaces/${workspaceId}/workflows/intake`, {
      method: "POST",
      body: JSON.stringify({ rawProjectIdea }),
    }),
  listAuditEvents: (workspaceId: string) => request<AuditEvent[]>(`/workspaces/${workspaceId}/audit-events`),
};
