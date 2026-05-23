import { api } from "../../../../../../lib/api-client";
import { createApprovalAction } from "../../../actions";

export default async function ArtifactPage({
  params,
}: {
  params: { workspaceId: string; artifactId: string };
}) {
  const artifact = await api.getArtifact(params.workspaceId, params.artifactId);
  const createApproval = createApprovalAction.bind(
    null,
    params.workspaceId,
    artifact.id,
    artifact.version,
  );

  return (
    <div className="grid">
      <div>
        <h1>{artifact.artifactType}</h1>
        <p className="muted">
          Version {artifact.version} · {artifact.status} · {artifact.schemaVersion}
        </p>
      </div>
      <section className="panel grid">
        <form action={createApproval}>
          <button className="button" type="submit" disabled={artifact.status !== "draft"}>
            Submit for approval
          </button>
        </form>
        <pre className="pre">{JSON.stringify(artifact.contentJson, null, 2)}</pre>
      </section>
    </div>
  );
}

