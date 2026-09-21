import { describe, expect, it } from "vitest";
import { app } from "./index";

const configured = {
  AUTH0_DOMAIN: "example.auth0.com",
  AUTH0_AUDIENCE: "https://api.example.test",
  WEB_ORIGIN: "http://localhost:3000",
};
describe("API authentication and privacy boundaries", () => {
  it("serves a non-sensitive health response", async () => {
    const r = await app.request("/v1/health", {}, configured);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  for (const [method, path] of [
    ["GET", "/me"],
    ["DELETE", "/me"],
    ["GET", "/visits"],
    ["POST", "/visits"],
    ["POST", "/guest/import"],
    ["GET", "/share"],
    ["PUT", "/share"],
    ["POST", "/photos/upload"],
    ["GET", "/photos/00000000-0000-4000-8000-000000000001/url"],
  ])
    it(`rejects unauthenticated ${method} ${path}`, async () => {
      const r = await app.request(`/v1${path}`, { method }, configured);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "unauthorized" });
    });
  it("rejects a fabricated token before touching PostgreSQL or R2", async () => {
    const r = await app.request(
      "/v1/me",
      { headers: { Authorization: "Bearer invalid" } },
      configured,
    );
    expect(r.status).toBe(401);
  });
  it("fails closed when authentication is unconfigured", async () => {
    const r = await app.request("/v1/me", {}, {});
    expect(r.status).toBe(503);
  });
  it("fails closed when Turnstile secrets are absent", async () => {
    const r = await app.request(
      "/v1/auth/save-intent",
      { method: "POST" },
      configured,
    );
    expect(r.status).toBe(503);
  });
  it("does not allow arbitrary CORS origins", async () => {
    const r = await app.request(
      "/v1/health",
      { headers: { Origin: "https://evil.test" } },
      configured,
    );
    expect(r.headers.get("Access-Control-Allow-Origin")).not.toBe(
      "https://evil.test",
    );
  });
});
