# Project Plan — sc-puml-render-mcp

> Standalone delivery plan. The binding authority is still `AGENTS.md` (invariants) and
> `docs/adr/` (decisions). This file adds the per-phase task breakdown, acceptance criteria,
> and sequencing that those documents don't spell out. If this plan and an ADR disagree, the
> ADR wins — update this plan, not the ADR.

## 1. Goal

Ship an open-source MCP server, `sc-puml-render-mcp`, that renders PlantUML **inline** in
MCP-compatible chat clients (Claude Desktop / Claude Code and OpenAI Codex), and publish it to
the relevant plugin marketplaces. Default render path must require no Java, external Graphviz
binary, Docker, or rendering web server, and must not send diagram source off-machine.

## 2. Scope

**In scope (MVP → v1):**
- `render_diagram` — PlantUML text → inline PNG (+ SVG as resource).
- Pluggable render engines: `wasm` (default), `remote` (user's server), `jar` (fallback).
- `!include` graph resolution + `filesystem` source.
- `validate` and `resolve_includes` tools.
- Distribution: npm package, Claude Code plugin, Claude Desktop MCPB, Codex config/plugin.

**Out of scope (MVP):**
- Embedded GitHub OAuth (rely on tool chaining — ADR-003).
- Remote private-repo `!include` chains (deferred to Faz 3+).
- Any HTTP server inside the connector.

## 3. Architecture (summary)

Clean architecture, dependencies inward: `tools/ → core/ → (engines/, sources/)`. All rendering
goes through the `RenderEngine` interface (ADR-001). Tools return an MCP `image` content block
for inline display (ADR-004). The server is host-agnostic; per-host packaging lives in thin
wrappers (ADR-005). Full detail in `docs/architecture.md`.

## 4. Phases, deliverables, acceptance criteria

### Faz 0 — WASM-in-Node spike (HIGHEST RISK, do first)
- **Status:** Complete — `WASM-in-Node: PROVEN` on 2026-06-24.
- **Deliverable:** working render in `spikes/wasm-node-render` producing a valid PNG to
  `out/spike.png` from a `.puml` string, headless in Node, no Java/Graphviz/server.
- **Acceptance:** the PNG opens and is valid; a Graphviz-dependent diagram type (class/component)
  also renders; the 5 questions in `.claude/skills/faz0-spike/SKILL.md` are answered in an ADR
  update.
- **Exit:** verdict recorded — `WASM-in-Node: PROVEN` (proceed to Faz 1) or `REJECTED` (revise
  ADR-001, pivot default to `jar`).

### Faz 1 — Core render tool + inline
- **Status:** Complete on 2026-06-24.
- [x] `WasmEngine` implemented on the proven `@plantuml/core` `renderToString` path.
- [x] One PlantUML/jsdom renderer environment initialized and reused per process.
- [x] SVG-to-PNG rasterization uses `@resvg/resvg-wasm` with bundled DejaVu TrueType fonts.
- [x] `render_diagram` registered on an MCP stdio server and returns inline PNG `image` content.
- [x] SVG is exposed as an MCP resource content block, not as inline SVG.
- [x] Automated smoke/fidelity test asserts valid PNG magic bytes, SVG resource, one text-heavy
  diagram, and component + state Graphviz-dependent diagrams.
- [x] Automated MCP stdio client smoke test calls `render_diagram` through the built server.
- **Acceptance:** `pnpm test` passes at the workspace root. A real-host inline rendering check is
  still part of Faz 4 distribution verification.

### Faz 2 — Includes + filesystem source
- **Status:** Complete on 2026-06-25.
- [x] `FilesystemSource` reads local PlantUML files within a configured base directory.
- [x] Path traversal and symlink escapes are rejected after canonical `realpath` checks.
- [x] `include-resolver` flattens local `!include`, `!include_many`, and `!include_once` graphs.
- [x] `!includeurl` is denied by default and fetched only for explicitly allowlisted hosts.
- [x] Include cycle detection, maximum depth, and total size limits are enforced.
- [x] `resolve_includes` returns flattened PlantUML text.
- [x] `validate` returns structured `{ ok, line?, message?, suggestion? }` results.
- [x] `render_diagram` accepts either inline source or a file path and resolves includes before
  rendering.
- **Acceptance:** `pnpm test` passes at the workspace root, including traversal, symlink escape,
  remote allowlist deny/allow, cycle, depth, size, validate, and MCP stdio registration tests.

### Faz 3 — Remote + jar engines
- **Deliverable:** `RemoteEngine` (encode + GET/POST to `PLANTUML_SERVER_URL`) and `JarEngine`
  (local Java), both selectable via config.
- **Acceptance:** all three engines render the same sample; missing-JRE yields a clear error;
  default never sends source off-machine.

### Faz 4 — Distribution
- **Deliverable:** npm publish; Claude Code plugin (marketplace); Claude Desktop MCPB; Codex
  `config.toml` snippet + `codex plugin`; finalized `PRIVACY.md` at a public URL.
- **Acceptance:** installable in each host via its native mechanism; per-tool annotations
  accurate; ≥3 working example prompts documented.
- **Open verification:** confirm Codex desktop renders MCP `image` content blocks inline; if not,
  ship a file-path fallback for that host (ADR-005).

## 5. Risks

| Risk | Phase | Mitigation |
|---|---|---|
| WASM PlantUML won't run headless in Node | 0 | Spike first; fall back to `jar`, revise ADR-001 |
| Codex doesn't render inline images | 4 | Verify early; file-path fallback per host |
| `!includeurl` injection | 2 | Allowlist + depth/size limits |
| Large PNG strains chat | 1–2 | DPI/scale caps; prefer SVG-as-resource for big diagrams |

## 6. Definition of done (v1)

A user on a banking-sector machine installs the connector in Claude Code (or Codex), writes
PlantUML in chat, and sees the rendered diagram inline — with no Java/Graphviz/Docker installed
and no diagram source leaving their machine — and the package is published and installable from
at least one marketplace.

## 7. Working model

Build phase by phase; do not start a phase before the previous phase's exit criterion is met.
Each architectural deviation is a new ADR. Commits follow Conventional Commits.
