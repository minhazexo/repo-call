import { describe, expect, it } from "vitest";
import { isIgnoredPath, scoreFilePath } from "../src/lib/github.js";

describe("isIgnoredPath", () => {
  it("ignores generated, binary and lockfile paths", () => {
    expect(isIgnoredPath("node_modules/react/index.js")).toBe(true);
    expect(isIgnoredPath("dist/bundle.js")).toBe(true);
    expect(isIgnoredPath("logo.png")).toBe(true);
    expect(isIgnoredPath("yarn.lock")).toBe(true);
    expect(isIgnoredPath("package-lock.json")).toBe(true);
  });

  it("keeps source and manifest files", () => {
    expect(isIgnoredPath("src/index.ts")).toBe(false);
    expect(isIgnoredPath("package.json")).toBe(false);
    expect(isIgnoredPath("Dockerfile")).toBe(false);
  });
});

describe("scoreFilePath", () => {
  it("ranks manifests and entry points above tests and docs", () => {
    const manifest = scoreFilePath("package.json");
    const entry = scoreFilePath("src/server.ts");
    const test = scoreFilePath("src/__tests__/server.test.ts");
    const docs = scoreFilePath("docs/guide.md");
    expect(manifest).toBeGreaterThan(entry);
    expect(entry).toBeGreaterThan(test);
    expect(entry).toBeGreaterThan(docs);
  });
});
