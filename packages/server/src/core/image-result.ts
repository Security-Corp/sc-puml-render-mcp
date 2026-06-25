import type { EmbeddedResource, ImageContent } from "@modelcontextprotocol/sdk/types.js";
import type { RenderArtifact } from "./engine.js";

/**
 * Wrap rendered bytes into an MCP `image` content block so the diagram renders
 * inline in the chat (ADR-004). PNG is inline-safe; SVG should generally be
 * offered as a separate resource rather than relied on for inline display.
 */
export function toImageContentBlock(result: RenderArtifact): ImageContent {
  const base64 = Buffer.from(result.bytes).toString("base64");
  return {
    type: "image",
    data: base64,
    mimeType: result.mimeType,
  };
}

export function toSvgResourceContentBlock(result: RenderArtifact): EmbeddedResource {
  if (result.format !== "svg") {
    throw new Error(`expected svg artifact, got ${result.format}`);
  }

  const text = Buffer.from(result.bytes).toString("utf8");
  return {
    type: "resource",
    resource: {
      uri: "plantuml://rendered/latest.svg",
      mimeType: "image/svg+xml",
      text,
    },
  };
}
