import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IncludeResolverOptions } from "../core/include-resolver.js";
import type { DiagramFormat, RenderEngine } from "../core/engine.js";
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
    readonly filesystemBaseDir: string;
    readonly includeResolverOptions: IncludeResolverOptions;
}
export declare const RENDER_DIAGRAM_TOOL: {
    readonly name: "render_diagram";
    readonly description: "Render PlantUML source to an image shown inline in the chat. Renders locally by default; source does not leave the machine unless a remote engine is configured.";
};
export declare const RENDER_DIAGRAM_INPUT_SCHEMA: {
    readonly source: z.ZodOptional<z.ZodString>;
    readonly filePath: z.ZodOptional<z.ZodString>;
    readonly format: z.ZodOptional<z.ZodEnum<{
        png: "png";
        svg: "svg";
    }>>;
};
export type RenderDiagramInput = {
    readonly source?: string;
    readonly filePath?: string;
    readonly format?: DiagramFormat;
};
export declare function registerRenderDiagramTool(server: McpServer, deps: RenderDiagramDeps): void;
export declare function renderDiagram(input: RenderDiagramInput, deps: RenderDiagramDeps): Promise<CallToolResult>;
