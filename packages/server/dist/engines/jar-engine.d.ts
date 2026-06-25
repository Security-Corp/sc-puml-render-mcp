import type { RenderEngine, RenderRequest, RenderResult } from "../core/engine.js";
/**
 * Fallback engine (ADR-001). Renders locally via plantuml.jar (node-plantuml or
 * a java subprocess). No web server, but requires a local JRE (and Graphviz for
 * some diagram types). Used when the WASM engine is unavailable/unsuitable.
 *
 * TODO(Faz 3): spawn java / use node-plantuml; detect missing JRE and surface a
 * clear, actionable error rather than a stack trace.
 */
export declare class JarEngine implements RenderEngine {
    readonly id = "jar";
    render(_req: RenderRequest): Promise<RenderResult>;
}
