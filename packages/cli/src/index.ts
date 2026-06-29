#!/usr/bin/env node
import fs from "node:fs";
import { Vault } from "@mnemo/core";
import { runStdioServer } from "@mnemo/mcp";
import { startDashboard } from "./dashboard.js";
import { snippetText } from "./config-snippet.js";
import { dbPath, defaultPort, embeddingsName } from "./paths.js";

const VERSION = "0.1.0";

interface Parsed {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parse(args: string[]): Parsed {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

function openVault(): Vault {
  return Vault.open(dbPath(), { embeddings: embeddingsName() });
}

const HELP = `mnemo ${VERSION} — a user-owned memory layer for your AI tools.

USAGE
  mnemo [dashboard]                 Start the local dashboard (default).
  mnemo mcp --client <id> [--label] Run the MCP server over stdio (used by AI tools).
  mnemo config [--client <id>]      Print an MCP config snippet to paste into a tool.
  mnemo grant <client> <scope>      Grant a client access (--read --write; default both).
  mnemo revoke <client> <scope>     Revoke a client's grant on a scope.
  mnemo add <text...> [--scope s]   Add a memory as the owner.
  mnemo delete <memory-id>          Delete a memory by id.
  mnemo search <query...>           Semantic search across all scopes.
  mnemo clients                     List connected clients and their status.
  mnemo scopes                      List scopes.
  mnemo audit [--limit n]           Show recent audit entries.
  mnemo export [--out file.json]    Export the whole vault as JSON.

ENV
  MNEMO_HOME        Vault directory (default: ~/.mnemo)
  MNEMO_PORT        Dashboard port (default: 4319)
  MNEMO_EMBEDDINGS  'lexical' (default) or 'fastembed'

Use scope "*" to grant access to all scopes at once.`;

async function main(): Promise<void> {
  const { _, flags } = parse(process.argv.slice(2));
  const cmd = _[0] ?? "dashboard";

  if (flags.version || cmd === "version" || flags.v) {
    process.stdout.write(`mnemo ${VERSION}\n`);
    return;
  }
  if (cmd === "help" || flags.help) {
    process.stdout.write(HELP + "\n");
    return;
  }

  switch (cmd) {
    case "mcp": {
      // IMPORTANT: stdout is the MCP protocol channel — never log to it here.
      const clientId = String(flags.client ?? "mcp-client");
      const label = flags.label ? String(flags.label) : clientId;
      if (!flags.client) {
        process.stderr.write(
          "[mnemo] warning: no --client given; using 'mcp-client'. Pass --client <id> so each tool is distinct.\n",
        );
      }
      await runStdioServer({
        vaultPath: dbPath(),
        clientId,
        label,
        embeddings: embeddingsName(),
      });
      return; // stdio transport keeps the process alive
    }

    case "config": {
      const clientId = String(flags.client ?? "claude-desktop");
      const label = String(flags.label ?? "Claude Desktop");
      const local = !flags.published;
      process.stdout.write(snippetText({ clientId, label, local }) + "\n");
      return;
    }

    case "grant": {
      const [, client, scope] = _;
      if (!client || !scope) return fail("usage: mnemo grant <client> <scope> [--read] [--write]");
      const canRead = !!flags.read || (!flags.read && !flags.write);
      const canWrite = !!flags.write || (!flags.read && !flags.write);
      const v = openVault();
      v.admin.grant(client, scope, { canRead, canWrite });
      v.close();
      process.stdout.write(
        `Granted ${client} → "${scope}" (read=${canRead ? "yes" : "no"}, write=${canWrite ? "yes" : "no"}).\n`,
      );
      return;
    }

    case "revoke": {
      const [, client, scope] = _;
      if (!client || !scope) return fail("usage: mnemo revoke <client> <scope>");
      const v = openVault();
      const revoked = v.admin.revoke(client, scope);
      v.close();
      if (revoked) {
        process.stdout.write(`Revoked ${client} → "${scope}".\n`);
      } else {
        process.stderr.write(`No active grant found for client "${client}" on scope "${scope}".\n`);
        process.exitCode = 1;
      }
      return;
    }

    case "delete": {
      const [, memId] = _;
      if (!memId) return fail("usage: mnemo delete <memory-id>");
      const v = openVault();
      const deleted = v.admin.deleteMemory(memId);
      v.close();
      if (deleted) {
        process.stdout.write(`Deleted ${memId}.\n`);
      } else {
        process.stderr.write(`Memory "${memId}" not found.\n`);
        process.exitCode = 1;
      }
      return;
    }

    case "add": {
      const content = _.slice(1).join(" ").trim();
      if (!content) return fail('usage: mnemo add "your memory text" [--scope s]');
      const v = openVault();
      const mem = await v.admin.addMemory({
        content,
        scope: flags.scope ? String(flags.scope) : undefined,
      });
      v.close();
      process.stdout.write(`Saved ${mem.id} in scope "${mem.scope}".\n`);
      return;
    }

    case "search": {
      const query = _.slice(1).join(" ").trim();
      if (!query) return fail('usage: mnemo search "your query"');
      const v = openVault();
      const hits = await v.admin.search({
        query,
        scope: flags.scope ? String(flags.scope) : undefined,
        k: Number(flags.k) || 10,
      });
      v.close();
      if (hits.length === 0) {
        process.stdout.write("No matches.\n");
        return;
      }
      for (const h of hits) {
        process.stdout.write(`[${h.score.toFixed(2)}] (${h.scope}) ${h.content}\n`);
      }
      const best = hits[0]?.score ?? 0;
      if (best < 0.15) {
        process.stderr.write(
          "Tip: low relevance scores — the default lexical embedder works best with keyword queries.\n" +
            "Set MNEMO_EMBEDDINGS=fastembed for semantic search (requires npm install mnemo-fastembed).\n",
        );
      }
      return;
    }

    case "clients": {
      const v = openVault();
      const clients = v.admin.listClients();
      v.close();
      if (clients.length === 0) {
        process.stdout.write("No clients yet.\n");
        return;
      }
      for (const c of clients) {
        process.stdout.write(`${c.status.padEnd(8)} ${c.id}  (${c.label ?? "-"})\n`);
      }
      return;
    }

    case "scopes": {
      const v = openVault();
      const scopes = v.admin.listScopes();
      v.close();
      if (scopes.length === 0) {
        process.stdout.write("No scopes yet.\n");
        return;
      }
      for (const s of scopes) {
        process.stdout.write(`${s.name}${s.description ? ` — ${s.description}` : ""}\n`);
      }
      return;
    }

    case "audit": {
      const v = openVault();
      const rows = v.admin.audit({ limit: Number(flags.limit) || 50 });
      v.close();
      for (const a of rows.reverse()) {
        const when = new Date(a.ts).toISOString();
        const verdict = a.allowed ? "ok " : "DENY";
        process.stdout.write(
          `${when}  ${verdict}  ${a.action.padEnd(13)} ${(a.clientId ?? "").padEnd(16)} ${a.scope ?? ""}  ${a.detail ?? ""}\n`,
        );
      }
      return;
    }

    case "export": {
      const v = openVault();
      const data = v.admin.export();
      v.close();
      const text = JSON.stringify(data, null, 2);
      if (flags.out) {
        fs.writeFileSync(String(flags.out), text);
        process.stdout.write(`Exported ${data.memories.length} memories to ${String(flags.out)}.\n`);
      } else {
        process.stdout.write(text + "\n");
      }
      return;
    }

    case "dashboard": {
      const port = Number(flags.port) || defaultPort();
      const v = openVault();
      startDashboard(v, port);
      const url = `http://127.0.0.1:${port}`;
      const stats = v.admin.stats();
      process.stdout.write(
        [
          "",
          "  Mnemo — your memory, your rules.",
          "  " + "-".repeat(40),
          `  Dashboard:  ${url}`,
          `  Vault:      ${dbPath()}`,
          `  Memories:   ${stats.memories}   Scopes: ${stats.scopes}   Clients: ${stats.clients} (${stats.pendingClients} pending)`,
          "",
          "  Connect a tool:  mnemo config --client claude-desktop",
          "  Stop:            Ctrl+C",
          "",
        ].join("\n") + "\n",
      );
      return; // http server keeps the process alive
    }

    default:
      return fail(`unknown command: ${cmd}\n\n${HELP}`);
  }
}

function fail(msg: string): void {
  process.stderr.write(msg + "\n");
  process.exitCode = 1;
}

main().catch((e: unknown) => {
  process.stderr.write(`[mnemo] error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
