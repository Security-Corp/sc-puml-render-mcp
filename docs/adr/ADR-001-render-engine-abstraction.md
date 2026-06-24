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

## Update 2026-06-24 — Faz 0 WASM-in-Node spike

WASM-in-Node: PROVEN

The spike in `spikes/wasm-node-render` produced a valid PNG at
`spikes/wasm-node-render/out/spike.png` headless in Node.js, with no Java, no external Graphviz
binary, no Docker, and no rendering web server. The output was generated from a class diagram,
so the Graphviz-dependent path is covered. `xxd -l 8 -p out/spike.png` returned the PNG magic
bytes `89504e470d0a1a0a`, and macOS `sips` reported a 237x232 PNG.

Answers:

1. **Node support and globals:** `@plantuml/core@1.2026.6` runs in Node, but it is browser-shaped.
   It needs `viz-global.js` loaded before `plantuml.js`, plus Node shims for `window`, `document`,
   `self`, `location`, `DOMParser`, `XMLSerializer`, `Node`, `Element`, `HTMLElement`, and
   `SVGElement`. Because jsdom does not implement layout/canvas rendering, the spike also added
   minimal measurement shims for `HTMLCanvasElement.getContext()`, `SVGElement.getBBox()`,
   `SVGElement.getBoundingClientRect()`, and `SVGElement.getComputedTextLength()`. `Worker` was
   not required for `renderToString`.
2. **Cold start:** Latest local run was ~3.0s total for process setup, first class render, SVG to
   PNG conversion, and package-size inspection. Import/shim setup was ~400ms. The first class SVG
   render was ~308ms; PNG rasterization was ~1.9s. A warmed sequence render then took ~43ms for
   SVG and ~349ms for PNG. Faz 1 should initialize and reuse one renderer environment per server
   process instead of rebuilding it for every tool call.
3. **Graphviz-dependent coverage:** A class diagram rendered successfully through the packaged
   Viz.js/Graphviz path and produced `out/spike.png`. A sequence diagram was also rendered as a
   non-Graphviz baseline.
4. **PNG and SVG:** SVG is available directly from the official `renderToString(lines,
   onSuccess, onError)` API. PNG is not exposed directly by `@plantuml/core`; the spike converts
   the SVG to PNG in-process with `@resvg/resvg-js@2.6.2`.
5. **Shipping / bundle size:** `@plantuml/core@1.2026.6` is MIT-licensed and ~10.13 MiB unpacked
   locally (`plantuml.js` ~6.82 MiB, `viz-global.js` ~1.38 MiB). The installed
   `@resvg/resvg-js@2.6.2` runtime is MPL-2.0-licensed and ~3.42 MiB unpacked on darwin-arm64
   including its native optional package. The spike dependencies are pinned in `pnpm-lock.yaml`
   for reproducibility. Faz 1 can proceed with WASM-first rendering; before promoting the PNG
   rasterizer into the publishable server, review whether MPL-2.0 plus native `resvg-js` optional
   packages are acceptable for npm/MCPB/plugin distribution or whether to switch PNG
   rasterization to a WASM-only resvg build.

Recommended next step: proceed to Faz 1 and implement `WasmEngine` using `@plantuml/core`
`renderToString`, a dedicated Node compatibility shim, and in-process SVG-to-PNG rasterization
after the rasterizer license/packaging choice is confirmed.
