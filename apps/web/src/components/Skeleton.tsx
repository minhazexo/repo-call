function Bar({ width, className = "" }: { width: string; className?: string }) {
  return <div className={`skeleton-bar rounded bg-ink-700 ${className}`} style={{ width }} />;
}

export default function Skeleton() {
  return (
    <div className="mt-10 space-y-6" aria-label="Loading analysis" role="status">
      <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
        <Bar width="40%" className="h-6" />
        <div className="mt-4 flex flex-wrap gap-2">
          {[80, 64, 96, 72].map((w, i) => (
            <Bar key={i} width={`${w}px`} className="h-6 rounded-full" />
          ))}
        </div>
        <Bar width="90%" className="mt-4 h-4" />
        <Bar width="70%" className="mt-2 h-4" />
      </div>
      {[1, 2, 3].map((card) => (
        <div key={card} className="rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
          <Bar width="30%" className="h-5" />
          <Bar width="95%" className="mt-4 h-4" />
          <Bar width="85%" className="mt-2 h-4" />
          <Bar width="60%" className="mt-2 h-4" />
        </div>
      ))}
      <p className="text-center font-mono text-xs text-slate-500">
        Collecting commits, issues and source files… asking Bedrock to reconstruct context…
      </p>
    </div>
  );
}
