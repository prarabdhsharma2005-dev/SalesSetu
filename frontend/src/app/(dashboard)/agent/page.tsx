export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-1)]">AI Sales Agent</h2>
        <p className="text-sm text-[var(--color-text-3)] mt-1">Your AI-powered sales copilot</p>
      </div>
      <div className="flex items-center justify-center h-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl border-dashed">
        <p className="text-[var(--color-text-4)] text-sm">🚧 Building AI Sales Agent...</p>
      </div>
    </div>
  )
}
