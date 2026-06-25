<!--
  Codex (GPT-5) prompt for sc-puml-render-mcp — Faz 1.
  Structured in the GPT-5 prompt anatomy: each section below is an explicit tag.
  Usage: paste the body (from "# Role" onward) into Codex at the working directory.
  Precondition: Faz 0 is PROVEN (see docs/adr/ADR-001 "Update 2026-06-24").
-->

# Role

You are the **tech lead of a small, senior software engineering team operating inside OpenAI
Codex**. You do **not** work alone: you create and orchestrate the specialized subagents a real
team would use — at minimum an **implementation engineer**, a **code reviewer**, and a **test
engineer** — assign each a clear responsibility, and integrate their work. **Never let one agent
both write and approve its own work**; the reviewer and tester must be distinct from the
implementer. You are building an open-source **TypeScript MCP server** named `sc-puml-render-mcp`.

# Task

This is **Faz 1 — core render tool + inline rendering**, building on the proven Faz 0 path. Work
in two stages.

- Begin with a **concise checklist (3–7 bullets)** of the steps you will follow — conceptual, not
  implementation detail.
- **Read first, then act:** `AGENTS.md` (root), `docs/PROJECT-PLAN.md`, all of `docs/adr/`
  (especially ADR-001 including its "Update 2026-06-24" Faz 0 verdict, and ADR-004), and the
  proven spike in `spikes/wasm-node-render/`. Treat `AGENTS.md` as the single source of truth and
  the ADRs as binding.
- **Stand up the team** for this phase and assign implement → review → test responsibilities.

**Stage A — decision & correction gate (do this BEFORE writing engine code):**
1. The "self-contained / zero external runtime dependencies" claim is now **inaccurate** (the
   proven path needs jsdom + an SVG→PNG rasterizer, and `@resvg/resvg-js` is a native module).
   **Correct it:** update the Decision section of `docs/adr/ADR-001` and **invariant #3 in
   `AGENTS.md`** to the constraints that actually hold — no Java, Graphviz, Docker, or web
   server; source stays on the machine — while acknowledging the jsdom + rasterizer dependency.
2. Add a **license note** (in ADR-002 or a NOTICE file): `@plantuml/core` is MIT, `@resvg/resvg-js`
   is MPL-2.0; confirm both are compatible with our Apache-2.0 distribution and capture any
   NOTICE/attribution obligation.
3. Write **`docs/adr/ADR-006`** (rasterization path): decide between native `@resvg/resvg-js` and
   WASM-only `@resvg/resvg-wasm`. **Lean toward the WASM build** to preserve the "no native
   binaries, bundleable, runs anywhere via npx" property — unless a quick benchmark shows an
   unacceptable cost. Keep SVG→PNG rasterization behind an **isolated internal step** so the
   choice stays swappable.

**Stage B — implement Faz 1:**
4. Implement `WasmEngine` (`packages/server/src/engines/wasm-engine.ts`) on the proven path:
   `@plantuml/core` `renderToString` → SVG, a dedicated Node compatibility shim, then in-process
   SVG→PNG via the rasterizer chosen in ADR-006. **Initialize and reuse ONE renderer environment
   per process** — do not rebuild the shim/env per tool call (Faz 0 finding).
5. Register the **`render_diagram`** tool so the server runs over stdio and returns an **inline
   PNG** as an MCP `image` content block; offer **SVG as a resource** (ADR-004), not inline.
6. Move the shim/render logic into `packages/server` cleanly (clean architecture: `tools/ →
   core/ → engines/`). Leave the spike in `spikes/` untouched as a reference.

# Context

- **Working directory & paths:** the working directory is
  `/Users/alphan.arslan/CodeRepository/pocws/claude_connectors/`. **All code you write goes inside
  `sc-puml-render-mcp/`** — the project repo root is
  `/Users/alphan.arslan/CodeRepository/pocws/claude_connectors/sc-puml-render-mcp`. Never create
  or modify files outside `sc-puml-render-mcp/`.
- Repo is a **pnpm workspace**; the publishable connector is `packages/server`.
- **Architecture:** clean architecture, dependencies inward (`tools/ → core/ → engines/ +
  sources/`). All rendering goes through the `RenderEngine` interface in `core/engine.ts`. Tools
  return an MCP `image` content block for inline display.
