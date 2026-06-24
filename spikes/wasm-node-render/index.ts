/**
 * FAZ 0 SPIKE — the single highest-risk question in the whole project:
 *
 *   Can the official PlantUML WASM/JS build render headless in Node.js?
 *
 * If YES  → the "zero-dependency default engine" thesis holds; build WasmEngine on it.
 * If NO   → fall back to the jar engine and revise ADR-001 + the install story.
 *
 * Goal of this spike (keep it throwaway): take a hard-coded .puml string, render
 * it, and write a real PNG to ./out/spike.png. Success = a valid, openable PNG.
 *
 * Candidate packages to evaluate (verify exact API / npm names when implementing,
 * the ecosystem moves fast):
 *   - plantuml-core / plantuml.js  (TeaVM + Viz.js, browser-targeted — the crux:
 *     does it run without `window`/`document`, or need a shim like jsdom?)
 *   - @plantuml-mcp/plantuml, node-plantuml (these pull in Java — only the
 *     fallback path, NOT what this spike is trying to prove)
 *
 * What to find out and write down (paste findings into docs/adr/ADR-001 as an
 * update, or open ADR-005 if the conclusion changes the architecture):
 *   1. Does it run in Node at all? Any browser globals needed?
 *   2. Cold-start time for one render. Does it need a warmed/reused instance?
 *   3. Does it cover Graphviz-dependent diagram types (class/component/state)?
 *   4. PNG and SVG output both available?
 *   5. Bundle size / how it ships (affects MCPB packaging in Faz 4).
 *
 * Run:  pnpm -F wasm-node-render dev
 */

const SAMPLE = `@startuml
Alice -> Bob: hello
Bob --> Alice: hi
@enduml`;

async function main(): Promise<void> {
  console.log("Faz 0 spike: attempting headless PlantUML render in Node.\n");
  console.log("Sample source:\n" + SAMPLE + "\n");

  // TODO(Faz 0): import the WASM/JS PlantUML build and render SAMPLE to PNG bytes.
  // Write bytes to ./out/spike.png and assert the file is a valid PNG.
  //
  // Pseudocode:
  //   const png = await renderToPng(SAMPLE);
  //   await mkdir("out", { recursive: true });
  //   await writeFile("out/spike.png", png);
  //   console.log("OK: wrote out/spike.png (", png.length, "bytes )");

  throw new Error(
    "SPIKE NOT YET IMPLEMENTED — wire up the WASM PlantUML build and answer the 5 questions above."
  );
}

main().catch((err) => {
  console.error("\nSPIKE FAILED:", err.message);
  process.exit(1);
});
