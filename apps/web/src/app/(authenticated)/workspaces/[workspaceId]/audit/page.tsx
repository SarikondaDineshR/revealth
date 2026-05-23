import { api } from "../../../../../lib/api-client";

export default async function AuditPage({ params }: { params: { workspaceId: string } }) {
  const events = await api.listAuditEvents(params.workspaceId).catch(() => []);
  return (
    <div className="grid">
      <div>
        <h1>Audit Timeline</h1>
        <p className="muted">Append-only operational events for this workspace.</p>
      </div>
      <section className="grid">
        {events.map((event) => (
          <article className="panel" key={event.id}>
            <strong>{event.action}</strong>
            <div className="muted">
              {event.actorType}:{event.actorId} · {event.status} · {new Date(event.createdAt).toLocaleString()}
            </div>
            <pre className="pre">{JSON.stringify(event.eventJson, null, 2)}</pre>
          </article>
        ))}
        {events.length === 0 ? <p className="muted">No audit events recorded.</p> : null}
      </section>
    </div>
  );
}

