import { fileURLToPath } from "node:url";
import path from "node:path";

export interface SnippetOptions {
  clientId: string;
  label: string;
  /** Use the local built entry (node <abs path>) instead of the published `npx mnemo`. */
  local?: boolean;
}

/** Absolute path to this CLI's built entry (…/packages/cli/dist/index.js). */
function localEntry(): string {
  return path.resolve(fileURLToPath(import.meta.url), "..", "index.js");
}

/**
 * MCP server config block. The same `mcpServers` shape works for Claude Desktop
 * (`claude_desktop_config.json`) and Cursor (`~/.cursor/mcp.json`).
 */
export function mcpServerConfig(opts: SnippetOptions): Record<string, unknown> {
  const server = opts.local
    ? {
        command: process.execPath,
        args: [localEntry(), "mcp", "--client", opts.clientId, "--label", opts.label],
      }
    : {
        command: "npx",
        args: ["-y", "mnemo", "mcp", "--client", opts.clientId, "--label", opts.label],
      };
  return { mcpServers: { mnemo: server } };
}

export function snippetText(opts: SnippetOptions): string {
  return JSON.stringify(mcpServerConfig(opts), null, 2);
}
