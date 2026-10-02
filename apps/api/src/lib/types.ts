/**
 * Shared API contract types for RepoCall.
 * The frontend mirrors these types (see apps/web/src/lib/types.ts).
 * Keep both sides in sync when changing this file.
 */

export type EvidenceSourceType = "commit" | "issue" | "readme" | "file" | "metadata";

export interface EvidenceItem {
  /** The conclusion this evidence supports. */
  claim: string;
  sourceType: EvidenceSourceType;
  /** Human-readable title, e.g. commit message or issue title. */
  sourceTitle: string;
  /** MUST be a real GitHub URL from the backend-supplied allowlist. */
  sourceUrl: string;
}

export interface Blocker {
  title: string;
  detail: string;
}

export interface Risk {
  title: string;
  detail: string;
}

export interface NextAction {
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface AnalysisResult {
  projectGoal: string;
  currentState: string;
  completedWork: string[];
  stoppedAt: string;
  blockers: Blocker[];
  risks: Risk[];
  nextActions: NextAction[];
  resumeBriefing: string;
  evidence: EvidenceItem[];
}

export interface RepositoryOverview {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  lastPush: string | null;
  createdAt: string | null;
}

export interface AnalyzeSuccessResponse {
  success: true;
  repository: RepositoryOverview;
  analysis: AnalysisResult;
  meta: {
    model: string;
    evidenceSources: number;
    truncated: boolean;
    note?: string;
  };
}

export interface AnalyzeErrorResponse {
  success: false;
  error: {
    code:
      | "INVALID_URL"
      | "NOT_FOUND"
      | "RATE_LIMITED"
      | "GITHUB_ERROR"
      | "BEDROCK_ERROR"
      | "PAYLOAD_TOO_LARGE"
      | "BAD_REQUEST"
      | "METHOD_NOT_ALLOWED"
      | "INTERNAL_ERROR";
    message: string;
    /** Seconds to wait before retrying (RATE_LIMITED only). */
    retryAfterSeconds?: number;
  };
}
