import { useCallback, useEffect, useState } from "react";
import UrlForm from "./components/UrlForm";
import Dashboard from "./components/Dashboard";
import Skeleton from "./components/Skeleton";
import ErrorBanner from "./components/ErrorBanner";
import { analyzeRepository } from "./lib/api";
import { AnalyzeError, type AnalyzeSuccess } from "./lib/types";
import { clearLastAnalysis, loadLastAnalysis, saveLastAnalysis } from "./lib/storage";

type Status = "idle" | "loading" | "success" | "error";

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalyzeSuccess | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState("");
  const [inputSeed, setInputSeed] = useState("");
  const [error, setError] = useState<AnalyzeError | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [restored, setRestored] = useState(false);

  // Restore the latest successful analysis from localStorage on first load.
  useEffect(() => {
    const stored = loadLastAnalysis();
    if (stored) {
      setResult(stored.data);
      setAnalyzedUrl(stored.url);
      setInputSeed(stored.url);
      setSavedAt(stored.savedAt);
      setStatus("success");
    }
    setRestored(true);
  }, []);

  const runAnalysis = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("loading");
    setError(null);
    setAnalyzedUrl(trimmed);
    try {
      const data = await analyzeRepository(trimmed);
      setResult(data);
      setSavedAt(new Date().toISOString());
      saveLastAnalysis(trimmed, data);
      setStatus("success");
    } catch (err) {
      const analyzeError =
        err instanceof AnalyzeError
          ? err
          : new AnalyzeError("INTERNAL_ERROR", "An unexpected error occurred. Please try again.");
      setError(analyzeError);
      setStatus("error");
    }
  }, []);

  const handleAnalyzeAgain = useCallback(() => {
    setResult(null);
    setError(null);
    setStatus("idle");
    setInputSeed(analyzedUrl);
  }, [analyzedUrl]);

  const handleClearSaved = useCallback(() => {
    clearLastAnalysis();
    setResult(null);
    setError(null);
    setSavedAt(undefined);
    setStatus("idle");
    setInputSeed("");
  }, []);

  if (!restored) return null;

  const showLanding = status === "idle" && !result;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-ink-700/60 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 font-mono text-lg font-bold text-ink-950">
              R
            </span>
            <div>
              <p className="font-bold leading-none text-slate-100">RepoCall</p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">context recovery agent</p>
            </div>
          </div>
          <a
            href="https://github.com/minhazexo/repo-call"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-ink-700 px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:border-accent-500/60 hover:text-accent-400"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        {showLanding ? (
          <div className="relative">
            <div className="hero-grid absolute inset-0 -z-10" />
            <div className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
              <p className="inline-block rounded-full border border-accent-500/40 bg-accent-500/10 px-4 py-1 font-mono text-xs text-accent-400">
                ● powered by Amazon Bedrock
              </p>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-50 sm:text-6xl">
                RepoCall
              </h1>
              <p className="mt-3 text-xl text-slate-300 sm:text-2xl">
                Remember where your code left off.
              </p>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Recover the context behind unfinished projects in minutes.
              </p>
              <div className="mt-8 text-left">
                <UrlForm initialUrl={inputSeed} loading={false} onSubmit={runAnalysis} />
              </div>
              <div className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
                {[
                  ["01", "Commits", "Where work actually stopped"],
                  ["02", "Issues", "What's blocking progress"],
                  ["03", "Bedrock", "Grounded next actions"],
                ].map(([n, title, desc]) => (
                  <div key={n} className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
                    <p className="font-mono text-xs text-accent-500">{n}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-8">
            {/* Compact recovery bar once past the landing page */}
            <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-5">
              <UrlForm
                key={status === "idle" ? `idle-${inputSeed}` : "active"}
                initialUrl={status === "idle" ? inputSeed : analyzedUrl}
                loading={status === "loading"}
                onSubmit={runAnalysis}
              />
            </div>

            {status === "loading" && <Skeleton />}

            {status === "error" && error && (
              <div className="mt-6">
                <ErrorBanner
                  code={error.code}
                  message={error.message}
                  retryAfterSeconds={error.retryAfterSeconds}
                  onRetry={() => runAnalysis(analyzedUrl)}
                />
              </div>
            )}

            {status === "success" && result && (
              <Dashboard
                result={result}
                analyzedUrl={analyzedUrl}
                savedAt={savedAt}
                onAnalyzeAgain={handleAnalyzeAgain}
                onClearSaved={handleClearSaved}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-ink-700/60 py-6">
        <p className="mx-auto max-w-6xl px-5 font-mono text-xs text-slate-600">
          RepoCall · AWS Zero to Shipped · Amazon Bedrock context recovery · conclusions are grounded in
          linked GitHub evidence
        </p>
      </footer>
    </div>
  );
}
