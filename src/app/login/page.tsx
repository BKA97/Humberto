export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-lg font-semibold">Market Reaction Lab</h1>
        <p className="mb-6 text-center text-sm text-(--color-foreground-muted)">
          A private research journal. Enter your access password.
        </p>
        <form action="/api/auth" method="POST" className="card space-y-3">
          <input type="hidden" name="next" value={next ?? "/"} />
          <input
            type="password"
            name="password"
            autoFocus
            placeholder="Password"
            className="input"
            required
          />
          {error && <p className="text-sm" style={{ color: "var(--negative)" }}>Incorrect password.</p>}
          <button type="submit" className="btn-primary w-full">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
