import { describe, expect, it } from "vitest";
import { parseRepositoryUrl, ValidationError } from "../src/lib/validate.js";

describe("parseRepositoryUrl", () => {
  it("accepts a canonical https repo URL", () => {
    expect(parseRepositoryUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
      fullName: "owner/repo",
      url: "https://github.com/owner/repo",
    });
  });

  it("accepts trailing slash, .git suffix and deeper paths", () => {
    expect(parseRepositoryUrl("https://github.com/vercel/swr/").fullName).toBe("vercel/swr");
    expect(parseRepositoryUrl("https://github.com/vercel/swr.git").fullName).toBe("vercel/swr");
    expect(parseRepositoryUrl("https://github.com/vercel/swr/tree/main/src").fullName).toBe("vercel/swr");
  });

  it("rejects non-GitHub hosts", () => {
    expect(() => parseRepositoryUrl("https://gitlab.com/owner/repo")).toThrow(ValidationError);
    expect(() => parseRepositoryUrl("https://github.com.evil.com/owner/repo")).toThrow(ValidationError);
  });

  it("rejects missing repo segments and bad input", () => {
    expect(() => parseRepositoryUrl("https://github.com/owner")).toThrow(ValidationError);
    expect(() => parseRepositoryUrl("not a url")).toThrow(ValidationError);
    expect(() => parseRepositoryUrl("")).toThrow(ValidationError);
    expect(() => parseRepositoryUrl(undefined)).toThrow(ValidationError);
    expect(() => parseRepositoryUrl("javascript:alert(1)")).toThrow(ValidationError);
  });
});
