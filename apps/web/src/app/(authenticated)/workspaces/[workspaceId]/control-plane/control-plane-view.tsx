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
    </div>
  );
}
