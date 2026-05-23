"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="main">
      <section className="panel grid">
        <h1>Something failed</h1>
        <p className="muted">{error.message}</p>
        <button className="button secondary" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}

