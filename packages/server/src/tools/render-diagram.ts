import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { DiagramFormat, RenderArtifact, RenderEngine } from "../core/engine.js";
import { toImageContentBlock, toSvgResourceContentBlock } from "../core/image-result.js";

/**
 * `render_diagram` — core tool. Takes PlantUML text, returns an inline image
 * content block (PNG by default, ADR-004).
 *
 * Annotation: READ-ONLY. It produces an image; it does not mutate user state.
 * (Required for directory submission — keep annotations accurate.)
 */
export interface RenderDiagramDeps {
  readonly engine: RenderEngine;
  readonly defaultFormat: DiagramFormat;
}

export const RENDER_DIAGRAM_TOOL = {
  name: "render_diagram",
  description:
    "Render PlantUML source to an image shown inline in the chat. Renders locally by default; source does not leave the machine unless a remote engine is configured.",
} as const;

export const RENDER_DIAGRAM_INPUT_SCHEMA = {
  source: z.string().min(1, "PlantUML source is required"),
  format: z.enum(["png", "svg"]).optional(),
} as const;

export type RenderDiagramInput = {
  readonly source: string;
  readonly format?: DiagramFormat;
};

export function registerRenderDiagramTool(server: McpServer, deps: RenderDiagramDeps): void {
  server.registerTool(
    RENDER_DIAGRAM_TOOL.name,
    {
      title: "Render PlantUML diagram",
      description: RENDER_DIAGRAM_TOOL.description,
      inputSchema: RENDER_DIAGRAM_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
    },
    async (input) => renderDiagram(input, deps)
  );
}

export async function renderDiagram(
  input: RenderDiagramInput,
  deps: RenderDiagramDeps
): Promise<CallToolResult> {
  if (!input.source.trim()) {
    throw new Error("PlantUML source is required");
  }

  const result = await deps.engine.render({
    source: input.source,
    format: input.format ?? deps.defaultFormat,
  });

  const content: ContentBlock[] = [
    result.format === "png" ? toImageContentBlock(result) : toSvgResourceContentBlock(result),
  ];
  const svgArtifact = result.additionalArtifacts?.find(isSvgArtifact);
  if (svgArtifact) {
    content.push(toSvgResourceContentBlock(svgArtifact));
  }

  return { content };
}

function isSvgArtifact(artifact: RenderArtifact): boolean {
  return artifact.format === "svg";
}
