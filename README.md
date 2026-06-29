# Mnemo

**Your memory. Your rules.** A user-owned memory layer that every AI tool can share — local-first, consent-gated, and fully auditable.

> Stop re-explaining yourself to every assistant. Mnemo gives you **one** memory that Claude, Cursor, and any [MCP](https://modelcontextprotocol.io)-speaking tool can draw from — while *you* decide exactly what each tool may read or write, and see everything it did.

---

## The problem

Every AI tool builds its own siloed memory of you. Claude doesn't know what you told ChatGPT. Cursor doesn't know your stack. That memory is locked inside each vendor — you can't see it, export it, or control it. Your context is your most valuable data, scattered across companies that own it instead of you.

## What Mnemo does

Mnemo is a small local daemon that holds your memories in a single SQLite file and exposes them over the Model Context Protocol. Any AI tool connects to the same vault — but nothing is shared by default.

Four guarantees, true from day one:

| | |
|---|---|
| 🗄️ **You own it** | One local SQLite file. Full JSON export anytime. No vendor lock-in. |
| 🔌 **Cross-tool** | One memory, exposed via MCP to Claude Desktop, Cursor, and any MCP client. |
| 🛂 **Consent-gated** | Default-deny. Each tool gets per-scope read/write grants (e.g. *Cursor: read `tech`, never `health`*). |
| 📜 **Auditable** | Every access — allowed or denied — is recorded: who, when, which scope. |

This is the difference from framework memory (mem0, Letta) and vendor memory: Mnemo's wedge is **ownership + cross-tool + consent/audit**, not features.

---

## Quickstart

> Requires **Node ≥ 22** (Mnemo uses the built-in `node:sqlite` — no native build, no external services).

```bash
git clone <your-fork> mnemo && cd mnemo
pnpm install
pnpm build

# launch your private dashboard
node packages/cli/dist/index.js
# → http://127.0.0.1:4319
```

Add a memory and search it, all locally:

```bash
node packages/cli/dist/index.js add "I prefer TypeScript and pnpm" --scope tech
node packages/cli/dist/index.js search "language preferences"
```

*(Once published to npm, the same commands become `npx mnemo …`.)*

## Connect an AI tool

Generate a config block:

```bash
node packages/cli/dist/index.js config --client claude-desktop
```

Paste it into your tool:

- **Claude Desktop** → `claude_desktop_config.json` (Settings → Developer → Edit Config)
- **Cursor** → `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "mnemo": {
      "command": "npx",
      "args": ["-y", "mnemo", "mcp", "--client", "claude-desktop", "--label", "Claude Desktop"]
    }
  }
}
```

The tool now appears in your dashboard under **Clients & Consent** as *pending*. Grant it a scope and it can start remembering — within the limits you set. Try asking your assistant to "remember that I prefer dark mode," then ask a fresh chat (or a different tool) "what theme do I prefer?"

---

## How it works

```
┌─────────────────┐     MCP (stdio)      ┌──────────────────────┐
│  AI tools       │ ───────────────────▶ │  mnemo mcp           │
│  Claude/Cursor  │  search/write/scopes │   → ClientSession    │  consent-gated
└─────────────────┘                      │      ↓ enforce + log │  + audited
                                         ├──────────────────────┤
   Browser ──── localhost dashboard ───▶ │  AdminApi (owner)    │  full control
                                         └──────────┬───────────┘
                                                    ▼
                                       SQLite (memories · scopes ·
                                       grants · audit) + embeddings
```

Two API surfaces over one vault:

- **`ClientSession`** — what AI tools get. Every `write`/`search`/`listScopes` is checked against the consent engine and written to the audit log first. Out-of-scope memories are never even returned.
- **`AdminApi`** — what *you* get (dashboard + CLI). Full access to manage memories, grants, and review the audit trail.

Search is semantic: memories are embedded into vectors and ranked by cosine similarity. The default embedder is **local and dependency-free** (so `npx` works everywhere); a `fastembed` (ONNX) provider plugs into the same interface for higher-quality semantic recall.

---

## CLI reference

```
mnemo [dashboard]                 Start the local dashboard (default)
mnemo mcp --client <id> [--label] Run the MCP server over stdio (for AI tools)
mnemo config [--client <id>]      Print an MCP config snippet
mnemo grant <client> <scope>      Grant access (--read --write; default both; scope "*" = all)
mnemo revoke <client> <scope>     Revoke a grant
mnemo add <text...> [--scope s]   Add a memory as the owner
mnemo search <query...>           Semantic search across all scopes
mnemo clients | scopes            List clients / scopes
mnemo audit [--limit n]           Show recent audit entries
mnemo export [--out file.json]    Export the whole vault as JSON
```

**Environment:** `MNEMO_HOME` (vault dir, default `~/.mnemo`) · `MNEMO_PORT` (default `4319`) · `MNEMO_EMBEDDINGS` (`lexical` | `fastembed`).

## MCP tools exposed

- `memory_search(query, k?, scope?)` — recall relevant memories the tool may read.
- `memory_write(content, scope?, metadata?)` — persist a durable fact (if granted).
- `memory_list_scopes()` — list scopes the tool is allowed to read.

Consent denials are returned to the model as a friendly tool error, so it can ask you to approve access — it never crashes.

---

## Privacy & data

Everything lives in one file: `~/.mnemo/mnemo.db`. The dashboard binds to `127.0.0.1` only. Nothing leaves your machine. Export or delete the file at any time — that's the whole point.

## Roadmap (open-core)

The local core is, and stays, free and open. Planned layers:

- **`fastembed` provider** — high-quality local semantic embeddings.
- **End-to-end-encrypted sync** — your vault across devices, zero-knowledge.
- **Team / shared vaults** — scoped, audited memory for collaborators.
- **Policy templates & SSO** — for organizations.

The storage layer already writes records as self-contained envelopes so the sync layer slots in without a data-model rewrite.

## Development

```bash
pnpm build          # compile all packages
pnpm test           # core unit tests
pnpm test:all       # core + MCP integration tests
```

Monorepo layout: `packages/core` (vault, embeddings, consent, audit) · `packages/mcp` (MCP server) · `packages/cli` (`mnemo` + dashboard).

## License

MIT — see [LICENSE](LICENSE).
