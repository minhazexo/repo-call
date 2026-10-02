/**
 * GitHub REST API collector.
 *
 * Builds a bounded "evidence package" for the Bedrock context-recovery agent.
 * - Uses only public endpoints, no code is ever executed.
 * - Caps commits / issues / files / bytes so the Bedrock context stays small.
 * - Produces a controlled evidence-source allowlist the model MUST cite from
 *   (anti-hallucination: the model never invents evidence URLs).
 */

import type { EvidenceSourceType } from "./types.js";

/** Machine-readable upstream failure. The router maps these to HTTP status codes. */
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "RATE_LIMITED" | "GITHUB_ERROR",
    readonly statusCode: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface CommitEvidence {
  sha: string;
  shortSha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}

export interface IssueEvidence {
  number: number;
  title: string;
  bodySnippet: string;
  labels: string[];
  state: string;
  comments: number;
  createdAt: string | null;
  updatedAt: string | null;
  url: string;
}

export interface BranchEvidence {
  name: string;
  protected: boolean;
}

export interface FileEvidence {
  path: string;
  size: number;
  truncated: boolean;
  content: string;
}

export interface RepoMetadata {
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
  topics: string[];
  license: string | null;
}

export interface EvidenceSource {
  sourceType: EvidenceSourceType;
  sourceTitle: string;
  sourceUrl: string;
}

export interface EvidencePackage {
  repository: RepoMetadata;
  readme: { length: number; truncated: boolean; content: string } | null;
  commits: CommitEvidence[];
  issues: IssueEvidence[];
  branches: BranchEvidence[];
  files: FileEvidence[];
  /** Controlled allowlist of citable sources. The model may ONLY cite these URLs. */
  evidenceSources: EvidenceSource[];
  truncated: boolean;
}

export const LIMITS = {
  commits: 20,
  issues: 20,
  branches: 20,
  files: 12,
  /** Max characters kept per file. */
  perFileChars: 20_000,
  /** Max total file characters sent to Bedrock. */
  totalFileChars: 120_000,
  /** Max README characters. */
  readmeChars: 15_000,
  /** Max issue body characters each. */
  issueBodyChars: 2_000,
  /** Max commit message characters each. */
  commitMessageChars: 500,
} as const;

/** Directory prefixes that are never worth sending to the model. */
const IGNORED_PATH_PREFIXES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  "vendor/",
  "__pycache__/",
  ".venv/",
  "venv/",
];

/** Binary / generated / lockfile artefacts with no recovery signal. */
const IGNORED_FILE_PATTERNS =
  /\.(png|jpe?g|gif|svg|ico|woff2?|ttf|eot|mp4|mov|zip|tar|gz|pdf|exe|dll|so|bin|min\.js|min\.css|map)$/i;

/** Lockfiles are deliberately excluded (huge, low signal). */
const IGNORED_EXACT_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "poetry.lock",
  "Gemfile.lock",
  "Cargo.lock",
]);

/** High-signal files: manifests, configs, entry points. Matched case-insensitively. */
const PRIORITY_FILES = new Set(
  [
    "readme.md",
    "package.json",
    "tsconfig.json",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "pyproject.toml",
    "requirements.txt",
    "go.mod",
    "cargo.toml",
    "makefile",
    "cmakelists.txt",
    "build.gradle",
    "pom.xml",
    "composer.json",
    ".env.example",
  ].map((f) => f.toLowerCase()),
);

const PRIORITY_BASENAMES = [
  "index",
  "main",
  "app",
  "server",
  "cli",
  "route",
  "routes",
  "handler",
  "worker",
];

/** True when a tree path should never be downloaded. */
export function isIgnoredPath(path: string): boolean {
  const lower = path.toLowerCase();
  if (IGNORED_EXACT_FILES.has(lower.split("/").pop() ?? "")) return true;
  if (IGNORED_FILE_PATTERNS.test(path)) return true;
  return IGNORED_PATH_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Heuristic signal score for a candidate file path.
 * Higher = more likely to help reconstruct working context.
 */
export function scoreFilePath(path: string): number {
  const lower = path.toLowerCase();
  const segments = lower.split("/");
  const fileName = segments[segments.length - 1];
  const depth = segments.length;
  let score = 0;

  if (PRIORITY_FILES.has(fileName)) score += 100;
  const base = fileName.replace(/\.[^.]+$/, "");
  if (PRIORITY_BASENAMES.some((b) => base === b || base.startsWith(`${b}.`) || base.endsWith(`.${b}`))) {
    score += 40;
  }
  if (/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|c|cpp|cs|swift|kt|vue|svelte|tf|yaml|yml|toml|ini|env)$/.test(fileName)) {
    score += 15;
  }
  // Prefer top-level and src/ files over deeply nested ones.
  if (depth <= 2) score += 20;
  else if (depth <= 3) score += 8;
  // De-prioritise tests, docs and examples slightly (still useful, just less).
  if (/(test|spec|__tests__|docs?|examples?|fixtures?|mocks?)/.test(lower)) score -= 25;
  return score;
}

