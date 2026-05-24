import Link from "next/link";
import * as React from "react";
import type { AgentAssignment, ControlPlaneDashboard } from "../../../../../lib/api-client";
import { statusTone } from "../../../../../lib/control-plane";

const AGENT_IDENTITIES = [
  { agentId: "ceo", name: "CEO Agent", role: "Sets direction", department: "Leadership", avatar: "C" },
  { agentId: "cto", name: "CTO Agent", role: "Reviews technical safety", department: "Leadership", avatar: "T" },
  { agentId: "product_manager", name: "Product Manager Agent", role: "Shapes the product", department: "Product", avatar: "P" },
  { agentId: "engineering_manager", name: "Engineering Manager Agent", role: "Coordinates delivery", department: "Engineering", avatar: "E" },
  { agentId: "designer", name: "Designer Agent", role: "Designs the system experience", department: "Design", avatar: "D" },
  { agentId: "frontend_developer", name: "Frontend Developer Agent", role: "Plans the interface", department: "Engineering", avatar: "F" },
  { agentId: "backend_developer", name: "Backend Developer Agent", role: "Plans services and data", department: "Engineering", avatar: "B" },
  { agentId: "qa", name: "QA Agent", role: "Reviews quality", department: "Quality", avatar: "Q" },
  { agentId: "devops", name: "DevOps Agent", role: "Checks reliability", department: "Operations", avatar: "O" },
  { agentId: "sales", name: "Sales Agent", role: "Prepares client communication", department: "Client", avatar: "S" },
  { agentId: "customer_success", name: "Customer Success Agent", role: "Tracks client readiness", department: "Client", avatar: "U" },
] as const;

const TRACKER_STAGES = [
  "Idea Received",
  "Planning",
  "Team Assigned",
  "Work In Progress",
  "Review Needed",
  "Ready for Approval",
  "Completed / Blocked",
] as const;

function Badge({ status }: { status: string }) {
  return <span className={`badge ${statusTone(status)}`}>{simpleStatus(status)}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel grid compact">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function simpleStatus(status: string): string {
  const normalized = status.replaceAll("_", " ");
  if (status === "pending_approval" || status === "waiting_for_approval") return "Waiting for owner approval";
  if (status === "working" || status === "in_progress") return "Working";
  if (status === "completed" || status === "completed_dry_run") return "Ready for next step";
  if (status === "approved") return "Approved";
  if (status === "blocked") return "Blocked";
  return normalized;
}

function simpleTask(task: string, status: string): string {
  const text = `${task} ${status}`.toLowerCase();
  if (text.includes("approval") || status === "waiting_for_approval") return "Waiting for owner approval";
  if (text.includes("task")) return "The team is preparing tasks";
  if (text.includes("design")) return "Designing the system";
  if (text.includes("quality") || text.includes("review") || text.includes("qa")) return "Reviewing safety";
  if (text.includes("client") || text.includes("communication")) return "Preparing client updates";
  if (text.includes("plan") || text.includes("brief")) return "Your AI team is reviewing it";
  return task || "Ready for next step";
}

function timelineLabel(messageType: string, index: number): string {
  const time = index === 0 ? "2 minutes ago" : index === 1 ? "5 minutes ago" : `${(index + 1) * 4} minutes ago`;
  if (messageType === "blocker") return `${time} - risk detected`;
  if (messageType === "handoff") return `${time} - handoff complete`;
  if (messageType === "review") return `${time} - review requested`;
  if (messageType === "question") return `${time} - awaiting approval`;
  if (messageType === "decision") return `${time} - decision recorded`;
  return `${time} - update posted`;
}

function projectStageIndex(dashboard: ControlPlaneDashboard): number {
  if (dashboard.approvals.some((approval) => approval.status === "pending")) return 5;
  if (dashboard.workforceDispatches.length > 0) return 3;
  if (dashboard.activatedWorkforceAssignments.length > 0 || dashboard.agentAssignments.length > 0) return 2;
  if (dashboard.artifacts.some((artifact) => artifact.artifactType === "project_brief")) return 1;
  if (dashboard.workflowRuns.length > 0 || dashboard.auditEvents.length > 0) return 0;
  return 0;
}

function journeyText(dashboard: ControlPlaneDashboard): string {
  if (dashboard.approvals.some((approval) => approval.status === "pending")) return "Waiting for owner approval";
  if (dashboard.workforceDispatches.length > 0) return "Work has been divided between agents";
  if (dashboard.agentAssignments.length > 0) return "Your AI team is reviewing it";
  if (dashboard.artifacts.length > 0) return "The team is preparing tasks";
  return "We received your project idea";
}

function assignmentFor(agentId: string, assignments: AgentAssignment[]) {
  return assignments.find((assignment) => assignment.agentId === agentId) ?? null;
}

