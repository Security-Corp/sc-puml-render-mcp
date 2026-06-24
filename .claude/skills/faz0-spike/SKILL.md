---
name: faz0-spike
description: >
  Execute the Faz 0 spike for sc-puml-render-mcp: prove (or disprove) that the official
  PlantUML WASM/JS build can render headless in Node.js. Use when starting Faz 0, or
  when asked to run/finish the WASM-in-Node spike under spikes/wasm-node-render.
allowed-tools: Read, Write, Edit, Bash
---

# Faz 0 — WASM PlantUML headless-in-Node spike

You are executing the single highest-risk experiment in this project. Read `AGENTS.md`
(root) first for the invariants and the "do NOT" list. The decision this spike informs is
ADR-001.

## The one question

> Can the official PlantUML WASM/JS build (`plantuml-core` / `plantuml.js`, TeaVM + Viz.js)
> render a diagram **headless in Node.js**, with no Java, no Graphviz, and no web server?

- If **YES** → the "zero-dependency default engine" thesis holds. We build `WasmEngine`
  (Faz 1) on whatever entrypoint you validate here.
- If **NO** → we fall back to the `jar` engine, and you must update ADR-001 (or open
  ADR-005) and revise the install story in README/AGENTS.

## Where you work

- Spike package: `spikes/wasm-node-render` (already scaffolded; `index.ts` has TODOs).
- This is throwaway code. Keep it minimal. Do not touch `packages/server` in this spike.

## Exit criterion (binary)

A real, openable **PNG written to `spikes/wasm-node-render/out/spike.png`** from a hard-coded
`.puml` string, produced entirely in Node with no Java/Graphviz/server process. Anything less
is "not proven".

## What to find out and record

Answer these and write the findings into `docs/adr/ADR-001-render-engine-abstraction.md`
(append an "Update 2026-xx-xx" section) — or open `docs/adr/ADR-005-*.md` if the conclusion
changes the architecture:

1. Does it run in Node at all? Which browser globals (`window`, `document`, `self`,
   `Worker`) does it expect, and can they be shimmed (e.g. jsdom) cleanly — or is it a
   non-starter?
2. Cold-start time for a single render. Do we need to warm/reuse an instance per process?
3. Does it cover Graphviz-dependent diagram types (class, component, state) — not just
   sequence diagrams? Test at least one Graphviz-dependent type.
4. Are both PNG and SVG outputs obtainable?
5. How does it ship / bundle size? (This feeds MCPB packaging in Faz 4.)

## Method

1. Verify the exact current npm package name(s) and API before coding — the ecosystem moves
   fast; do not trust a remembered import path. Check the package's own README/examples.
2. Wire the chosen package into `spikes/wasm-node-render/index.ts`, replacing the "NOT YET
   IMPLEMENTED" throw. Render the sample to PNG bytes, write `out/spike.png`, assert the file
   starts with the PNG magic bytes.
3. Add a second test source using a Graphviz-dependent diagram type (question 3).
4. Run `pnpm -F wasm-node-render dev`. Iterate until it passes or you can clearly state why
   it cannot.
5. Record the verdict + the five answers in the ADR. State the verdict in one line at the top:
   `WASM-in-Node: PROVEN` or `WASM-in-Node: REJECTED (reason)`.

## Constraints (from AGENTS.md — do not violate)

- No web server in the connector. The spike must not spin up an HTTP server to render.
- The default path must not depend on Java/Graphviz/Docker — that is the whole point here.
- If you find yourself reaching for the jar to "make the spike pass", stop: that is the
  REJECTED outcome, not a success. Report it honestly.

## Stop and report when

- The PNG is produced (PROVEN), or
- You have a concrete, evidenced reason it can't work headless in Node (REJECTED).

Either way: update the ADR, summarize the verdict and the five answers, and recommend the
next step (Faz 1 on WASM, or pivot to the jar engine).
