import { describe, expect, it } from "vitest";
import {
  buildUserPrompt,
  extractJsonPayload,
  validateAnalysis,
  BedrockError,
  type BedrockConfig,
} from "../src/lib/bedrock.js";
import type { EvidencePackage } from "../src/lib/github.js";

function samplePackage(): EvidencePackage {
  return {
    repository: {
      owner: "octo",
      name: "demo",
      fullName: "octo/demo",
      url: "https://github.com/octo/demo",
      description: "demo repo",
      language: "TypeScript",
      stars: 10,
      forks: 2,
      openIssues: 1,
      defaultBranch: "main",
      lastPush: "2024-01-01T00:00:00Z",
      createdAt: "2023-01-01T00:00:00Z",
      topics: [],
      license: "MIT",
    },
    readme: { length: 11, truncated: false, content: "hello world" },
    commits: [
      {
        sha: "abc1234567890",
        shortSha: "abc1234",
        message: "feat: add thing",
        author: "octo",
        date: "2024-01-01T00:00:00Z",
        url: "https://github.com/octo/demo/commit/abc1234567890",
      },
    ],
    issues: [
      {
        number: 1,
        title: "broken thing",
        bodySnippet: "it is broken",
        labels: ["bug"],
        state: "open",
        comments: 0,
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-03T00:00:00Z",
        url: "https://github.com/octo/demo/issues/1",
      },
    ],
    branches: [{ name: "main", protected: true }],
    files: [
      { path: "package.json", size: 20, truncated: false, content: '{"name":"demo"}' },
    ],
    evidenceSources: [
      { sourceType: "metadata", sourceTitle: "octo/demo repository metadata", sourceUrl: "https://github.com/octo/demo" },
      { sourceType: "commit", sourceTitle: "feat: add thing", sourceUrl: "https://github.com/octo/demo/commit/abc1234567890" },
      { sourceType: "issue", sourceTitle: "#1 broken thing", sourceUrl: "https://github.com/octo/demo/issues/1" },
    ],
    truncated: false,
  };
}

describe("buildUserPrompt", () => {
  it("frames repo content as untrusted data and lists the evidence catalog", () => {
    const prompt = buildUserPrompt(samplePackage());
    expect(prompt).toContain("<repository-evidence>");
    expect(prompt).toContain("UNTRUSTED DATA");
    expect(prompt).toContain("EVIDENCE CATALOG");
    expect(prompt).toContain("https://github.com/octo/demo/commit/abc1234567890");
  });
});

describe("extractJsonPayload", () => {
  it("parses strict JSON and fenced JSON", () => {
    expect(extractJsonPayload('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonPayload('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("rejects non-JSON model output", () => {
    expect(() => extractJsonPayload("hello world")).toThrow(BedrockError);
  });
});

describe("validateAnalysis", () => {
  const allowed = new Set([
    "https://github.com/octo/demo",
    "https://github.com/octo/demo/commit/abc1234567890",
    "https://github.com/octo/demo/issues/1",
  ]);

  it("drops evidence with invented URLs (anti-hallucination)", () => {
    const result = validateAnalysis(
      {
        projectGoal: "demo",
        currentState: "started",
        completedWork: [],
        stoppedAt: "nowhere",
        blockers: [],
        risks: [],
        nextActions: [],
        resumeBriefing: "brief",
        evidence: [
          {
            claim: "real",
            sourceType: "commit",
            sourceTitle: "feat",
            sourceUrl: "https://github.com/octo/demo/commit/abc1234567890",
          },
          {
            claim: "invented",
            sourceType: "commit",
            sourceTitle: "fake",
            sourceUrl: "https://github.com/octo/demo/commit/deadbeef0000000",
          },
        ],
      },
      allowed,
    );
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].claim).toBe("real");
  });

  it("normalizes bad priorities and coerces missing sections", () => {
    const result = validateAnalysis(
      {
        projectGoal: "  spaced  ",
        currentState: "",
        nextActions: [{ title: "do thing", reason: "", priority: "urgent" }],
        evidence: [],
      },
      allowed,
    );
    expect(result.nextActions[0].priority).toBe("medium");
    expect(result.currentState).toBe("Insufficient evidence");
  });

  it("rejects empty model payloads", () => {
    expect(() => validateAnalysis({}, allowed)).toThrow(BedrockError);
    expect(() => validateAnalysis(null, allowed)).toThrow(BedrockError);
  });
});

describe("bedrock config", () => {
  it("keeps the shared type import used", () => {
    const config: BedrockConfig = {
      region: "us-east-1",
      primaryModelId: "amazon.nova-lite-v1:0",
      fallbackModelId: "amazon.nova-micro-v1:0",
    };
    expect(config.region).toBe("us-east-1");
  });
});
