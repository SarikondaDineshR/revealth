export default function SettingsPage() {
  return (
    <div className="grid">
      <h1>Settings</h1>
      <section className="panel">
        <h2>Local prototype identity</h2>
        <p className="muted">
          The bootstrap uses a seeded local founder identity for development. Production identity should use a managed auth provider before external access.
        </p>
      </section>
    </div>
  );
}

