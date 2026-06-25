import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IncludeResolverOptions } from "../core/include-resolver.js";
/**
 * `resolve_includes` — returns the flattened PlantUML after resolving the
 * !include graph, as plain text. Useful for debugging multi-file arc42/C4
 * diagrams and for transparency about what will actually be rendered. Read-only.
 */
export interface ResolveIncludesDeps {
    readonly filesystemBaseDir: string;
    readonly includeResolverOptions: IncludeResolverOptions;
}
export declare const RESOLVE_INCLUDES_TOOL: {
    readonly name: "resolve_includes";
    readonly description: "Resolve a PlantUML file's !include graph and return the flattened source as text.";
};
export declare const RESOLVE_INCLUDES_INPUT_SCHEMA: {
    readonly filePath: z.ZodString;
};
export type ResolveIncludesInput = {
    readonly filePath: string;
};
export declare function registerResolveIncludesTool(server: McpServer, deps: ResolveIncludesDeps): void;
export declare function resolveIncludesTool(input: ResolveIncludesInput, deps: ResolveIncludesDeps): Promise<CallToolResult>;
