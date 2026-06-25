# sc-puml-render-mcp

An open-source **Model Context Protocol (MCP) server** that renders [PlantUML](https://plantuml.com)
diagrams **inline in the Claude Desktop / Claude Code chat**.

Write PlantUML in a design conversation, get the rendered diagram back in the same chat — no
context switching to a separate tool, and (by default) **without sending your diagram source to
any external server**.

> Status: early development. See [`AGENTS.md`](./AGENTS.md) and [`docs/`](./docs) for the design.

## Why another PlantUML MCP server?

Most existing PlantUML MCP servers either return a file path / URL (no inline render) or depend
on Java, Graphviz, or an external PlantUML server. This one aims for:

- **Inline rendering** — returns an image content block the chat displays directly.
- **Self-contained default** — a WASM render engine with no Java / Graphviz / Docker / web server.
- **Confidential by default** — diagram source stays on your machine unless you opt into a remote
  engine.
- **Pluggable engines** — `wasm` (default), `remote` (your own PlantUML server), `jar` (local Java).
- **`!include` resolution** — for multi-file arc42 / C4 diagrams.

## Install as a Claude Code plugin

This repo ships a Claude Code plugin + marketplace at its root (`.claude-plugin/`), so you can
install the server straight from the GitHub repo — no npm publish, no public marketplace.

**Prerequisite — build the server first.** The plugin launches the built output and its runtime
dependencies, which are not committed. Build them once:

```bash
pnpm install
pnpm -F server build      # produces packages/server/dist/index.js
```

**Add the marketplace and install** (in Claude Code):

```text
/plugin marketplace add Security-Corp/sc-puml-render-mcp
/plugin install sc-puml-render@sc-puml-render-mcp
```

To test against your local working tree instead of GitHub, add it by path:

```text
/plugin marketplace add /absolute/path/to/sc-puml-render-mcp
/plugin install sc-puml-render@sc-puml-render-mcp
```

Restart Claude Code (or run `/reload-plugins`) so the MCP server loads. You then have three tools:
`render_diagram`, `resolve_includes`, and `validate`, all running in-process with the default
`wasm` engine — no Java / Graphviz / Docker, and your diagram source never leaves the machine.

**Private repo note.** `sc-puml-render-mcp` is a private repository. `/plugin marketplace add`
clones it using **your own git credentials** (`gh auth login`, or an SSH key in your agent). No
token or credential is stored in this repo — installation relies entirely on your existing access.

**Example prompt** (once installed):

> Render this PlantUML inline:
> ```
> @startuml
> Alice -> Bob: Authenticate
> Bob --> Alice: Token
> @enduml
> ```

Claude calls `render_diagram` and the diagram appears inline as a PNG. Use `validate` to check
syntax without rendering, and `resolve_includes` to expand `!include` graphs for multi-file
diagrams.

## Status / roadmap

- [ ] **Faz 0** — Prove WASM PlantUML renders headless in Node (`spikes/wasm-node-render`).
- [ ] **Faz 1** — `render_diagram` tool + inline PNG via the WASM engine.
- [ ] **Faz 2** — `!include` resolver + filesystem source.
- [ ] **Faz 3** — `remote` + `jar` engines behind config.
- [ ] **Faz 4** — MCPB packaging + Anthropic MCP directory submission.

## Repository layout

```
packages/server   # the publishable MCP connector
spikes/*          # throwaway experiments (Faz 0 lives here)
docs/             # architecture (arc42-lite) + ADRs
```

## License

[Apache-2.0](./LICENSE)
