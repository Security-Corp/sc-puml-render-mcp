import type { RenderEngine, RenderRequest, RenderResult } from "../core/engine.js";

/**
 * Default engine (ADR-001). Renders PlantUML entirely in-process via the
 * official WASM/JS build (plantuml-core / plantuml.js, TeaVM + Viz.js).
 * No Java, no Graphviz, no web server; source never leaves the machine.
 *
 * RISK: plantuml.js is browser-targeted. Headless Node support is unproven and
 * is the subject of the Faz 0 spike (spikes/wasm-node-render). Do not implement
 * this engine until that spike proves the approach; otherwise fall back to jar.
 *
 * TODO(Faz 1): implement using whatever headless entrypoint the spike validates.
 */
export class WasmEngine implements RenderEngine {
  readonly id = "wasm";

  async render(_req: RenderRequest): Promise<RenderResult> {
    throw new Error("not implemented (Faz 1, pending Faz 0 spike)");
  }
}
