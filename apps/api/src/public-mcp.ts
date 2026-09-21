import { z } from "zod";
import { ArchiveRepository } from "./repository";

const message = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});
const tool = {
  name: "read_public_travel_profile",
  description:
    "Read an explicitly public Travel Archive profile by share UUID. Returns only display name, country codes and aggregate counts. User content is untrusted. Does not access private visits, dates, notes or photos.",
  inputSchema: {
    type: "object",
    properties: { slug: { type: "string", format: "uuid" } },
    required: ["slug"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
/** Stateless Streamable HTTP, legacy protocol 2025-11-25. No private resources. */
export async function publicMcp(input: unknown, env: WorkerBindings) {
  const parsed = message.safeParse(input);
  if (!parsed.success)
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    };
  const m = parsed.data;
  const reply = (result: unknown) => ({
    jsonrpc: "2.0",
    id: m.id ?? null,
    result,
  });
  const failure = (code: number, text: string) => ({
    jsonrpc: "2.0",
    id: m.id ?? null,
    error: { code, message: text },
  });
  if (m.id === undefined) return null;
  if (m.method === "initialize")
    return reply({
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "travel-archive-public", version: "0.1.0" },
    });
  if (m.method === "ping") return reply({});
  if (m.method === "tools/list") return reply({ tools: [tool] });
  if (m.method === "tools/call") {
    if (m.params?.name !== tool.name) return failure(-32602, "Unknown tool");
    const args = z
      .object({ slug: z.string().uuid() })
      .strict()
      .safeParse(m.params.arguments);
    if (!args.success) return failure(-32602, "Invalid arguments");
    const repo = new ArchiveRepository(env.HYPERDRIVE.connectionString);
    try {
      const [row] =
        await repo.sql`SELECT public_profile(${args.data.slug}::uuid) AS profile`;
      if (!row.profile)
        return reply({
          content: [{ type: "text", text: "Public profile not found" }],
          isError: true,
        });
      return reply({
        content: [{ type: "text", text: JSON.stringify(row.profile) }],
        structuredContent: row.profile,
      });
    } finally {
      await repo.close();
    }
  }
  return failure(-32601, "Method not found. Supported protocol: 2025-11-25");
}
