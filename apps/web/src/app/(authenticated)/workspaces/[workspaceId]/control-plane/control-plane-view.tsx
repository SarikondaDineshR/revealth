import Link from "next/link";
import * as React from "react";
import type { ControlPlaneDashboard } from "../../../../../lib/api-client";
import { compactId, demoStatusLabel, formatCountMap, readinessMessage, statusTone } from "../../../../../lib/control-plane";

function Badge({ status }: { status: string }) {
  return <span className={`badge ${statusTone(status)}`}>{status}</span>;
}

function CountStrip({ counts }: { counts: Record<string, number> }) {
  return <p className="muted tight">{formatCountMap(counts)}</p>;
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel grid compact">
      <div className="section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Lineage({ dashboard }: { dashboard: ControlPlaneDashboard }) {
  return (
    <div className="lineage" aria-label="Governed artifact lineage">
      {dashboard.lineage.map((node, index) => (
        <div className="lineage-step" key={node.key}>
          <div className="lineage-node">
            <strong>{node.label}</strong>
            <Badge status={node.status} />
            <span className="muted">
              {node.version ? `v${node.version}` : compactId(node.artifactId)}
            </span>
          </div>
          {index < dashboard.lineage.length - 1 ? <span className="lineage-arrow">-&gt;</span> : null}
        </div>
      ))}
    </div>
  );
}

function simpleAgentTask(task: string, status: string): string {
  const text = `${task} ${status}`.toLowerCase();
  if (text.includes("approval") || status === "waiting_for_approval") return "Waiting for owner approval";
  if (text.includes("safety") || text.includes("qa") || text.includes("review")) return "Reviewing safety";
  if (text.includes("design")) return "Designing the system";
  if (text.includes("task")) return "Breaking work into tasks";
  if (text.includes("plan") || text.includes("brief")) return "Planning your project";
  if (status === "completed") return "Ready for next step";
  return task;
}

