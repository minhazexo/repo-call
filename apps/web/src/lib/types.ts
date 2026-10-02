/**
 * Frontend mirror of the API contract (apps/api/src/lib/types.ts).
 * Keep both sides in sync.
 */

export type EvidenceSourceType = "commit" | "issue" | "readme" | "file" | "metadata";

export interface EvidenceItem {
  claim: string;
  sourceType: EvidenceSourceType;
  sourceTitle: string;
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

export interface AnalyzeSuccess {
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

export type AnalyzeErrorCode =
  | "INVALID_URL"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "GITHUB_ERROR"
  | "BEDROCK_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "BAD_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT";

export class AnalyzeError extends Error {
  constructor(
    readonly code: AnalyzeErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AnalyzeError";
  }
}
