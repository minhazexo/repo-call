import { useState } from "react";
import { isPlausibleGitHubUrl } from "../lib/api";

interface UrlFormProps {
  initialUrl: string;
  loading: boolean;
  onSubmit: (url: string) => void;
}

const QUICK_TRIES = [
  "https://github.com/axios/axios",
  "https://github.com/vercel/swr",
  "https://github.com/sveltejs/kit",
];

export default function UrlForm({ initialUrl, loading, onSubmit }: UrlFormProps) {
  const [url, setUrl] = useState(initialUrl);
  const [touched, setTouched] = useState(false);
  const showHint = touched && url.trim().length > 0 && !isPlausibleGitHubUrl(url);

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (url.trim()) onSubmit(url);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-accent-500">
            {">"}
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="https://github.com/owner/repository"
            spellCheck={false}
            autoComplete="off"
            disabled={loading}
            aria-label="Public GitHub repository URL"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 py-3.5 pl-9 pr-4 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={loading || url.trim().length === 0}
          className="rounded-xl bg-accent-500 px-7 py-3.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Recovering…" : "Recover Context"}
        </button>
      </form>

      {showHint ? (
        <p className="mt-2 text-sm text-amber-300">
          That doesn&apos;t look like a public GitHub repository URL. Expected format:{" "}
          <span className="font-mono">https://github.com/owner/repo</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          RepoCall analyzes public repository activity and reconstructs your current development context.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Try:</span>
        {QUICK_TRIES.map((repo) => (
          <button
            key={repo}
            type="button"
            disabled={loading}
            onClick={() => {
              setUrl(repo);
              onSubmit(repo);
            }}
            className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5 font-mono text-slate-300 transition hover:border-accent-500/60 hover:text-accent-400 disabled:opacity-50"
          >
            {repo.replace("https://github.com/", "")}
          </button>
        ))}
      </div>
    </div>
  );
}
