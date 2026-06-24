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
