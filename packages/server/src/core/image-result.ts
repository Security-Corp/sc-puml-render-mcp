import type { RenderResult } from "./engine.js";

/**
 * Wrap rendered bytes into an MCP `image` content block so the diagram renders
 * inline in the chat (ADR-004). PNG is inline-safe; SVG should generally be
 * offered as a separate resource rather than relied on for inline display.
 *
 * TODO(Faz 1): return the exact content-block shape expected by the MCP SDK
 * version pinned in package.json.
 */
export function toImageContentBlock(result: RenderResult): unknown {
  const base64 = Buffer.from(result.bytes).toString("base64");
  return {
    type: "image",
    data: base64,
    mimeType: result.mimeType,
  };
}