function truncate(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

async function ghFetch(
  path: string,
  opts: { token?: string; raw?: boolean },
): Promise<{ status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> }> {
  const headers: Record<string, string> = {
    Accept: opts.raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "User-Agent": "RepoCall-context-recovery-agent",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com${path}`, { headers });
  } catch (cause) {
    throw new GitHubError(
      `Could not reach the GitHub API: ${cause instanceof Error ? cause.message : String(cause)}`,
      "GITHUB_ERROR",
      502,
    );
  }

  if (res.status === 404) {
    throw new GitHubError("Repository not found. Check the URL — it must be a public repository.", "NOT_FOUND", 404);
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const retryAfter = Number(res.headers.get("retry-after") ?? "60");
    const limited =
      remaining === "0" ||
      (res.headers.get("x-ratelimit-limit") ?? "").length > 0 ||
      res.status === 429;
    if (limited) {
      throw new GitHubError(
        "GitHub API rate limit reached. Set GITHUB_TOKEN on the backend or try again shortly.",
        "RATE_LIMITED",
        429,
        Number.isFinite(retryAfter) ? retryAfter : 60,
      );
    }
    throw new GitHubError("GitHub refused the request (it may be private or blocked).", "GITHUB_ERROR", 502);
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error (HTTP ${res.status}).`, "GITHUB_ERROR", 502);
  }
  return {
    status: res.status,
    headers: res.headers,
    json: () => res.json() as Promise<unknown>,
    text: () => res.text(),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function asRecord(value: unknown): Record<string, any> {
  return (value ?? {}) as Record<string, any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Collect a bounded evidence package for owner/repo.
 * Independent GitHub calls run in parallel; a missing README or empty
 * tree is tolerated (evidence may simply be sparse).
 */
export async function collectRepositoryEvidence(
  owner: string,
  repo: string,
  opts: { token?: string } = {},
): Promise<EvidencePackage> {
  const token = opts.token || process.env.GITHUB_TOKEN || undefined;
  const fullName = `${owner}/${repo}`;
  const repoUrl = `https://github.com/${fullName}`;

  const [repoJson, readmeText, commitsJson, issuesJson, branchesJson] = await Promise.all([
    ghFetch(`/repos/${owner}/${repo}`, { token }).then((r) => r.json()),
    ghFetch(`/repos/${owner}/${repo}/readme`, { token, raw: true })
      .then((r) => r.text())
      .catch((err: unknown) => {
        if (err instanceof GitHubError && err.code === "NOT_FOUND") return null;
        throw err;
      }),
    ghFetch(`/repos/${owner}/${repo}/commits?per_page=${LIMITS.commits}`, { token }).then((r) => r.json()),
    ghFetch(`/repos/${owner}/${repo}/issues?state=open&per_page=${LIMITS.issues}&sort=updated`, { token }).then(
      (r) => r.json(),
    ),
    ghFetch(`/repos/${owner}/${repo}/branches?per_page=${LIMITS.branches}`, { token }).then((r) => r.json()),
  ]);

  const repoRec = asRecord(repoJson);
  const metadata: RepoMetadata = {
    owner,
    name: repoRec.name ?? repo,
    fullName: repoRec.full_name ?? fullName,
    url: repoRec.html_url ?? repoUrl,
    description: repoRec.description ?? null,
    language: repoRec.language ?? null,
    stars: repoRec.stargazers_count ?? 0,
    forks: repoRec.forks_count ?? 0,
    openIssues: repoRec.open_issues_count ?? 0,
    defaultBranch: repoRec.default_branch ?? "main",
    lastPush: repoRec.pushed_at ?? null,
    createdAt: repoRec.created_at ?? null,
    topics: Array.isArray(repoRec.topics) ? repoRec.topics.slice(0, 10) : [],
    license: repoRec.license?.spdx_id ?? repoRec.license?.name ?? null,
  };

  const commits: CommitEvidence[] = (Array.isArray(commitsJson) ? commitsJson : [])
    .slice(0, LIMITS.commits)
    .map((c) => {
      const rec = asRecord(c);
      const fullMessage = String(rec.commit?.message ?? "");
      const firstLine = fullMessage.split("\n")[0] ?? "";
      const { text } = truncate(firstLine, LIMITS.commitMessageChars);
      return {
        sha: String(rec.sha ?? ""),
        shortSha: String(rec.sha ?? "").slice(0, 7),
        message: text,
        author: rec.commit?.author?.name ?? rec.author?.login ?? null,
        date: rec.commit?.author?.date ?? null,
        url: rec.html_url ?? `${repoUrl}/commit/${rec.sha ?? ""}`,
      };
    });

  const issues: IssueEvidence[] = (Array.isArray(issuesJson) ? issuesJson : [])
    // The issues endpoint also returns pull requests — exclude them.
    .filter((i) => !asRecord(i).pull_request)
    .slice(0, LIMITS.issues)
    .map((i) => {
      const rec = asRecord(i);
      const { text } = truncate(String(rec.body ?? ""), LIMITS.issueBodyChars);
      return {
        number: Number(rec.number ?? 0),
        title: String(rec.title ?? "(untitled)"),
        bodySnippet: text,
        labels: Array.isArray(rec.labels)
          ? rec.labels.map((l: unknown) => String(asRecord(l).name ?? "")).filter(Boolean)
          : [],
        state: String(rec.state ?? "open"),
        comments: Number(rec.comments ?? 0),
        createdAt: rec.created_at ?? null,
        updatedAt: rec.updated_at ?? null,
        url: rec.html_url ?? `${repoUrl}/issues/${rec.number ?? ""}`,
      };
    });

  const branches: BranchEvidence[] = (Array.isArray(branchesJson) ? branchesJson : [])
    .slice(0, LIMITS.branches)
    .map((b) => {
      const rec = asRecord(b);
      return { name: String(rec.name ?? ""), protected: Boolean(rec.protected) };
    });

  // Repository file tree (recursive, truncated by GitHub for large repos).
  let truncated = false;
  let treePaths: string[] = [];
  try {
    const treeJson = await ghFetch(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(metadata.defaultBranch)}?recursive=1`,
      { token },
    ).then((r) => r.json());
    const treeRec = asRecord(treeJson);
    if (treeRec.truncated) truncated = true;
    if (Array.isArray(treeRec.tree)) {
      treePaths = treeRec.tree
        .filter((t: unknown) => asRecord(t).type === "blob")
        .map((t: unknown) => String(asRecord(t).path ?? ""))
        .filter((p: string) => p.length > 0 && !isIgnoredPath(p));
    }
  } catch (err) {
    // A missing tree (e.g. empty repo) just means less evidence.
    if (!(err instanceof GitHubError) || err.code === "NOT_FOUND") {
      if (err instanceof GitHubError && err.code === "NOT_FOUND") throw err;
    } else {
      throw err;
    }
  }

  const selected = treePaths
    .map((path) => ({ path, score: scoreFilePath(path) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMITS.files);

  const files: FileEvidence[] = [];
  let usedChars = 0;
  for (const { path } of selected) {
    const remaining = LIMITS.totalFileChars - usedChars;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    try {
      const raw = await ghFetch(
        `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(metadata.defaultBranch)}`,
        { token, raw: true },
      ).then((r) => r.text());
      // Skip files that decode as binary garbage.
      if (raw.includes("\0")) continue;
      const budget = Math.min(LIMITS.perFileChars, remaining);
      const { text, truncated: fileTruncated } = truncate(raw, budget);
      if (fileTruncated) truncated = true;
      usedChars += text.length;
      files.push({ path, size: raw.length, truncated: fileTruncated, content: text });
    } catch {
      // Individual file failures must not fail the whole analysis.
      continue;
    }
  }
  if (selected.length < treePaths.length) truncated = true;

  const evidenceSources: EvidenceSource[] = [
    {
      sourceType: "metadata",
      sourceTitle: `${metadata.fullName} repository metadata`,
      sourceUrl: metadata.url,
    },
  ];
  if (readmeText !== null) {
    evidenceSources.push({
      sourceType: "readme",
      sourceTitle: "README",
      sourceUrl: `${repoUrl}/blob/${metadata.defaultBranch}/README.md`,
    });
  }
  for (const c of commits) {
    evidenceSources.push({ sourceType: "commit", sourceTitle: c.message || c.shortSha, sourceUrl: c.url });
  }
  for (const i of issues) {
    evidenceSources.push({ sourceType: "issue", sourceTitle: `#${i.number} ${i.title}`, sourceUrl: i.url });
  }
  for (const f of files) {
    evidenceSources.push({
      sourceType: "file",
      sourceTitle: f.path,
      sourceUrl: `${repoUrl}/blob/${metadata.defaultBranch}/${f.path}`,
    });
  }

  let readme: EvidencePackage["readme"] = null;
  if (readmeText !== null) {
    const { text, truncated: readmeTruncated } = truncate(readmeText, LIMITS.readmeChars);
    if (readmeTruncated) truncated = true;
    readme = { length: readmeText.length, truncated: readmeTruncated, content: text };
  }

  return { repository: metadata, readme, commits, issues, branches, files, evidenceSources, truncated };
}
