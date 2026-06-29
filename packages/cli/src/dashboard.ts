import http from "node:http";
import type { Vault } from "@mnemo/core";
import { DASHBOARD_HTML } from "./web.js";
import { snippetText } from "./config-snippet.js";

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch (e) {
        reject(e as Error);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Start the owner-facing dashboard on localhost. Exposes a small JSON API plus
 * the single-page UI. Bound to 127.0.0.1 only — this is the user's private
 * control plane and must never be exposed to the network.
 */
export function startDashboard(vault: Vault, port: number, host = "127.0.0.1"): http.Server {
  const server = http.createServer((req, res) => {
    void handle(req, res, vault, host, port).catch((e: unknown) => {
      sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
    });
  });
  server.listen(port, host);
  return server;
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  vault: Vault,
  host: string,
  port: number,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${host}:${port}`);
  const p = url.pathname;
  const method = req.method ?? "GET";
  const admin = vault.admin;
  const qp = url.searchParams;

  if (method === "GET" && (p === "/" || p === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(DASHBOARD_HTML);
    return;
  }

  // --- reads ---
  if (method === "GET" && p === "/api/stats") return sendJson(res, 200, admin.stats());
  if (method === "GET" && p === "/api/scopes") return sendJson(res, 200, admin.listScopes());
  if (method === "GET" && p === "/api/clients") return sendJson(res, 200, admin.listClients());
  if (method === "GET" && p === "/api/grants") {
    return sendJson(res, 200, admin.listGrants(qp.get("client") ?? undefined));
  }
  if (method === "GET" && p === "/api/audit") {
    return sendJson(res, 200, admin.audit({ limit: Number(qp.get("limit")) || 150 }));
  }
  if (method === "GET" && p === "/api/memories") {
    const scope = qp.get("scope") ?? undefined;
    return sendJson(res, 200, admin.listMemories({ scope, limit: Number(qp.get("limit")) || 200 }));
  }
  if (method === "GET" && p === "/api/search") {
    const q = qp.get("q") ?? "";
    if (!q.trim()) return sendJson(res, 200, []);
    return sendJson(res, 200, await admin.search({ query: q, scope: qp.get("scope") ?? undefined, k: 20 }));
  }
  if (method === "GET" && p === "/api/config") {
    const clientId = qp.get("client") || "claude-desktop";
    const label = qp.get("label") || "Claude Desktop";
    return sendJson(res, 200, { snippet: snippetText({ clientId, label, local: qp.get("local") === "1" }) });
  }
  if (method === "GET" && p === "/api/export") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": "attachment; filename=mnemo-export.json",
    });
    res.end(JSON.stringify(admin.export(), null, 2));
    return;
  }

  // --- writes ---
  if (method === "POST" && p === "/api/memories") {
    const b = await readBody(req);
    const content = String(b.content ?? "").trim();
    if (!content) return sendJson(res, 400, { error: "content is required" });
    const mem = await admin.addMemory({ content, scope: b.scope ? String(b.scope) : undefined });
    return sendJson(res, 200, mem);
  }
  if (method === "DELETE" && p === "/api/memories") {
    return sendJson(res, 200, { deleted: admin.deleteMemory(qp.get("id") ?? "") });
  }
  if (method === "POST" && p === "/api/grants") {
    const b = await readBody(req);
    if (!b.clientId || !b.scope) return sendJson(res, 400, { error: "clientId and scope required" });
    admin.grant(String(b.clientId), String(b.scope), { canRead: !!b.canRead, canWrite: !!b.canWrite });
    return sendJson(res, 200, { ok: true });
  }
  if (method === "POST" && p === "/api/revoke") {
    const b = await readBody(req);
    admin.revoke(String(b.clientId), String(b.scope));
    return sendJson(res, 200, { ok: true });
  }
  if (method === "POST" && p === "/api/scopes") {
    const b = await readBody(req);
    if (!b.name) return sendJson(res, 400, { error: "name required" });
    admin.createScope(String(b.name), b.description ? String(b.description) : undefined);
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 404, { error: "not found" });
}
