# AGENTS.md — sc-puml-render-mcp

> Single source of truth for any AI coding agent (Claude Code, Cursor, Copilot, other LLMs)
> working in this repository. The root `CLAUDE.md` imports this file. Keep it high-signal:
> agents reliably follow ~150–200 distinct instructions, so prefer clarity over completeness.

## What this is

`sc-puml-render-mcp` is an open-source **Model Context Protocol (MCP) server** that renders
PlantUML source into images so the diagram appears **inline in MCP-compatible chat clients**
(Claude Desktop / Claude Code and OpenAI Codex). The differentiators over existing PlantUML MCP servers are: (1) a **self-contained,
dependency-free default render path** (no Java, no Graphviz, no web server), (2) **pluggable
render engines**, and (3) **`!include` graph resolution** for multi-file arc42 / C4 diagrams.

Target users develop and use this on banking / financial-sector machines, so **not leaking
diagram source to external servers by default** is a hard requirement, not a preference.

## Tech & conventions

- **Language:** TypeScript (strict). ESM modules.
- **Monorepo:** pnpm workspaces. Publishable connector lives in `packages/server`. Throwaway
  experiments live in `spikes/*` as isolated workspace packages.
- **Architecture:** Clean architecture. Dependencies point inward: `tools/` → `core/` →
  (`engines/`, `sources/`). `core/` must not import from `engines/` or `sources/` concretely —
  only via interfaces defined in `core/`.
- **Principles:** SOLID, KISS. No over-engineering. Fix root causes, not symptoms. If a change
  feels like a workaround, stop and surface the real problem instead.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

## Commands

> These reflect intended setup; wire them up as the project is built. Do not assume a command
> exists — check `package.json` first.

```
pnpm install                  # install workspace deps
pnpm -F server build          # compile the connector
pnpm -F server test           # unit tests
pnpm -F wasm-node-render dev   # run the Faz 0 spike
```

## Architecture invariants (do not violate)

1. **Tools return an MCP `image` content block** (base64) so Claude renders inline. PNG is the
   inline-safe format; SVG is offered additionally as a resource/file, never relied on for
   inline display. See ADR-004.
2. **All rendering goes through the `RenderEngine` interface** (`core/engine.ts`). Concrete
   engines (`wasm`, `remote`, `jar`) are selected at runtime via config. See ADR-001.
3. **`wasm` is the default engine.** It must work with zero external runtime dependencies.
   `remote` (user-supplied `PLANTUML_SERVER_URL`) and `jar` (local Java) are opt-in fallbacks.
4. **Default behaviour must not send diagram source off-machine.** `remote` engine is only used
   when the user explicitly configures a server URL.
5. **GitHub access is via tool chaining, not embedded auth.** For single files, Claude's own
   GitHub connector fetches the text and passes it to the render tool. This server does NOT
   implement GitHub OAuth in the MVP. See ADR-003.
6. **`!include` / `!includeurl` resolution is security-sensitive.** Remote includes are an
   injection surface. Resolve local includes first; gate remote includes behind an explicit
   allowlist and a depth/size limit.
7. **Keep the server host-agnostic.** The core is a standard stdio MCP server with no
   Claude-specific or Codex-specific assumptions. Host integration (Claude Code plugin, Claude
   Desktop MCPB, Codex `config.toml` / plugin) lives in thin distribution wrappers, never in
   `core/` or `tools/`. See ADR-005.

## Do NOT

- Add an HTTP/web server to the connector to do rendering. The connector renders in-process.
- Make the default path depend on Java, Graphviz, or Docker.
- Send PlantUML source to the public plantuml.com server (or any external server) unless the
  user explicitly set `PLANTUML_SERVER_URL`.
- Embed GitHub OAuth or store GitHub tokens in the MVP.
- Introduce browser-only globals into the server runtime without a Node compatibility shim
  (this is exactly the Faz 0 spike risk for the WASM engine).

## Roadmap (phases)

- **Faz 0 — Spike (highest risk first):** prove `plantuml-core` / `plantuml.js` renders headless
  in Node. Output: a PNG written to disk from a `.puml` string. If it fails, fall back to the
  `jar` engine and revise the "zero-dependency" claim. → `spikes/wasm-node-render`
- **Faz 1:** `render_diagram` tool + inline PNG result via the `wasm` engine.
- **Faz 2:** `!include` resolver + `filesystem` source.
- **Faz 3:** `remote` and `jar` engines behind config (covers "user's own server" + IDE-plugin-
  style flexibility).
- **Faz 4:** distribution — Claude Code plugin (marketplace) + Claude Desktop MCPB + Codex
  (`config.toml` / `codex plugin`), `PRIVACY.md`, and submissions. Core stays one npm package.

## Where to read more

- `docs/architecture.md` — arc42-lite system overview.
- `docs/adr/` — the binding decisions and their rationale. Read these before changing
  architecture; if you must deviate, add a new ADR rather than silently overriding one.
- `.claude/skills/` — reusable, team-shared playbooks invoked as `/name` (e.g. faz0-spike).
  This is where recurring prompts live; do not archive throwaway chat prompts here.