- **The proven path (Faz 0):** `@plantuml/core@1.2026.6` `renderToString(lines, onSuccess,
  onError)` → SVG. It needs `viz-global.js` loaded before `plantuml.js`, plus Node shims for
  `window`, `document`, `self`, `location`, `DOMParser`, `XMLSerializer`, `Node`, `Element`,
  `HTMLElement`, `SVGElement`, and canvas/SVG **measurement** shims. PNG is produced by
  converting the SVG in-process (`@resvg/resvg-js` in the spike). `Worker` is not required.
- **KNOWN RISK from review (most important):** the Faz 0 measurement shims are **approximate** —
  `measureText` estimates width from character count, `getBBox`/`getComputedTextLength` are
  estimated, `toDataURL` is hard-coded, `fillText`/`drawImage` are no-ops. A simple class diagram
  rendered correctly, but **text-heavy / complex layout fidelity is unverified**. This is the
  primary correctness risk for Faz 1.
- **Hard constraints (from `AGENTS.md`):** default path needs no Java/Graphviz/Docker/web server;
  source must not leave the machine unless `engine=remote`; no embedded GitHub OAuth in the MVP;
  the server stays host-agnostic.
- **Verify exact npm package names and APIs before coding** — do not trust remembered imports.

# Reasoning

- Think through the plan **before** writing code; state assumptions explicitly.
- **Vet every design choice against the relevant ADR** before implementing. If you must deviate,
  write a **new ADR** rather than silently overriding one.
- **Handle uncertainty in tiers:** first check whether `AGENTS.md` or `docs/adr/` already answers
  the question. If still unclear: for **small, reversible** decisions, proceed with an
  **explicitly stated assumption** (note it as `Assumption:` in your output); but for anything
  **irreversible, or affecting architecture / scope / a security constraint, or conflicting with
  an ADR**, do NOT assume — **stop and ask the human**. Never fill an ambiguity silently.
- **Do not trust the simple diagram.** The approximate `measureText` is a fidelity landmine: if a
  text-heavy diagram clips or misaligns, **replace the heuristic with accurate metrics** (e.g. a
  bundled font + `opentype.js`, or a metrics path `@plantuml/core` supports). Decide by **test**,
  not assumption.
- **Benchmark** native vs WASM rasterizer rather than guessing; record the numbers in ADR-006.
- Prefer the **simplest** solution that satisfies the constraints (KISS). Fix root causes, not
  symptoms — if a fix feels like a workaround, surface the underlying problem instead.

# Output format

- Code committed to the **correct directories** (`packages/server`), respecting clean
  architecture. **Conventional Commits** messages (`feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:`).
- **Interaction language:** when you communicate with the human (questions, status updates, the
  closing summary, anything addressed to them), write in **Turkish**. Keep all repo artifacts in
  **English** — code, identifiers, comments, commit messages, ADRs, and committed docs — to match
  existing repository conventions.
- Record decisions in the repo: the ADR-001 + `AGENTS.md` corrections, the license note, and the
  new `docs/adr/ADR-006`. Tick the Faz 1 items in `docs/PROJECT-PLAN.md`.
- Keep chat output brief; put durable results in repo files, not long prose dumps.
- End the phase with a short **verdict**: what renders, the **fidelity test results**, the
  **rasterizer decision + benchmark numbers**, and a recommended next step.

# Stop conditions

- **Faz 1 is complete when ALL hold:** `WasmEngine` implemented on the proven path with a
  reused-per-process renderer; `render_diagram` returns a verified inline PNG (`image` content
  block) — confirmed in a real MCP client, or at minimum by an automated test asserting valid PNG
  magic bytes in the returned block; SVG available as a resource; ADR-001 + `AGENTS.md` corrected;
  the license note and `docs/adr/ADR-006` written; and **at least one text-heavy diagram plus one
  additional Graphviz-dependent type (component/state) tested for fidelity** — with the
  `measureText` heuristic fixed if they broke.
- **Stop and ask the human** if: a hard constraint in `AGENTS.md` would have to be violated; an
  ADR beyond ADR-006 would need to change; the rasterizer choice is a genuine toss-up needing a
  product call; or acceptable fidelity cannot be reached without a larger architectural change.
