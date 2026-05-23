import { api } from "../../../../../lib/api-client";
import { decideApprovalAction } from "../../actions";

export default async function ApprovalsPage({ params }: { params: { workspaceId: string } }) {
  const approvals = await api.listApprovals(params.workspaceId).catch(() => []);

  return (
    <div className="grid">
      <div>
        <h1>Approval Panel</h1>
        <p className="muted">Controlled decisions for planning artifacts and downstream actions.</p>
      </div>
      <section className="grid">
        {approvals.map((approval) => {
          const approve = decideApprovalAction.bind(null, params.workspaceId, approval.id, "approved");
          const reject = decideApprovalAction.bind(null, params.workspaceId, approval.id, "rejected");
          const revise = decideApprovalAction.bind(
            null,
            params.workspaceId,
            approval.id,
            "revision_requested",
          );
          const isPending = approval.status === "pending";

          return (
            <article className="panel grid" key={approval.id}>
              <div>
                <strong>{approval.status}</strong>
                <div className="muted">
                  Artifact {approval.artifactId} v{approval.artifactVersion}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <form action={approve}>
                  <button className="button" type="submit" disabled={!isPending}>
                    Approve
                  </button>
                </form>
                <form action={revise}>
                  <button className="button secondary" type="submit" disabled={!isPending}>
                    Request revision
                  </button>
                </form>
                <form action={reject}>
                  <button className="button danger" type="submit" disabled={!isPending}>
                    Reject
                  </button>
                </form>
              </div>
            </article>
          );
        })}
        {approvals.length === 0 ? <p className="muted">No approvals yet.</p> : null}
      </section>
    </div>
  );
}

