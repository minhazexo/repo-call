/**
 * RepoCall API entrypoint: Lambda handler + shared request router.
 *
 * Routes:
 *   GET  /health   -> { status: "ok" }
 *   POST /analyze  -> { success: true, repository, analysis, meta }
 *
 * Works behind API Gateway HTTP API (payload v2), REST API (v1),
 * and the local dev server (see src/dev.ts).
 */

import type { AnalyzeErrorResponse, AnalyzeSuccessResponse } from "./lib/types.js";
import { parseRepositoryUrl, ValidationError } from "./lib/validate.js";
import { collectRepositoryEvidence, GitHubError } from "./lib/github.js";
import {
  bedrockConfigFromEnv,
  BedrockError,
  buildHeuristicAnalysis,
  invokeContextRecovery,
} from "./lib/bedrock.js";
import { GitHubError as GitHubErrorClass } from "./lib/github.js";

const MAX_BODY_CHARS = 10_000;

type ErrorCode = AnalyzeErrorResponse["error"]["code"];

export interface RouterRequest {
  method: string;
  path: string;
  bodyText?: string | null;
  origin?: string;
}

export interface RouterResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function allowedOrigin(requestOrigin: string | undefined): string {
  const configured = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
  if (configured.includes("*") || configured.length === 0) return "*";
  if (requestOrigin && configured.includes(requestOrigin)) return requestOrigin;
  return configured[0];
}

function corsHeaders(req: RouterRequest): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req.origin),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(req: RouterRequest, statusCode: number, payload: unknown, extraHeaders: Record<string, string> = {}): RouterResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders(req), ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

function errorBody(code: ErrorCode, message: string, retryAfterSeconds?: number): AnalyzeErrorResponse {
  return {
    success: false,
    error: retryAfterSeconds !== undefined ? { code, message, retryAfterSeconds } : { code, message },
  };
}

/** Match /health and /analyze with or without an API Gateway stage prefix. */
export function normalizeRoute(path: string): "health" | "analyze" | null {
  const clean = (path || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/health" || clean.endsWith("/health")) return "health";
  if (clean === "/analyze" || clean.endsWith("/analyze")) return "analyze";
  return null;
}

export async function handleRequest(req: RouterRequest): Promise<RouterResponse> {
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(req), body: "" };
  }

  const route = normalizeRoute(req.path);

  if (method === "GET" && route === "health") {
    return json(req, 200, { status: "ok" });
  }

  if (route === "analyze") {
    if (method !== "POST") {
      return json(req, 405, errorBody("METHOD_NOT_ALLOWED", "Use POST /analyze with a JSON body."));
    }

    const bodyText = req.bodyText ?? "";
    if (bodyText.length > MAX_BODY_CHARS) {
      return json(req, 413, errorBody("PAYLOAD_TOO_LARGE", "Request body is too large."));
    }

    let parsed: unknown;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      return json(req, 400, errorBody("BAD_REQUEST", "Request body must be valid JSON."));
    }
    const repositoryUrl = (parsed as Record<string, unknown>).repositoryUrl;

    try {
      const target = parseRepositoryUrl(repositoryUrl);
      const evidence = await collectRepositoryEvidence(target.owner, target.repo);

      let analysis: AnalyzeSuccessResponse["analysis"];
      let modelUsed: string;
      let note: string | undefined;
      try {
        const result = await invokeContextRecovery(evidence, bedrockConfigFromEnv());
        analysis = result.analysis;
        modelUsed = result.modelUsed;
      } catch (bedrockErr) {
        // Local-development escape hatch only. Production keeps this disabled
        // so failures surface as honest BEDROCK_ERRORs instead of fake AI output.
        if (process.env.ENABLE_HEURISTIC_FALLBACK === "true") {
          const fallback = buildHeuristicAnalysis(evidence);
          analysis = fallback.analysis;
          modelUsed = "heuristic-fallback";
          note = fallback.note;
        } else {
          throw bedrockErr;
        }
      }

      const payload: AnalyzeSuccessResponse = {
        success: true,
        repository: {
          owner: evidence.repository.owner,
          name: evidence.repository.name,
          fullName: evidence.repository.fullName,
          url: evidence.repository.url,
          description: evidence.repository.description,
          language: evidence.repository.language,
          stars: evidence.repository.stars,
          forks: evidence.repository.forks,
          openIssues: evidence.repository.openIssues,
          defaultBranch: evidence.repository.defaultBranch,
          lastPush: evidence.repository.lastPush,
          createdAt: evidence.repository.createdAt,
        },
        analysis,
        meta: {
          model: modelUsed!,
          evidenceSources: evidence.evidenceSources.length,
          truncated: evidence.truncated,
          ...(note ? { note } : {}),
        },
      };
      return json(req, 200, payload);
    } catch (err) {
      if (err instanceof ValidationError) {
        return json(req, err.statusCode, errorBody("INVALID_URL", err.message));
      }
      if (err instanceof GitHubErrorClass) {
        const code = err.code === "NOT_FOUND" ? "NOT_FOUND" : err.code === "RATE_LIMITED" ? "RATE_LIMITED" : "GITHUB_ERROR";
        const extra = err.retryAfterSeconds !== undefined ? { Retry_After: String(err.retryAfterSeconds) } : {};
        void extra;
        return json(
          req,
          err.statusCode,
          errorBody(code, err.message, err.retryAfterSeconds),
          err.retryAfterSeconds !== undefined ? { "Retry-After": String(err.retryAfterSeconds) } : {},
        );
      }
      if (err instanceof BedrockError) {
        return json(req, err.statusCode, errorBody("BEDROCK_ERROR", err.message));
      }
      // Never leak stack traces or env details to the client.
      console.error("Unhandled /analyze error:", err instanceof Error ? err.message : err);
      return json(req, 500, errorBody("INTERNAL_ERROR", "Something went wrong. Please try again."));
    }
  }

  return json(req, 404, errorBody("BAD_REQUEST", "Unknown route. Use GET /health or POST /analyze."));
}

// Keep the GitHubError import referenced for tree-shaking-safe bundling.
void GitHubError;

/* ------------------------------------------------------------------ */
/* Lambda handler (API Gateway HTTP API v2, REST v1, Function URL)     */
/* ------------------------------------------------------------------ */

interface LambdaEvent {
  version?: string;
  rawPath?: string;
  path?: string;
  httpMethod?: string;
  requestContext?: { http?: { method?: string; path?: string } };
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

function headerValue(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value ?? undefined;
  }
  return undefined;
}

export async function handler(event: LambdaEvent): Promise<RouterResponse> {
  const method =
    event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path =
    event.requestContext?.http?.path ?? event.rawPath ?? event.path ?? "/";
  let bodyText = event.body ?? null;
  if (bodyText && event.isBase64Encoded) {
    bodyText = Buffer.from(bodyText, "base64").toString("utf-8");
  }
  return handleRequest({
    method,
    path,
    bodyText,
    origin: headerValue(event.headers, "origin"),
  });
}
