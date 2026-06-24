# ADR-005: Cross-tool distribution — one host-agnostic MCP server, thin per-host wrappers

- Status: Accepted
- Date: 2026-06-24

## Context

The connector must be usable from both **Claude Code / Claude Desktop** and **OpenAI Codex**
(CLI + desktop), and ultimately published to a plugin marketplace. MCP is an open standard, so
the same stdio server can serve every host — but each host registers and packages MCP servers
differently:

- **Claude Code:** `claude mcp add ...` (JSON config); plugin marketplace for distribution.
- **Claude Desktop:** MCPB desktop extension.
- **Codex:** `codex mcp add <name> -- <command>` writing TOML to `~/.codex/config.toml` (or a
  trusted project `.codex/config.toml`); separate `codex plugin` marketplace. Codex also reads
  `AGENTS.md` and lets an MCP server advertise an `instructions` field.

## Decision

The **core deliverable is a single, host-agnostic stdio MCP server published to npm** as
`sc-puml-render-mcp`. The server makes **no Claude-specific (or Codex-specific) assumptions**.
Host integration is handled by **thin distribution wrappers around the same server**, not by
forking the core:

- npm package — the canonical artifact; any MCP client can run it via `npx`.
- Claude Code plugin (marketplace) + Claude Desktop MCPB extension.
- Codex: documented `config.toml` snippet / `codex mcp add` command, and later a `codex plugin`.

`AGENTS.md` stays the shared instruction source (both Claude Code and Codex read it). The
server's MCP `instructions` should be kept short and self-contained (Codex emphasizes the first
~512 chars).

## Consequences

- One codebase, one test surface; distribution differences are config/manifest only.
- **Open risk (verify, do not assume):** the core feature is *inline image rendering*. Claude
  renders MCP `image` content blocks inline. Whether **Codex desktop renders inline images from
  MCP tool results** is unconfirmed — this is the Codex-side equivalent of the Faz 0 risk. If it
  does not, provide a graceful fallback (write file + return path/resource) for that host.
- Avoid host-specific branching in `core/` and `tools/`. If a host needs special handling, it
  belongs in a wrapper or in config, and gets its own ADR.
