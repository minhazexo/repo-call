import type { AnalyzeErrorCode } from "../lib/types";

interface ErrorBannerProps {
  code: AnalyzeErrorCode;
  message: string;
  retryAfterSeconds?: number;
  onRetry: () => void;
}

const COPY: Record<AnalyzeErrorCode, { title: string; hint: string }> = {
  INVALID_URL: {
    title: "Invalid repository URL",
    hint: "Double-check the URL — it must look like https://github.com/owner/repo and point to a public repository.",
  },
  NOT_FOUND: {
    title: "Repository not found",
    hint: "The repository may be private, renamed, or deleted. RepoCall only works with public repositories.",
  },
  RATE_LIMITED: {
    title: "GitHub rate limit reached",
    hint: "Too many requests to the GitHub API. Wait a moment and try again — the backend operator can raise the limit with a GITHUB_TOKEN.",
  },
  GITHUB_ERROR: {
    title: "GitHub lookup failed",
    hint: "GitHub returned an unexpected error. The repository may be temporarily unavailable.",
  },
  BEDROCK_ERROR: {
    title: "AI analysis failed",
    hint: "Repository evidence was collected, but Amazon Bedrock did not return an analysis. Please retry — no data was lost.",
  },
  PAYLOAD_TOO_LARGE: {
    title: "Request too large",
    hint: "The request body exceeded the size limit. Just paste the repository URL, nothing more.",
  },
  BAD_REQUEST: {
    title: "Bad request",
    hint: "Something about the request was malformed. Try pasting the repository URL again.",
  },
  METHOD_NOT_ALLOWED: {
    title: "Method not allowed",
    hint: "This endpoint expects different usage. If you see this in the app, please report it.",
  },
  INTERNAL_ERROR: {
    title: "Something went wrong",
    hint: "An unexpected server error occurred. Please try again in a moment.",
  },
  NETWORK_ERROR: {
    title: "Cannot reach the API",
    hint: "Check your connection and that the API URL is configured (VITE_API_BASE_URL), then retry.",
  },
  TIMEOUT: {
    title: "Analysis timed out",
    hint: "Large repositories can take a while. Please try again — Bedrock analyses typically complete within two minutes.",
  },
};

export default function ErrorBanner({ code, message, retryAfterSeconds, onRetry }: ErrorBannerProps) {
  const copy = COPY[code];
  return (
    <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-red-300">{copy.title}</h3>
          <p className="mt-1 text-sm text-slate-300">{message}</p>
          <p className="mt-1 text-sm text-slate-400">{copy.hint}</p>
          {typeof retryAfterSeconds === "number" && (
            <p className="mt-1 font-mono text-xs text-slate-400">
              Suggested retry in ~{retryAfterSeconds}s
            </p>
          )}
          <p className="mt-2 font-mono text-xs text-slate-500">error_code: {code}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-red-400/50 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