export function CompanyCommandCenterView({
  dashboard,
  workspaceId,
}: {
  dashboard: ControlPlaneDashboard;
  workspaceId: string;
}) {
  const stageIndex = projectStageIndex(dashboard);
  const pendingApprovals = dashboard.approvals.filter((approval) => approval.status === "pending");
  const latestMessages = dashboard.agentMessages.slice(0, 8);
  const clientUpdates = [
    ...dashboard.clientVisibleAgentMessages,
    ...dashboard.clientVisibleConversations.map((conversation) => ({
      id: conversation.id,
      agentRole: conversation.agentRole,
      message: conversation.message,
      messageType: "client update",
      createdAt: conversation.createdAt,
    })),
  ].slice(0, 8);
  const latestReviewPackage = dashboard.outboundReviewPackages[0] ?? null;
  const nextSafeStep =
    latestReviewPackage?.nextSafeStep ??
    (pendingApprovals.length > 0
      ? "Review the waiting approval before the AI team continues."
      : "Open the approval queue or control plane to choose the next governed step.");

  return (
    <div className="grid company-command">
      <div className="toolbar">
        <div>
          <h1>Revealth AI Company Command Center</h1>
          <p className="muted">{dashboard.workspace.name}</p>
        </div>
        <div className="toolbar-actions">
          <Link className="button secondary" href={`/workspaces/${workspaceId}`}>
            Workspace
          </Link>
          <Link className="button secondary" href={`/workspaces/${workspaceId}/control-plane`}>
            Control plane
          </Link>
          <Link className="button secondary" href={`/workspaces/${workspaceId}/approvals`}>
            Approvals
          </Link>
        </div>
      </div>

      <section className="company-hero">
        <div>
          <p className="eyebrow">Living company demo</p>
          <h2>{journeyText(dashboard)}</h2>
          <p className="muted">
            Watch the AI company plan the product, divide work, surface risks, prepare client-safe updates, and stop at approval gates.
          </p>
        </div>
        <div className="hero-metrics">
          <div>
            <strong>{dashboard.agentAssignments.length}</strong>
            <span>AI team members</span>
          </div>
          <div>
            <strong>{pendingApprovals.length}</strong>
            <span>approvals needed</span>
          </div>
          <div>
            <strong>{dashboard.auditEvents.length}</strong>
            <span>audit events</span>
          </div>
        </div>
      </section>

      <div className="story-strip">
        <span>Project starts in planning</span>
        <span>Team assigned</span>
        <span>Work in progress</span>
        <span>Paused for approval</span>
        <span>Safe next step shown</span>
      </div>

      <Section title="Project Journey">
        <div className="project-tracker" aria-label="Project journey tracker">
          {TRACKER_STAGES.map((stage, index) => {
            const status = index < stageIndex ? "approved" : index === stageIndex ? "working" : "queued";
            return (
              <div className="tracker-step" key={stage}>
                <span className={`tracker-dot ${index <= stageIndex ? "active" : ""}`} />
                <strong>{stage}</strong>
                <Badge status={status} />
              </div>
            );
          })}
        </div>
        <div className="journey-notes" aria-label="Plain-language project status">
          <span>We received your project idea</span>
          <span>Your AI team is reviewing it</span>
          <span>Work has been divided between agents</span>
          <span>The team is preparing tasks</span>
          <span>Waiting for owner approval</span>
          <span>Ready for next step</span>
        </div>
      </Section>

      <Section title="AI Team">
        <div className="agent-grid">
          {AGENT_IDENTITIES.map((identity) => {
            const assignment = assignmentFor(identity.agentId, dashboard.agentAssignments);
            const status = assignment?.status ?? "idle";
            return (
              <div className="agent-card" key={identity.agentId}>
                <div className="agent-avatar" aria-hidden="true">
                  {identity.avatar}
                </div>
                <div>
                  <strong>{identity.name}</strong>
                  <p className="muted tight">{identity.role}</p>
                </div>
                <Badge status={status} />
                <span className="department-badge">{identity.department}</span>
                <p className="tight">{simpleTask(assignment?.currentTask ?? "Ready for next step", status)}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid two">
        <Section title="Current Work">
          <div className="table-list">
            {dashboard.workforceDispatches.slice(0, 8).map((dispatch) => (
              <div className="row" key={dispatch.id}>
                <span>{dispatch.assignedAgentRole}</span>
                <Badge status={dispatch.status} />
                <span className="muted">{simpleTask(dispatch.assignmentReason, dispatch.status)}</span>
              </div>
            ))}
            {dashboard.workforceDispatches.length === 0 ? <p className="muted">The team is preparing tasks.</p> : null}
          </div>
        </Section>

        <Section title="Approvals Needed">
          <div className="table-list">
            {pendingApprovals.slice(0, 8).map((approval) => (
              <div className="row" key={approval.id}>
                <span>Owner review</span>
                <Badge status="waiting_for_approval" />
                <span className="muted">Artifact v{approval.artifactVersion}</span>
              </div>
            ))}
            {pendingApprovals.length === 0 ? <p className="muted">No approvals are waiting right now.</p> : null}
          </div>
        </Section>
      </div>

      <div className="grid two">
        <Section title="Team Discussion">
          <div className="timeline">
            {latestMessages.map((message, index) => (
              <div className="timeline-item" key={message.id}>
                <Badge status={message.messageType} />
                <div>
                  <strong>{message.agentRole}</strong>
                  <p className="muted tight">{timelineLabel(message.messageType, index)}</p>
                  <p className="tight">{message.message}</p>
                </div>
              </div>
            ))}
            {latestMessages.length === 0 ? <p className="muted">No team discussion yet.</p> : null}
          </div>
        </Section>

        <Section title="Client Updates">
          <div className="timeline">
            {clientUpdates.map((update, index) => (
              <div className="timeline-item" key={update.id}>
                <Badge status={update.messageType} />
                <div>
                  <strong>{update.agentRole}</strong>
                  <p className="muted tight">{timelineLabel(update.messageType, index)}</p>
                  <p className="tight">{update.message}</p>
                </div>
              </div>
            ))}
            {clientUpdates.length === 0 ? <p className="muted">No client-visible updates yet.</p> : null}
          </div>
        </Section>
      </div>

      <Section title="Next Safe Step">
        <p className="notice">{nextSafeStep}</p>
        <p className="muted tight">
          No external communication, code execution, branches, pull requests, calls, or meetings can happen from this view.
        </p>
      </Section>
    </div>
  );
}