export function ControlPlaneDashboardView({
  dashboard,
  workspaceId,
}: {
  dashboard: ControlPlaneDashboard;
  workspaceId: string;
}) {
  const repoStatus = dashboard.readiness.repoStatus.data;
  const pendingApprovals = dashboard.approvals.filter((approval) => approval.status === "pending");
  const latestExecutionRun = dashboard.executionRuns[0] ?? null;
  const latestWorkforcePlan = dashboard.workforceScalingPlans[0] ?? null;
  const workforceContent = latestWorkforcePlan?.contentJson ?? null;
  const auditStatuses = Array.from(new Set(dashboard.auditEvents.map((event) => event.status))).slice(0, 4);
  const auditActions = Array.from(new Set(dashboard.auditEvents.map((event) => event.action))).slice(0, 4);
  const demoStatus = demoStatusLabel({
    pendingApprovals: pendingApprovals.length,
    latestExecutionStatus: latestExecutionRun?.status ?? null,
    githubDryRunCount: dashboard.githubIssues.filter((issue) => issue.dryRun).length,
  });
  const blockedMessage = readinessMessage({
    executionMode: dashboard.readiness.executionMode,
    repoClean: dashboard.readiness.repoClean,
    protectedBranchWarning: dashboard.readiness.protectedBranchWarning,
    readyForLiveExecution: dashboard.readiness.readyForLiveExecution,
  });

  return (
    <div className="grid">
      <div className="toolbar">
        <div>
          <h1>Control Plane</h1>
          <p className="muted">{dashboard.workspace.name}</p>
        </div>
        <div className="toolbar-actions">
          <Link className="button secondary" href={`/workspaces/${workspaceId}`}>
            Workspace
          </Link>
          <Link className="button secondary" href={`/workspaces/${workspaceId}/approvals`}>
            Approvals
          </Link>
          <Link className="button secondary" href={`/workspaces/${workspaceId}/audit`}>
            Audit
          </Link>
        </div>
      </div>

      <div className="status-grid">
        <div className="metric">
          <span className="muted">Demo Status</span>
          <strong>{demoStatus}</strong>
        </div>
        <div className="metric">
          <span className="muted">Executor</span>
          <Badge status={dashboard.services.executor.status} />
        </div>
        <div className="metric">
          <span className="muted">Repo</span>
          <Badge status={dashboard.readiness.repoClean ? "clean" : "dirty"} />
        </div>
        <div className="metric">
          <span className="muted">Preflight</span>
          <Badge status={dashboard.readiness.latestPreflightStatus} />
        </div>
        <div className="metric">
          <span className="muted">Execution</span>
          <Badge status={dashboard.readiness.readyForLiveExecution ? "ready_for_live_execution" : "not_ready"} />
        </div>
      </div>

      <Section title="Readiness Summary">
        <p className={dashboard.readiness.readyForLiveExecution ? "notice" : "notice bad"}>{blockedMessage}</p>
      </Section>

      <Section title="Lineage">
        <Lineage dashboard={dashboard} />
      </Section>

      <div className="grid two">
        <Section title="Live AI Work Dispatch">
          <CountStrip counts={dashboard.workforceDispatchStatusCounts} />
          <div className="table-list">
            {dashboard.workforceDispatches.slice(0, 10).map((dispatch) => (
              <div className="row" key={dispatch.id}>
                <span>{dispatch.assignedAgentRole}</span>
                <Badge status={dispatch.status} />
                <span className="muted">{dispatch.assignmentReason}</span>
              </div>
            ))}
            {dashboard.workforceDispatches.length === 0 ? <p className="muted">No work has been dispatched yet.</p> : null}
          </div>
        </Section>

        <Section title="Current Team Activity">
          <div className="timeline">
            {dashboard.agentMessages.slice(0, 8).map((message) => (
              <div className="timeline-item" key={message.id}>
                <Badge status={message.messageType} />
                <div>
                  <strong>{message.agentRole}</strong>
                  <p className="tight">{message.message}</p>
                </div>
              </div>
            ))}
            {dashboard.agentMessages.length === 0 ? <p className="muted">No current activity yet.</p> : null}
          </div>
        </Section>
      </div>

      <Section title="Recent Team Handoffs">
        <div className="timeline">
          {dashboard.recentWorkforceHandoffs.slice(0, 8).map((message) => (
            <div className="timeline-item" key={message.id}>
              <Badge status="handoff" />
              <div>
                <strong>{message.agentRole}</strong>
                <p className="tight">{message.message}</p>
              </div>
            </div>
          ))}
          {dashboard.recentWorkforceHandoffs.length === 0 ? <p className="muted">No team handoffs yet.</p> : null}
        </div>
      </Section>

      <div className="grid two">
        <Section title="Client Pipeline">
          <CountStrip counts={dashboard.leadStageCounts} />
          <div className="table-list">
            {dashboard.clients.slice(0, 8).map((client) => (
              <div className="row" key={client.id}>
                <span>{client.name}</span>
                <Badge status={client.status} />
                <span className="muted">{client.company}</span>
              </div>
            ))}
            {dashboard.clients.length === 0 ? <p className="muted">No client profiles yet.</p> : null}
          </div>
        </Section>

        <Section title="Lead Discovery">
          <div className="table-list">
            {dashboard.leads.slice(0, 8).map((lead) => (
              <div className="row" key={lead.id}>
                <span>{lead.title}</span>
                <Badge status={lead.stage} />
                <span className="muted">{lead.needSummary}</span>
              </div>
            ))}
            {dashboard.leads.length === 0 ? <p className="muted">No lead discovery records yet.</p> : null}
          </div>
        </Section>
      </div>

      <div className="grid two">
        <Section title="Client Communication Feed">
          <div className="timeline">
            {dashboard.clientConversations.slice(0, 8).map((conversation) => (
              <div className="timeline-item" key={conversation.id}>
                <Badge status={conversation.visibility} />
                <div>
                  <strong>{conversation.agentRole}</strong>
                  <p className="tight">{conversation.message}</p>
                  <p className="muted tight">
                    {conversation.channel} - {conversation.clientProfile?.name ?? "Client"}
                  </p>
                </div>
              </div>
            ))}
            {dashboard.clientConversations.length === 0 ? <p className="muted">No simulated client updates yet.</p> : null}
          </div>
        </Section>

        <Section title="Meeting Requests">
          <CountStrip counts={dashboard.meetingRequestStatusCounts} />
          <div className="table-list">
            {dashboard.meetingRequests.slice(0, 8).map((request) => (
              <div className="row" key={request.id}>
                <span>{request.purpose}</span>
                <Badge status={request.status} />
                <span className="muted">
                  {request.externalJoinEnabled ? "External join enabled" : "No external joining"}
                </span>
              </div>
            ))}
            {dashboard.meetingRequests.length === 0 ? <p className="muted">No meeting requests yet.</p> : null}
          </div>
        </Section>
      </div>

      <Section title="Sales/Support Script Drafts">
        <div className="table-list">
          {dashboard.clientCommunicationScripts.slice(0, 8).map((artifact) => (
            <Link
              className="row"
              href={`/workspaces/${workspaceId}/artifacts/${artifact.id}`}
              key={artifact.id}
            >
              <span>{artifact.contentJson.targetClient?.company ?? "Client script"}</span>
              <Badge status={artifact.status} />
              <span className="muted">{artifact.contentJson.objective ?? "Waiting for owner review"}</span>
            </Link>
          ))}
          {dashboard.clientCommunicationScripts.length === 0 ? (
            <p className="muted">No sales or support script drafts yet.</p>
          ) : null}
        </div>
      </Section>

      <div className="grid two">
        <Section title="Recommended AI Team Scaling">
          {latestWorkforcePlan && workforceContent ? (
            <div className="grid compact">
              <div className="detail-grid">
                <span>Project size</span>
                <Badge status={workforceContent.projectComplexity ?? "planned"} />
                <span>Plan status</span>
                <Badge status={latestWorkforcePlan.status} />
                <span>Recommended roles</span>
                <strong>{workforceContent.requiredRoles?.length ?? 0}</strong>
              </div>
              <p className="notice">{workforceContent.humanReadableSummary ?? "Revealth has prepared a staffing recommendation for owner review."}</p>
              <div className="table-list">
                {(workforceContent.requiredRoles ?? []).slice(0, 6).map((role) => (
                  <div className="row" key={role.role}>
                    <span>{role.role}</span>
                    <strong>{role.recommendedAgentCount}</strong>
                    <span className="muted">{role.reason}</span>
                  </div>
                ))}
              </div>
              {(workforceContent.expectedBottlenecks ?? []).length > 0 ? (
                <p className="muted tight">Watch next: {workforceContent.expectedBottlenecks?.[0]}</p>
              ) : null}
            </div>
          ) : (
            <p className="muted">No team scaling recommendation yet.</p>
          )}
        </Section>

        <Section title="Activated AI Team">
          <div className="table-list">
            {dashboard.activatedWorkforceAssignments.slice(0, 10).map((assignment) => (
              <div className="row" key={assignment.id}>
                <span>{assignment.role}</span>
                <Badge status={assignment.status} />
                <span className="muted">{simpleAgentTask(assignment.currentTask, assignment.status)}</span>
              </div>
            ))}
            {dashboard.activatedWorkforceAssignments.length === 0 ? (
              <p className="muted">No approved team expansion has been activated yet.</p>
            ) : null}
          </div>
        </Section>
      </div>

      <div className="grid two">

        <Section title="AI Team">
          <div className="status-grid">
            {dashboard.agentAssignments.slice(0, 6).map((assignment) => (
              <div className="metric" key={assignment.id}>
                <span className="muted">{assignment.role}</span>
                <Badge status={assignment.status} />
                <strong>{simpleAgentTask(assignment.currentTask, assignment.status)}</strong>
              </div>
            ))}
            {dashboard.agentAssignments.length === 0 ? <p className="muted">No AI team assignments yet.</p> : null}
          </div>
        </Section>

        <Section title="Who Is Working On What">
          <div className="table-list">
            {dashboard.agentAssignments.slice(0, 8).map((assignment) => (
              <div className="row" key={assignment.id}>
                <span>{assignment.role}</span>
                <Badge status={assignment.status} />
                <span className="muted">{simpleAgentTask(assignment.currentTask, assignment.status)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid two">
        <Section title="Executor Health">
          <div className="detail-grid">
            <span>Current branch</span>
            <strong>{repoStatus?.currentBranch ?? "unavailable"}</strong>
            <span>Clean worktree</span>
            <Badge status={repoStatus?.isClean ? "clean" : "dirty"} />
            <span>Protected branch</span>
            <strong>{dashboard.readiness.protectedBranchWarning ? "warning" : "clear"}</strong>
            <span>Execution mode</span>
            <Badge status={dashboard.readiness.executionMode} />
          </div>
          {dashboard.readiness.protectedBranchWarning ? (
            <p className="notice bad">{dashboard.readiness.protectedBranchWarning}</p>
          ) : null}
          {repoStatus && repoStatus.changedFiles.length > 0 ? (
            <pre className="pre small">{JSON.stringify(repoStatus.changedFiles, null, 2)}</pre>
          ) : null}
        </Section>

        <Section title="Temporal Workflow Status">
          <div className="detail-grid">
            <span>Status</span>
            <Badge status={dashboard.services.temporal.status} />
            <span>Address</span>
            <strong>{dashboard.services.temporal.address}</strong>
            <span>Namespace</span>
            <strong>{dashboard.services.temporal.namespace}</strong>
            <span>Task queue</span>
            <strong>{dashboard.services.temporal.taskQueue}</strong>
          </div>
          <CountStrip counts={dashboard.workflowStatusCounts} />
        </Section>
      </div>

      <div className="grid two">
        <Section title="Workflow Runs">
          <CountStrip counts={dashboard.workflowStatusCounts} />
          <div className="table-list">
            {dashboard.workflowRuns.slice(0, 8).map((run) => (
              <div className="row" key={run.id}>
                <span>{run.workflowType}</span>
                <Badge status={run.status} />
                <span className="muted">{compactId(run.id)}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Artifacts">
          <CountStrip counts={dashboard.artifactStatusCounts} />
          <div className="table-list">
            {dashboard.artifacts.slice(0, 10).map((artifact) => (
              <Link
                className="row"
                href={`/workspaces/${workspaceId}/artifacts/${artifact.id}`}
                key={artifact.id}
              >
                <span>
                  {artifact.artifactType} v{artifact.version}
                </span>
                <Badge status={artifact.status} />
                <span className="muted">{compactId(artifact.id)}</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid two">
        <Section title="Approval Queue">
          <div className="table-list">
            {pendingApprovals.slice(0, 8).map((approval) => (
              <div className="row" key={approval.id}>
                <span>{compactId(approval.artifactId)}</span>
                <Badge status={approval.status} />
                <span className="muted">v{approval.artifactVersion}</span>
              </div>
            ))}
            {pendingApprovals.length === 0 ? <p className="muted">No approvals waiting.</p> : null}
          </div>
        </Section>

        <Section title="Approvals">
          <CountStrip counts={dashboard.approvalStatusCounts} />
          <div className="table-list">
            {dashboard.approvals.slice(0, 8).map((approval) => (
              <div className="row" key={approval.id}>
                <span>{compactId(approval.artifactId)}</span>
                <Badge status={approval.status} />
                <span className="muted">v{approval.artifactVersion}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Execution Runs">
          <CountStrip counts={dashboard.executionRunStatusCounts} />
          <div className="table-list">
            {dashboard.executionRuns.slice(0, 8).map((run) => (
              <div className="row" key={run.id}>
                <span>{run.branchName}</span>
                <Badge status={run.status} />
                <span className="muted">{compactId(run.id)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid two">
        <Section title="Execution Run Inspection">
          {latestExecutionRun ? (
            <div className="detail-grid">
              <span>Status</span>
              <Badge status={latestExecutionRun.status} />
              <span>Branch</span>
              <strong>{latestExecutionRun.branchName}</strong>
              <span>Contract</span>
              <strong>{compactId(latestExecutionRun.contractArtifactId)}</strong>
              <span>Manifest</span>
              <strong>{latestExecutionRun.executionWorkspaceManifestPath ?? "not prepared"}</strong>
              <span>Required tests</span>
              <strong>{latestExecutionRun.requiredTests.length}</strong>
            </div>
          ) : (
            <p className="muted">No execution runs yet.</p>
          )}
        </Section>

        <Section title="Branch Preparation Plans">
          <div className="table-list">
            {dashboard.branchPreparationPlans.slice(0, 8).map((artifact) => (
              <Link
                className="row"
                href={`/workspaces/${workspaceId}/artifacts/${artifact.id}`}
                key={artifact.id}
              >
                <span>{compactId(artifact.id)}</span>
                <Badge status={artifact.status} />
                <span className="muted">v{artifact.version}</span>
              </Link>
            ))}
            {dashboard.branchPreparationPlans.length === 0 ? <p className="muted">No branch plans.</p> : null}
          </div>
        </Section>

        <Section title="Audit Timeline">
          <div className="filter-strip" aria-label="Audit timeline filters">
            {auditStatuses.map((status) => (
              <span className="filter-chip" key={status}>
                status:{status}
              </span>
            ))}
            {auditActions.map((action) => (
              <span className="filter-chip" key={action}>
                action:{action}
              </span>
            ))}
          </div>
          <div className="timeline">
            {dashboard.auditEvents.slice(0, 12).map((event) => (
              <div className="timeline-item" key={event.id}>
                <Badge status={event.status} />
                <div>
                  <strong>{event.action}</strong>
                  <p className="muted tight">
                    {event.actorType}:{event.actorId} - {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid two">
        <Section title="Agent Communication Feed">
          <div className="timeline">
            {dashboard.agentMessages.slice(0, 10).map((message) => (
              <div className="timeline-item" key={message.id}>
                <Badge status={message.messageType} />
                <div>
                  <strong>{message.agentRole}</strong>
                  <p className="tight">{message.message}</p>
                  <p className="muted tight">
                    {message.visibility} - {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {dashboard.agentMessages.length === 0 ? <p className="muted">No team updates yet.</p> : null}
          </div>
        </Section>

        <Section title="Client-visible Updates">
          <div className="timeline">
            {dashboard.clientVisibleAgentMessages.slice(0, 8).map((message) => (
              <div className="timeline-item" key={message.id}>
                <Badge status={message.messageType} />
                <div>
                  <strong>{message.agentRole}</strong>
                  <p className="tight">{message.message}</p>
                </div>
              </div>
            ))}
            {dashboard.clientVisibleAgentMessages.length === 0 ? (
              <p className="muted">No client-visible updates yet.</p>
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}
