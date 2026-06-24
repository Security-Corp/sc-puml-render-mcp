import type { RenderEngine } from "../core/engine.js";
import type { AppConfig } from "../config.js";

/**
 * `render_diagram` — core tool. Takes PlantUML text, returns an inline image
 * content block (PNG by default, ADR-004).
 *
 * Annotation: READ-ONLY. It produces an image; it does not mutate user state.
 * (Required for directory submission — keep annotations accurate.)
 *
 * TODO(Faz 1): register with the MCP server, validate input, call the engine,
 * return toImageContentBlock(result). Offer SVG as a separate resource when
 * format=svg or when the PNG is too large for inline.
 */
export interface RenderDiagramDeps {
  readonly engine: RenderEngine;
  readonly config: AppConfig;
}

export const RENDER_DIAGRAM_TOOL = {
  name: "render_diagram",
  description:
    "Render PlantUML source to an image shown inline in the chat. Renders locally by default; source does not leave the machine unless a remote engine is configured.",
  // annotations: { readOnlyHint: true }  // wire up per SDK shape in Faz 1
} as const;
