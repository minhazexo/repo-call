import { AnalyzeError, type AnalyzeErrorCode, type AnalyzeSuccess } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "";

/** Client-side pre-validation so obvious typos fail fast (server re-validates). */
export function isPlausibleGitHubUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;
    return url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

function mapStatusToCode(status: number, bodyCode?: string): AnalyzeErrorCode {
  if (bodyCode) {
    const known: AnalyzeErrorCode[] = [
      "INVALID_URL",
      "NOT_FOUND",
      "RATE_LIMITED",
      "GITHUB_ERROR",
      "BEDROCK_ERROR",
      "PAYLOAD_TOO_LARGE",
      "BAD_REQUEST",
      "METHOD_NOT_ALLOWED",
      "INTERNAL_ERROR",
    ];
    if ((known as string[]).includes(bodyCode)) return bodyCode as AnalyzeErrorCode;
  }
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  return "GITHUB_ERROR";
}

/**
 * POST /analyze with a generous timeout (Bedrock + GitHub collection is slow).
 */
export async function analyzeRepository(repositoryUrl: string, timeoutMs = 120_000): Promise<AnalyzeSuccess> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: repositoryUrl.trim() }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AnalyzeError("TIMEOUT", "The analysis timed out. The repository may be large — please try again.");
      }
      throw new AnalyzeError(
        "NETWORK_ERROR",
        "Could not reach the RepoCall API. Check your connection and that VITE_API_BASE_URL is set.",
      );
    }

    const payload = (await res.json().catch(() => null)) as {
      success?: boolean;
      error?: { code?: string; message?: string; retryAfterSeconds?: number };
    } | null;

    if (res.ok && payload && payload.success) {
      return payload as AnalyzeSuccess;
    }

    const code = mapStatusToCode(res.status, payload?.error?.code);
    const message =
      payload?.error?.message ||
      (res.status === 404
        ? "Repository not found. Check the URL — it must be a public repository."
        : "Analysis failed. Please try again.");
    throw new AnalyzeError(code, message, payload?.error?.retryAfterSeconds);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(timeoutMs = 10_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
