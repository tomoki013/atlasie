import { expect, it } from "vitest";
import { app } from "./index";

const env = { WEB_ORIGIN: "http://localhost:3000" };
it("public MCP advertises only the public-profile read tool", async () => {
  const r = await app.request(
    "/v1/mcp",
    {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    },
    env,
  );
  expect(r.status).toBe(200);
  const body = (await r.json()) as { result: { tools: { name: string }[] } };
  expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual([
    "read_public_travel_profile",
  ]);
});
it("public MCP cannot be used to query a private resource", async () => {
  const r = await app.request(
    "/v1/mcp",
    {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_private_memories", arguments: {} },
      }),
    },
    env,
  );
  expect(((await r.json()) as { error: { code: number } }).error.code).toBe(
    -32602,
  );
});
it("rejects foreign browser origins for MCP requests", async () => {
  const r = await app.request(
    "/v1/mcp",
    { method: "POST", headers: { Origin: "https://evil.test" }, body: "{}" },
    env,
  );
  expect(r.status).toBe(403);
});
