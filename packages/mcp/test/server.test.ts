import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Vault } from "@mnemo/core";
import { createServer } from "../dist/index.js";

type TextContent = { type: string; text?: string };
const textOf = (res: { content: unknown }): string =>
  (res.content as TextContent[]).map((c) => c.text ?? "").join("\n");

async function connect(session: ReturnType<Vault["client"]>) {
  const server = createServer(session);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-harness", version: "1.0.0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return { client, server };
}

test("exposes the three memory tools over MCP", async () => {
  const vault = Vault.open(":memory:");
  const { client } = await connect(vault.client("test-client"));
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(tools, ["memory_list_scopes", "memory_search", "memory_write"]);
  await client.close();
  vault.close();
});

test("write then search round-trips through the protocol", async () => {
  const vault = Vault.open(":memory:");
  vault.admin.grant("test-client", "general", { canRead: true, canWrite: true });
  const { client } = await connect(vault.client("test-client"));

  const w = await client.callTool({
    name: "memory_write",
    arguments: { content: "I strongly prefer dark mode in all my editors", scope: "general" },
  });
  assert.ok(!w.isError, "write should succeed");
  assert.match(textOf(w), /Saved to memory/);

  const s = await client.callTool({
    name: "memory_search",
    arguments: { query: "what theme do I prefer in my editor?" },
  });
  assert.ok(!s.isError);
  assert.match(textOf(s), /dark mode/);

  await client.close();
  vault.close();
});

test("consent denial is returned as a tool error, not a crash", async () => {
  const vault = Vault.open(":memory:");
  // Granted only on "general" — writing to "secret" must be denied.
  vault.admin.grant("test-client", "general", { canRead: true, canWrite: true });
  const { client } = await connect(vault.client("test-client"));

  const denied = await client.callTool({
    name: "memory_write",
    arguments: { content: "should not be stored", scope: "secret" },
  });
  assert.equal(denied.isError, true);
  assert.match(textOf(denied), /Consent denied/);

  await client.close();
  vault.close();
});
