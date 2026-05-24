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
  workspaceId?: string;
  parentArtifactId?: string | null;
  sourceWorkflowRunId?: string | null;
  sourceApprovalId?: string | null;
  artifactType: string;
  version: number;
  status: string;
  schemaVersion: string;
  contentJson: unknown;
  sourceArtifactIds?: string[];
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

export interface WorkflowRun {
  id: string;
  workflowType: string;
  status: string;
  inputJson: unknown;
  outputJson: unknown | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ExecutionRun {
  id: string;
  contractArtifactId: string;
  sourceGitExecutionPlanId: string;
  branchName: string;
  status: string;
  allowedFiles: string[];
  forbiddenFiles: string[];
  requiredTests: string[];
  executionWorkspaceManifestPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentAssignment {
  id: string;
  workspaceId: string;
  agentId: string;
  role: string;
  currentTask: string;
  assignedArtifactId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentMessage {
  id: string;
  workspaceId: string;
  agentId: string;
  agentRole: string;
  messageType: "update" | "blocker" | "decision" | "question" | "handoff" | "review";
  relatedArtifactId: string | null;
  relatedWorkflowRunId: string | null;
  visibility: "internal" | "client_visible";
  message: string;
  createdAt: string;
}

export interface WorkforceDispatch {
  id: string;
  workspaceId: string;
  taskId: string;
  assignedAgentId: string;
  assignedAgentRole: string;
  assignmentReason: string;
  estimatedComplexity: string;
  status: "assigned" | "in_progress" | "blocked" | "review" | "completed";
  startedAt: string;
  completedAt: string | null;
}

export interface BranchPreparationPlan extends Artifact {
  artifactType: "branch_preparation_plan";
}

export interface WorkforceScalingPlan extends Artifact {
  artifactType: "workforce_scaling_plan";
  contentJson: {
    projectComplexity?: string;
    requiredRoles?: Array<{ role: string; recommendedAgentCount: number; reason: string }>;
    expectedBottlenecks?: string[];
    humanReadableSummary?: string;
  };
}

export interface ClientProfile {
  id: string;
  workspaceId: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  status: "lead" | "prospect" | "customer" | "inactive";
  source: string;
  notes: string;
  createdAt: string;
}

export interface ClientLead {
  id: string;
  workspaceId: string;
  clientProfileId: string;
  clientProfile?: ClientProfile;
  title: string;
  needSummary: string;
  budgetRange: string | null;
  urgency: "low" | "medium" | "high";
  stage: "new" | "discovery" | "proposal_needed" | "waiting_for_approval" | "closed_won" | "closed_lost";
  ownerAgentRole: string;
  createdAt: string;
}

export interface ClientConversation {
  id: string;
  workspaceId: string;
  clientProfileId: string;
  clientProfile?: ClientProfile;
  agentRole: string;
  channel: "simulated_chat" | "internal_note" | "meeting_request";
  visibility: "internal" | "client_visible";
  message: string;
  approvalRequired: boolean;
  approvedAt: string | null;
  createdAt: string;
}

export interface MeetingRequest {
  id: string;
  workspaceId: string;
  clientProfileId: string;
  clientProfile?: ClientProfile;
  requestedByAgentRole: string;
  purpose: string;
  proposedTime: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "scheduled_simulated";
  consentRequired: boolean;
  externalJoinEnabled: boolean;
  createdAt: string;
}

export interface ClientCommunicationScript extends Artifact {
  artifactType: "client_communication_script";
  contentJson: {
    targetClient?: { name: string; company: string };
    objective?: string;
    discoveryQuestions?: string[];
    valueProposition?: string;
    nextStepRecommendation?: string;
    externalCommunicationAllowed?: boolean;
  };
}

export interface ExternalCommunicationPolicy {
  id: string;
  workspaceId: string;
  clientProfileId: string | null;
  leadId: string | null;
  allowedChannel: "simulated_only" | "email_draft" | "meeting_draft" | "voice_draft";
  consentState: "unknown" | "required" | "granted" | "revoked";
  clientApproved: boolean;
  leadApproved: boolean;
  ownerApprovalRequired: boolean;
  auditRequired: boolean;
  status: string;
  notes: string;
  createdAt: string;
}

export interface CommunicationDraft {
  id: string;
  workspaceId: string;
  clientProfileId: string;
  clientProfile?: ClientProfile;
  leadId: string | null;
  scriptArtifactId: string | null;
  channel: "email_draft" | "meeting_draft" | "voice_draft";
  subject: string | null;
  body: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  policyEvaluationJson: unknown;
  createdByAgentRole: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface RepoStatus {
  currentBranch: string;
  isClean: boolean;
  changedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  warning: string | null;
  recommendedNextAction: string;
}

export interface ControlPlaneDashboard {
  workspace: Workspace;
  services: {
    api: { status: string };
    executor: { status: string; data?: unknown; error?: string };
    temporal: { status: string; address: string; namespace: string; taskQueue: string };
  };
  readiness: {
    executionMode: string;
    repoClean: boolean;
    currentBranch: string | null;
    protectedBranchWarning: string | null;
    repoStatus: { status: string; data: RepoStatus | null; error?: string };
    latestPreflightStatus: string;
    latestPreflightErrorCode: string | null;
    readyForLiveExecution: boolean;
  };
  lineage: Array<{
    key: string;
    label: string;
    artifactId: string | null;
    status: string;
    version: number | null;
    createdAt: string | null;
  }>;
  workflowRuns: WorkflowRun[];
  workflowStatusCounts: Record<string, number>;
  artifacts: Artifact[];
  artifactStatusCounts: Record<string, number>;
  approvals: Approval[];
  approvalStatusCounts: Record<string, number>;
  executionRuns: ExecutionRun[];
  executionRunStatusCounts: Record<string, number>;
  auditEvents: AuditEvent[];
  branchPreparationPlans: BranchPreparationPlan[];
  workforceScalingPlans: WorkforceScalingPlan[];
  githubIssues: Array<{ id: string; title: string; status: string; dryRun: boolean; repository: string }>;
  agentAssignments: AgentAssignment[];
  activatedWorkforceAssignments: AgentAssignment[];
  agentMessages: AgentMessage[];
  clientVisibleAgentMessages: AgentMessage[];
  workforceDispatches: WorkforceDispatch[];
  workforceDispatchStatusCounts: Record<string, number>;
  recentWorkforceHandoffs: AgentMessage[];
  clients: ClientProfile[];
  leads: ClientLead[];
  leadStageCounts: Record<string, number>;
  clientConversations: ClientConversation[];
  clientVisibleConversations: ClientConversation[];
  meetingRequests: MeetingRequest[];
  meetingRequestStatusCounts: Record<string, number>;
  clientCommunicationScripts: ClientCommunicationScript[];
  externalCommunicationPolicies: ExternalCommunicationPolicy[];
  latestExternalCommunicationPolicyEvaluation: AuditEvent | null;
  communicationDrafts: CommunicationDraft[];
  communicationDraftStatusCounts: Record<string, number>;
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
  getControlPlaneDashboard: (workspaceId: string) =>
    request<ControlPlaneDashboard>(`/workspaces/${workspaceId}/control-plane`),
};
