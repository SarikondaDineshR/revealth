import Link from "next/link";
import { api } from "../../../lib/api-client";
import { createWorkspaceAction } from "./actions";

export default async function WorkspacesPage() {
  const workspaces = await api.listWorkspaces().catch(() => []);

  return (
    <div className="grid">
      <div className="toolbar">
        <div>
          <h1>Workspaces</h1>
          <p className="muted">Create and review governed software planning workspaces.</p>
        </div>
      </div>
      <form action={createWorkspaceAction} className="panel grid">
        <label className="label">
          New workspace
          <input className="input" name="name" placeholder="Revealth Internal Prototype" required />
        </label>
        <button className="button" type="submit">
          Create workspace
        </button>
      </form>
      <section className="grid">
        {workspaces.map((workspace) => (
          <Link className="panel" href={`/workspaces/${workspace.id}`} key={workspace.id}>
            <strong>{workspace.name}</strong>
            <div className="muted">Status: {workspace.status}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

