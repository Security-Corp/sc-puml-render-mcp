# ADR-001: Pluggable render engine with WASM-first default

- Status: Accepted
- Date: 2026-06-19

## Context

PlantUML is fundamentally a Java application that depends on Graphviz for many diagram types.
There is no mature pure-JS reimplementation of the PlantUML *language*. The available render
paths are:

- **WASM/JS** — the official `plantuml-core` / `plantuml.js` build (TeaVM + Viz.js) runs PlantUML
  entirely in JavaScript with no Java, Graphviz, or server. It is, however, browser-targeted;
  headless Node support is unverified.
- **Local Java (`plantuml.jar`)** — via `node-plantuml` or a subprocess. No web server, but
  requires a JRE (and Graphviz for some diagram types).
- **Remote HTTP server** — encode source and GET from a PlantUML server (public or self-hosted).
  Pure TS on our side, but sends source off-machine unless the user self-hosts.

Constraints: confidentiality (no source off-machine by default) and zero-friction install
(no Java/Graphviz/Docker by default).

## Decision

Define a single `RenderEngine` interface in `core/engine.ts`. Provide three implementations
selected at runtime via config (`engine: wasm | remote | jar`):

- `wasm` — **default**. Self-contained, no external runtime dependencies.
- `remote` — uses a user-supplied `PLANTUML_SERVER_URL` (their own / company server). This is
  the "user's own web server" and IDE-plugin-style flexibility requirement.
- `jar` — local Java fallback.

`core` depends only on the interface, never on a concrete engine.

## Consequences

- The "zero-dependency default" claim hinges on the WASM-in-Node spike (Faz 0). If it fails, the
  default falls back to `jar` and the install story changes — this ADR would be superseded.
- Adding a future engine (e.g. a different WASM build) is a new file in `engines/`, no changes
  to `core` or `tools`.
- Config surface stays small: one engine selector plus engine-specific options.
