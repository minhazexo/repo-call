/**
 * Server-side GitHub repository URL validation.
 * Only public github.com owner/repo URLs are accepted.
 */

export interface ParsedRepository {
  owner: string;
  repo: string;
  fullName: string;
  /** Canonical https URL. */
  url: string;
}

export class ValidationError extends Error {
  readonly code = "INVALID_URL" as const;
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Matches a single GitHub owner or repository name segment. */
const SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

/**
 * Parse and validate a user-supplied repository URL.
 * Accepts trailing slashes, `.git` suffixes, and deeper paths
 * (e.g. /owner/repo/tree/main) — the first two segments win.
 * @throws {ValidationError} when the URL is not an acceptable public repo URL.
 */
export function parseRepositoryUrl(input: unknown): ParsedRepository {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new ValidationError("repositoryUrl is required.");
  }
  const trimmed = input.trim();
  if (trimmed.length > 500) {
    throw new ValidationError("repositoryUrl is too long.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError(
      "repositoryUrl must be a valid URL like https://github.com/owner/repo.",
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("repositoryUrl must use http(s).");
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    throw new ValidationError("Only public github.com repository URLs are supported.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new ValidationError(
      "repositoryUrl must point to a repository, e.g. https://github.com/owner/repo.",
    );
  }

  const [owner, rawRepo] = segments;
  let repo = rawRepo;
  if (repo.toLowerCase().endsWith(".git")) {
    repo = repo.slice(0, -4);
  }
  if (
    !SEGMENT_PATTERN.test(owner) ||
    !SEGMENT_PATTERN.test(repo) ||
    owner.length > 100 ||
    repo.length > 100 ||
    owner === "." ||
    owner === ".." ||
    repo === "." ||
    repo === ".."
  ) {
    throw new ValidationError("repositoryUrl contains an invalid owner or repository name.");
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}
