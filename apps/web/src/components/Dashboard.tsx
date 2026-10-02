import type {
  AnalyzeSuccess,
  EvidenceItem,
  EvidenceSourceType,
  NextAction,
} from "../lib/types";

interface DashboardProps {
  result: AnalyzeSuccess;
  analyzedUrl: string;
  onAnalyzeAgain: () => void;
  onClearSaved: () => void;
  savedAt?: string;
}

function Section({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent-500">{kicker}</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-100">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Insufficient({ label = "Insufficient evidence" }: { label?: string }) {
  return (
    <p className="rounded-lg border border-dashed border-ink-700 bg-ink-950/60 px-3 py-2 text-sm italic text-slate-500">
      {label} — the repository didn&apos;t contain enough signal for this section.
    </p>
  );
}

function isInsufficient(text: string): boolean {
  return text.trim().toLowerCase() === "insufficient evidence";
}

function Prose({ text }: { text: string }) {
  if (isInsufficient(text)) return <Insufficient />;
  return <p className="text-sm leading-relaxed text-slate-300">{text}</p>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const SOURCE_BADGES: Record<EvidenceSourceType, string> = {
  commit: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  issue: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  readme: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  file: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  metadata: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-xl border border-ink-700 bg-ink-950/60 p-4 transition hover:border-accent-500/50"
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${SOURCE_BADGES[item.sourceType]}`}
        >
          {item.sourceType}
        </span>
        <span className="truncate font-mono text-xs text-slate-400" title={item.sourceTitle}>
          {item.sourceTitle}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{item.claim}</p>
      <p className="mt-2 truncate font-mono text-xs text-accent-500/80 group-hover:text-accent-400">
        {item.sourceUrl} ↗
      </p>
    </a>
  );
}

const PRIORITY_STYLES: Record<NextAction["priority"], string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  low: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

export default function Dashboard({ result, analyzedUrl, onAnalyzeAgain, onClearSaved, savedAt }: DashboardProps) {
  const { repository: repo, analysis, meta } = result;

  return (
    <div className="mt-10 space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-slate-500">
          Recovered from <span className="text-slate-300">{analyzedUrl}</span>
          {savedAt && <span> · saved {formatDate(savedAt)}</span>} · model{" "}
          <span className="text-accent-400">{meta.model}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAnalyzeAgain}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-400"
          >
            Analyze Again
          </button>
          <button
            type="button"
            onClick={onClearSaved}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500"
          >
            Clear saved
          </button>
        </div>
      </div>

      {meta.note && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          {meta.note}
        </div>
      )}

      {/* Project overview */}
      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/60">
        <div className="border-b border-ink-700 bg-ink-950/50 px-6 py-4">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-500">Project overview</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="text-xl font-bold text-slate-100 hover:text-accent-400"
            >
              {repo.fullName} ↗
            </a>
            {repo.language && (
              <span className="rounded-full border border-ink-700 bg-ink-950 px-3 py-0.5 font-mono text-xs text-slate-300">
                {repo.language}
              </span>
            )}
          </div>
          {repo.description && <p className="mt-2 text-sm text-slate-400">{repo.description}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-px bg-ink-700 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Stars", repo.stars.toLocaleString()],
            ["Forks", repo.forks.toLocaleString()],
            ["Open issues", repo.openIssues.toLocaleString()],
            ["Default branch", repo.defaultBranch],
            ["Last push", formatDate(repo.lastPush)],
            ["Created", formatDate(repo.createdAt)],
          ].map(([label, value]) => (
            <div key={label} className="bg-ink-900/80 px-5 py-4">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-1 truncate font-mono text-sm text-slate-100" title={String(value)}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Resume briefing first — the developer's 5-minute catch-up */}
      <section className="rounded-2xl border border-accent-500/40 bg-gradient-to-br from-accent-500/10 to-transparent p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-500">Resume in 5 minutes</p>
        <div className="mt-2 text-[15px] leading-relaxed text-slate-100">
          <Prose text={analysis.resumeBriefing} />
        </div>
      </section>

      {/* Context recovery */}
      <Section title="Context recovery" kicker="What you were doing">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400">Project goal</h3>
            <div className="mt-2">
              <Prose text={analysis.projectGoal} />
            </div>
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400">Current state</h3>
            <div className="mt-2">
              <Prose text={analysis.currentState} />
            </div>
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400">Completed work</h3>
            {analysis.completedWork.length === 0 ? (
              <div className="mt-2">
                <Insufficient />
              </div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {analysis.completedWork.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="font-mono text-accent-500">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400">Where you stopped</h3>
            <div className="mt-2">
              <Prose text={analysis.stoppedAt} />
            </div>
          </div>
        </div>
      </Section>

      {/* Blockers + risks */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Blockers" kicker="What's in the way">
          {analysis.blockers.length === 0 ? (
            <Insufficient label="No clear blockers in the available evidence" />
          ) : (
            <ul className="space-y-3">
              {analysis.blockers.map((b, i) => (
                <li key={i} className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                  <p className="text-sm font-semibold text-red-200">{b.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{b.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Technical risks" kicker="Evidence-backed only">
          {analysis.risks.length === 0 ? (
            <Insufficient label="No risks visible in the available evidence" />
          ) : (
            <ul className="space-y-3">
              {analysis.risks.map((r, i) => (
                <li key={i} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <p className="text-sm font-semibold text-amber-200">{r.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{r.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Next actions */}
      <Section title="Next 3 actions" kicker="What to do next">
        {analysis.nextActions.length === 0 ? (
          <Insufficient label="Not enough evidence to recommend next actions" />
        ) : (
          <ol className="space-y-3">
            {analysis.nextActions.map((action, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-950/60 p-4 sm:flex-row sm:items-start"
              >
                <span className="font-mono text-2xl text-accent-500/70">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-100">{action.title}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${PRIORITY_STYLES[action.priority]}`}
                    >
                      {action.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{action.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Evidence */}
      <Section
        title={`Evidence (${analysis.evidence.length})`}
        kicker="Grounded in real sources"
      >
        <p className="mb-4 text-sm text-slate-400">
          Every conclusion above traces back to one of these GitHub sources. Each card links to the
          real commit, issue, file, or README section.
        </p>
        {analysis.evidence.length === 0 ? (
          <Insufficient label="The model cited no evidence — treat the conclusions above with caution" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.evidence.map((item, i) => (
              <EvidenceCard key={i} item={item} />
            ))}
          </div>
        )}
      </Section>

      <p className="text-center font-mono text-xs text-slate-600">
        Generated with Amazon Bedrock ({meta.model}) · grounded in {meta.evidenceSources} repository
        sources{meta.truncated ? " · context truncated to fit" : ""}
      </p>
    </div>
  );
}
