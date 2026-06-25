/**
 * The seam the whole render strategy hangs on (ADR-001).
 *
 * `core` depends ONLY on this interface. Concrete engines live in `../engines`
 * and are selected at runtime via config (`engine: wasm | remote | jar`).
 * Do not import a concrete engine from `core`.
 */
export type DiagramFormat = "png" | "svg";
export interface RenderRequest {
    /** Raw PlantUML source, includes already resolved. Must contain @startuml/@enduml. */
    readonly source: string;
    /** Desired output format. PNG is the inline-safe default (ADR-004). */
    readonly format: DiagramFormat;
    /** Optional target PNG width in pixels. SVG renders ignore this option. */
    readonly targetWidth?: number;
}
export interface RenderArtifact {
    readonly format: DiagramFormat;
    /** Raw bytes of the rendered diagram (PNG bytes, or SVG UTF-8 bytes). */
    readonly bytes: Uint8Array;
    readonly mimeType: "image/png" | "image/svg+xml";
}
export interface RenderResult extends RenderArtifact {
    /**
     * Additional render products from the same engine pass. PNG callers may use
     * this to expose SVG as a resource without triggering a second PlantUML render.
     */
    readonly additionalArtifacts?: readonly RenderArtifact[];
}
export interface RenderEngine {
    /** Stable id used in config and diagnostics: "wasm" | "remote" | "jar". */
    readonly id: string;
    /**
     * Render PlantUML source to image bytes. Implementations must NOT send source
     * off-machine unless that is the explicit purpose of the engine (remote).
     */
    render(req: RenderRequest): Promise<RenderResult>;
}
