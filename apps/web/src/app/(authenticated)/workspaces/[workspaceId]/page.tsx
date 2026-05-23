import Link from "next/link";
import { api } from "../../../../lib/api-client";
import { startIntakeAction } from "../actions";

export default async function WorkspacePage({ params }: { params: { workspaceId: string } }) {
  const [artifacts, auditEvents] = await Promise.all([
    api.listArtifacts(params.workspaceId).catch(() => []),
    api.listAuditEvents(params.workspaceId).catch(() => []),
  ]);
  const startIntake = startIntakeAction.bind(null, params.workspaceId);

  return (
    <div className="grid">
      <div className="toolbar">
        <div>
          <h1>Workspace Dashboard</h1>
          <p className="muted">{params.workspaceId}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="button secondary" href={`/workspaces/${params.workspaceId}/approvals`}>
            Approvals
          </Link>
          <Link className="button secondary" href={`/workspaces/${params.workspaceId}/audit`}>
            Audit timeline
          </Link>
        </div>
      </div>

      <form action={startIntake} className="panel grid">
        <label className="label">
          Project idea intake
          <textarea
            className="textarea"
            name="rawProjectIdea"
            required
            placeholder="Describe the software company, product, users, and constraints."
          />
        </label>
        <button className="button" type="submit">
          Start intake workflow
        </button>
      </form>

      <div className="grid two">
        <section className="panel">
          <h2>Artifacts</h2>
          <div className="grid">
            {artifacts.map((artifact) => (
              <Link
                href={`/workspaces/${params.workspaceId}/artifacts/${artifact.id}`}
                key={artifact.id}
              >
                {artifact.artifactType} v{artifact.version} · {artifact.status}
              </Link>
            ))}
            {artifacts.length === 0 ? <p className="muted">No artifacts yet.</p> : null}
          </div>
        </section>

        <section className="panel">
          <h2>Recent audit</h2>
          <div className="grid">
            {auditEvents.slice(0, 8).map((event) => (
              <div key={event.id}>
                <strong>{event.action}</strong>
                <div className="muted">{event.status}</div>
              </div>
            ))}
            {auditEvents.length === 0 ? <p className="muted">No audit events yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
