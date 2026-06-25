/**
 * Fallback engine (ADR-001). Renders locally via plantuml.jar (node-plantuml or
 * a java subprocess). No web server, but requires a local JRE (and Graphviz for
 * some diagram types). Used when the WASM engine is unavailable/unsuitable.
 *
 * TODO(Faz 3): spawn java / use node-plantuml; detect missing JRE and surface a
 * clear, actionable error rather than a stack trace.
 */
export class JarEngine {
    id = "jar";
    async render(_req) {
        throw new Error("not implemented (Faz 3)");
    }
}
//# sourceMappingURL=jar-engine.js.map