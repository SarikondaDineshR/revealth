import Link from "next/link";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Revealth</div>
        <nav className="nav" aria-label="Primary">
          <Link href="/workspaces">Workspaces</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
