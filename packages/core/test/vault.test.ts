import { test } from "node:test";
import assert from "node:assert/strict";
import { Vault, ConsentError } from "../dist/index.js";

test("write is denied without a grant, then allowed after granting", async () => {
  const v = Vault.open(":memory:");
  const tool = v.client("toolA", "Tool A");

  await assert.rejects(() => tool.write({ content: "hello world", scope: "general" }), ConsentError);

  v.admin.grant("toolA", "general", { canRead: true, canWrite: true });
  const mem = await tool.write({ content: "I love hiking in the mountains", scope: "general" });
  assert.ok(mem.id.startsWith("mem_"));
  assert.equal(mem.scope, "general");
  assert.equal(mem.sourceClient, "toolA");
  v.close();
});

test("search returns semantically relevant memories first", async () => {
  const v = Vault.open(":memory:");
  v.admin.grant("toolA", "general", { canRead: true, canWrite: true });
  const tool = v.client("toolA");

  await tool.write({ content: "I love hiking in the mountains every summer", scope: "general" });
  await tool.write({ content: "My favorite food is fresh sushi", scope: "general" });
  await tool.write({ content: "I drive an electric car to work", scope: "general" });

  const hits = await tool.search({ query: "mountain hiking trip", k: 3 });
  assert.ok(hits.length >= 1, "expected at least one hit");
  assert.match(hits[0]!.content, /hiking/);
  assert.ok(hits[0]!.score > 0);
  v.close();
});

test("every access — allowed or denied — is recorded in the audit log", async () => {
  const v = Vault.open(":memory:");
  const tool = v.client("toolA");

  await assert.rejects(() => tool.write({ content: "secret", scope: "general" }), ConsentError);
  v.admin.grant("toolA", "general", { canRead: true, canWrite: true });
  await tool.write({ content: "remembered fact", scope: "general" });

  const audit = v.admin.audit({ limit: 50 });
  assert.ok(audit.some((a) => a.action === "write" && a.allowed === true), "an allowed write");
  assert.ok(audit.some((a) => a.action === "write" && a.allowed === false), "a denied write");
  v.close();
});

test("owner can add and list memories without a grant", async () => {
  const v = Vault.open(":memory:");
  await v.admin.addMemory({ content: "owner note about taxes", scope: "finance" });
  const list = v.admin.listMemories({ scope: "finance" });
  assert.equal(list.length, 1);
  assert.equal(list[0]!.sourceClient, "(owner)");

  const stats = v.admin.stats();
  assert.equal(stats.memories, 1);
  assert.equal(stats.embeddingProvider, "lexical-v1");
  v.close();
});
