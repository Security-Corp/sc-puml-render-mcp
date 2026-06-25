import type { EmbeddedResource, ImageContent } from "@modelcontextprotocol/sdk/types.js";
import type { RenderArtifact } from "./engine.js";
/**
 * Wrap rendered bytes into an MCP `image` content block so the diagram renders
 * inline in the chat (ADR-004). PNG is inline-safe; SVG should generally be
 * offered as a separate resource rather than relied on for inline display.
 */
export declare function toImageContentBlock(result: RenderArtifact): ImageContent;
export declare function toSvgResourceContentBlock(result: RenderArtifact): EmbeddedResource;
