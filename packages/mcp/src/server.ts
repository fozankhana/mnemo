import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  Vault,
  ConsentError,
  type ClientSession,
  type EmbeddingProviderName,
} from "@mnemo/core";

const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });
const errorResult = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

const INSTRUCTIONS =
  "Mnemo is the user's personal, consent-gated memory vault, shared across their AI tools. " +
  "Call `memory_search` to recall facts, preferences, or past context the user established before " +
  "answering — especially for personal or project-specific questions. Call `memory_write` to save " +
  "durable facts the user clearly wants remembered for the future. Access is scoped and audited; if a " +
  "call is denied, tell the user to approve this tool in the Mnemo dashboard.";

/**
 * Build an MCP server bound to a single consent-gated {@link ClientSession}.
 * Exposes three tools: search, write, and list-scopes. Consent denials are
 * returned as tool errors (not thrown) so the AI tool can relay them to the user.
 */
export function createServer(session: ClientSession): McpServer {
  const server = new McpServer(
    { name: "mnemo", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "memory_search",
    {
      title: "Search personal memory",
      description:
        "Semantically search the user's personal memory vault for relevant facts, preferences, " +
        "or past context. Returns only memories this tool has been granted permission to read.",
      inputSchema: {
        query: z.string().describe("What to recall, in natural language."),
        k: z.number().int().min(1).max(50).optional().describe("Max results (default 5)."),
        scope: z.string().optional().describe("Restrict the search to a single scope/namespace."),
      },
    },
    async ({ query, k, scope }) => {
      try {
        const hits = await session.search({ query, k: k ?? 5, scope });
        if (hits.length === 0) {
          return textResult(
            "No matching memories found, or no scopes have been approved for this tool yet. " +
              "The user can approve access in the Mnemo dashboard.",
          );
        }
        const text = hits
          .map((h, i) => `${i + 1}. [${h.scope}] ${h.content} (relevance ${h.score.toFixed(2)})`)
          .join("\n");
        return textResult(text);
      } catch (e) {
        if (e instanceof ConsentError) return errorResult(e.message);
        throw e;
      }
    },
  );

  server.registerTool(
    "memory_write",
    {
      title: "Save to personal memory",
      description:
        "Persist a durable fact or preference into the user's personal memory vault so future " +
        "sessions and other AI tools can recall it. Only writes to scopes approved for this tool.",
      inputSchema: {
        content: z.string().describe("The fact to remember, phrased as a standalone statement."),
        scope: z.string().optional().describe("Scope/namespace to store under (default 'general')."),
        metadata: z
          .record(z.string(), z.any())
          .optional()
          .describe("Optional structured tags stored alongside the memory."),
      },
    },
    async ({ content, scope, metadata }) => {
      try {
        const mem = await session.write({ content, scope, metadata });
        return textResult(`Saved to memory (${mem.id}) in scope "${mem.scope}".`);
      } catch (e) {
        if (e instanceof ConsentError) return errorResult(e.message);
        throw e;
      }
    },
  );

  server.registerTool(
    "memory_list_scopes",
    {
      title: "List accessible memory scopes",
      description:
        "List the memory scopes (namespaces) this tool is permitted to read, with descriptions.",
      inputSchema: {},
    },
    async () => {
      const scopes = session.listScopes();
      if (scopes.length === 0) return textResult("No scopes have been approved for this tool yet.");
      return textResult(
        scopes.map((s) => `• ${s.name}${s.description ? ` — ${s.description}` : ""}`).join("\n"),
      );
    },
  );

  return server;
}

export interface RunMcpOptions {
  vaultPath: string;
  clientId: string;
  label?: string;
  embeddings?: EmbeddingProviderName;
  /** Log sink. MUST NOT write to stdout (that channel is the MCP protocol). */
  log?: (msg: string) => void;
}

/** Open the vault and serve the MCP protocol over stdio (for AI-tool configs). */
export async function runStdioServer(opts: RunMcpOptions): Promise<void> {
  const log = opts.log ?? ((m: string) => process.stderr.write(`[mnemo-mcp] ${m}\n`));
  const vault = Vault.open(opts.vaultPath, opts.embeddings ? { embeddings: opts.embeddings } : {});
  const session = vault.client(opts.clientId, opts.label ?? null);
  const server = createServer(session);
  await server.connect(new StdioServerTransport());
  log(`connected as client "${opts.clientId}" (vault: ${opts.vaultPath})`);
}
