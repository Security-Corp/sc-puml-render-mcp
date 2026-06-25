import type { RenderEngine, RenderRequest, RenderResult } from "../core/engine.js";
/**
 * Default engine (ADR-001). Renders PlantUML entirely in-process via the
 * official WASM/JS build (plantuml-core / plantuml.js, TeaVM + Viz.js).
 * No Java, external Graphviz, Docker, or web server; source never leaves the
 * machine. It uses a Node DOM shim plus an in-process WASM SVG rasterizer.
 */
export declare class WasmEngine implements RenderEngine {
    readonly id = "wasm";
    render(req: RenderRequest): Promise<RenderResult>;
}
