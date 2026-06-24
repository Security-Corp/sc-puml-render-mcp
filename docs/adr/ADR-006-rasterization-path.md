# ADR-006: SVG-to-PNG rasterization path

- Status: Accepted
- Date: 2026-06-24

## Context

ADR-004 requires `render_diagram` to return an inline PNG `image` content block. The proven
PlantUML path from Faz 0 uses `@plantuml/core` `renderToString`, which returns SVG only. We need
an in-process SVG-to-PNG rasterizer that preserves the default privacy and install story: no
Java, no external Graphviz binary, no Docker, no rendering web server, and no diagram source
leaving the machine.

The candidates were:

- `@resvg/resvg-js` — Node N-API native package with platform-specific optional binaries.
- `@resvg/resvg-wasm` — pure WebAssembly package from the same project.

Text rendering is part of this decision. Without an explicit bundled TrueType font,
`@resvg/resvg-wasm` produced a valid PNG but omitted text. WOFF/WOFF2 font packages did not fix
that in the Node benchmark. A bundled TrueType font from `dejavu-fonts-ttf` fixed text rendering
for both native and WASM rasterizers with system fonts disabled.

## Decision

Use `@resvg/resvg-wasm@2.6.2` for the publishable server's SVG-to-PNG rasterization step, with
bundled DejaVu TrueType fonts from `dejavu-fonts-ttf@2.37.3`. Keep rasterization behind an
isolated internal step so the engine can switch to a different rasterizer later without changing
the `RenderEngine` interface or `tools/`.

Do not use `@resvg/resvg-js` in the runtime path for Faz 1. It remains an acceptable benchmark
comparison and fallback candidate, but native optional packages are a worse fit for npx/MCPB
distribution than a WASM artifact.

## Benchmark

Local benchmark environment: Node 22.10.0 on macOS arm64, class-diagram SVG from the Faz 0 spike,
system fonts disabled, bundled `DejaVuSans.ttf` and `DejaVuSansMono.ttf`.

| Rasterizer | Init | First render | Warm median | Warm p95 | Output |
|---|---:|---:|---:|---:|---|
| `@resvg/resvg-js@2.6.2` native | n/a | 14.1 ms | 7.9 ms | 11.8 ms | 237x232, 11,127 bytes |
| `@resvg/resvg-wasm@2.6.2` WASM | 17.6 ms | 38.1 ms | 4.4 ms | 5.2 ms | 237x232, 11,127 bytes |

Both outputs had valid PNG magic bytes (`89504e470d0a1a0a`) and visually preserved the class
diagram text with the bundled TrueType fonts. The WASM path is fast enough and avoids native
runtime binaries, so it is the Faz 1 default.

## Consequences

- The default render path remains external-runtime-free, but not dependency-free.
- The server must initialize and reuse the WASM module and PlantUML DOM compatibility environment
  per process. Reinitializing per tool call would waste the cold-start cost.
- The rasterizer must be treated as an internal implementation detail of `WasmEngine`; `core/`
  and `tools/` only see `RenderEngine` results.
- Fidelity tests must include text-heavy diagrams and at least one additional Graphviz-dependent
  type because Faz 0's PlantUML measurement shims are approximate.
- Packaging review must preserve the MPL-2.0 notice for `@resvg/resvg-wasm` and the font license
  notices for `dejavu-fonts-ttf` (ADR-002).
