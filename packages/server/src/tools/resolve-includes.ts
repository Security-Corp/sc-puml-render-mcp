import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IncludeResolverOptions } from "../core/include-resolver.js";
import { resolveIncludes } from "../core/include-resolver.js";
import { FilesystemSource } from "../sources/filesystem-source.js";

/**
 * `resolve_includes` — returns the flattened PlantUML after resolving the
 * !include graph, as plain text. Useful for debugging multi-file arc42/C4
 * diagrams and for transparency about what will actually be rendered. Read-only.
 */
export interface ResolveIncludesDeps {
  readonly filesystemBaseDir: string;
  readonly includeResolverOptions: IncludeResolverOptions;
}

export const RESOLVE_INCLUDES_TOOL = {
  name: "resolve_includes",
  description:
    "Resolve a PlantUML file's !include graph and return the flattened source as text.",
} as const;

export const RESOLVE_INCLUDES_INPUT_SCHEMA = {
  filePath: z.string().min(1, "PlantUML file path is required"),
} as const;

export type ResolveIncludesInput = {
  readonly filePath: string;
};

export function registerResolveIncludesTool(server: McpServer, deps: ResolveIncludesDeps): void {
  server.registerTool(
    RESOLVE_INCLUDES_TOOL.name,
    {
      title: "Resolve PlantUML includes",
      description: RESOLVE_INCLUDES_TOOL.description,
      inputSchema: RESOLVE_INCLUDES_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
    },
    async (input) => resolveIncludesTool(input, deps)
  );
}

export async function resolveIncludesTool(
  input: ResolveIncludesInput,
  deps: ResolveIncludesDeps
): Promise<CallToolResult> {
  const flattened = await resolveIncludes(
    new FilesystemSource({ baseDir: deps.filesystemBaseDir, entryPath: input.filePath }),
    deps.includeResolverOptions
  );

  return {
    content: [{ type: "text", text: flattened }],
    structuredContent: {
      ok: true,
      bytes: Buffer.byteLength(flattened, "utf8"),
    },
  };
}
