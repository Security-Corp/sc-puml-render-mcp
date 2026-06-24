# Architecture — sc-puml-render-mcp (arc42-lite)

## 1. Introduction & Goals

`sc-puml-render-mcp` is an MCP server that renders PlantUML source to images so diagrams appear
**inline in the Claude Desktop / Claude Code chat**.

Quality goals, in priority order:

1. **Confidentiality** — diagram source must not leave the user's machine by default
   (banking/financial-sector context).
2. **Zero-friction install** — works with no Java, Graphviz, Docker, or web server in the
   default configuration.
3. **Fidelity** — full PlantUML language support, including `!include` and stdlib (C4, ArchiMate).
4. **Flexibility** — render path is swappable (local WASM, user's own server, local Java).

## 2. Constraints

- Must speak MCP over **stdio** (Desktop / Claude Code local connector model).
- Inline rendering requires returning an MCP **`image` content block** (base64).
- Distribution target is **MCPB** (desktop extension) + npm; directory submission needs a
  privacy policy and per-tool read-only/destructive annotations.

## 3. Context

```
[ Claude Desktop / Claude Code ]
            │  MCP (stdio)
            ▼
   [ sc-puml-render-mcp server ]
            │
   ┌────────┼─────────────┐
   ▼        ▼             ▼
[wasm]   [remote]       [jar]          ← RenderEngine implementations
 local    user's PlantUML  local Java
 (WASM)   server (HTTP)     (fallback)
```

Diagram source reaches the server three ways: pasted text (most common, via tool chaining with
Claude's GitHub/filesystem connectors), a local file path (`filesystem` source), or — later —
a GitHub coordinate resolved by the server for `!include` chains.

## 4. Building blocks

- `transport` (`index.ts`, `server.ts`) — MCP stdio bootstrap and tool registration.
- `tools/` — `render_diagram`, `validate`, `resolve_includes`. Each declares its annotation
  (all currently read-only). Tools orchestrate; they hold no rendering logic.
- `core/`
  - `engine.ts` — `RenderEngine` interface (the seam ADR-001 is built on).
  - `image-result.ts` — wraps raster bytes into an MCP image content block.
  - `include-resolver.ts` — builds the `!include` graph from a `Source`.
- `engines/` — `wasm-engine` (default), `remote-engine`, `jar-engine`.
- `sources/` — `text-source`, `filesystem-source` (GitHub source is Faz 3+).

Dependency rule: `tools` → `core` → interfaces only. `core` never imports a concrete engine or
source.

## 5. Runtime

`render_diagram(source, format?) → image block`:
1. Resolve source to raw PlantUML text (incl. `!include` resolution where applicable).
2. Pass text to the configured `RenderEngine`.
3. Engine returns raster bytes (PNG default).
4. Wrap as `image` content block; optionally attach SVG as a separate resource.

## 6. Key decisions

See `docs/adr/`:
- ADR-001 — Pluggable render engine, WASM-first default.
- ADR-002 — Apache-2.0 license.
- ADR-003 — GitHub access via tool chaining, no embedded auth in MVP.
- ADR-004 — Inline PNG, SVG as an additional resource.

## 7. Risks

- **WASM-in-Node (highest):** `plantuml.js` is browser-targeted; headless Node support is
  unproven. Mitigated by the Faz 0 spike; fallback is the `jar` engine.
- **Remote include injection:** `!includeurl` can fetch arbitrary URLs. Mitigated by allowlist
  + depth/size limits.
- **Inline image size:** large diagrams as base64 PNG may strain the chat. Consider scaling/DPI
  caps and SVG-as-resource for big outputs.
