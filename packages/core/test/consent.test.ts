import { test } from "node:test";
import assert from "node:assert/strict";
import { Vault, ConsentError } from "../dist/index.js";

test("scope isolation: a client only sees scopes it was granted", async () => {
  const v = Vault.open(":memory:");
  await v.admin.addMemory({ content: "project roadmap and Q3 deadline", scope: "work" });
  await v.admin.addMemory({ content: "blood pressure medication schedule", scope: "health" });

  v.admin.grant("c1", "work", { canRead: true });
  const c1 = v.client("c1");

  const hits = await c1.search({ query: "roadmap deadline" });
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => h.scope === "work"), "must never leak the health scope");

  await assert.rejects(
    () => c1.search({ query: "medication", scope: "health" }),
    ConsentError,
    "explicitly targeting an ungranted scope must be denied",
  );
  v.close();
});

test("revoking a grant blocks future access and is auditable", async () => {
  const v = Vault.open(":memory:");
  await v.admin.addMemory({ content: "project roadmap", scope: "work" });
  v.admin.grant("c1", "work", { canRead: true });
  const c1 = v.client("c1");

  assert.ok((await c1.search({ query: "roadmap" })).length >= 1);

  v.admin.revoke("c1", "work");
  assert.equal((await c1.search({ query: "roadmap" })).length, 0, "revoked client sees nothing");

  const clients = v.admin.listClients();
  assert.equal(clients.find((c) => c.id === "c1")?.status, "pending");
  v.close();
});

test("wildcard grant gives read access across all scopes", async () => {
  const v = Vault.open(":memory:");
  await v.admin.addMemory({ content: "project roadmap", scope: "work" });
  await v.admin.addMemory({ content: "medication schedule", scope: "health" });

  v.admin.grant("c2", "*", { canRead: true });
  const c2 = v.client("c2");
  const hits = await c2.search({ query: "roadmap medication", k: 10 });
  const scopes = new Set(hits.map((h) => h.scope));
  assert.ok(scopes.has("work") && scopes.has("health"), "wildcard sees every scope");

  assert.deepEqual(
    c2.listScopes().map((s) => s.name).sort(),
    ["health", "work"],
  );
  v.close();
});
