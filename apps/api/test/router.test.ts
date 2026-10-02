import { describe, expect, it } from "vitest";
import { handleRequest, normalizeRoute } from "../src/index.js";

describe("normalizeRoute", () => {
  it("matches routes with or without a stage prefix", () => {
    expect(normalizeRoute("/health")).toBe("health");
    expect(normalizeRoute("/prod/health")).toBe("health");
    expect(normalizeRoute("/analyze")).toBe("analyze");
    expect(normalizeRoute("/prod/analyze")).toBe("analyze");
    expect(normalizeRoute("/nope")).toBeNull();
  });
});

describe("handleRequest", () => {
  it("answers GET /health", async () => {
    const res = await handleRequest({ method: "GET", path: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });

  it("answers CORS preflight", async () => {
    const res = await handleRequest({ method: "OPTIONS", path: "/analyze" });
    expect(res.statusCode).toBe(204);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("rejects invalid GitHub URLs with INVALID_URL", async () => {
    const res = await handleRequest({
      method: "POST",
      path: "/analyze",
      bodyText: JSON.stringify({ repositoryUrl: "https://gitlab.com/o/r" }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_URL");
  });

  it("rejects oversized bodies", async () => {
    const res = await handleRequest({
      method: "POST",
      path: "/analyze",
      bodyText: "x".repeat(10_001),
    });
    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects malformed JSON", async () => {
    const res = await handleRequest({ method: "POST", path: "/analyze", bodyText: "{oops" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await handleRequest({ method: "GET", path: "/nope" });
    expect(res.statusCode).toBe(404);
  });
});
