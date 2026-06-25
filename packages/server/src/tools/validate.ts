import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IncludeResolverOptions } from "../core/include-resolver.js";
import { resolveIncludes } from "../core/include-resolver.js";
import type { RenderEngine } from "../core/engine.js";
import { FilesystemSource } from "../sources/filesystem-source.js";
import { TextSource } from "../sources/text-source.js";

/**
 * `validate` — checks PlantUML syntax without producing a full diagram, and
 * returns the offending line plus a suggested fix when it can. Read-only.
 */
export interface ValidateDeps {
  readonly engine: RenderEngine;
  readonly filesystemBaseDir: string;
  readonly includeResolverOptions: IncludeResolverOptions;
}

export const VALIDATE_TOOL = {
  name: "validate",
  description:
    "Validate PlantUML source and report syntax errors (line + suggestion) without rendering.",
} as const;

export const VALIDATE_INPUT_SCHEMA = {
  source: z.string().min(1, "PlantUML source is required").optional(),
  filePath: z.string().min(1, "PlantUML file path is required").optional(),
} as const;

export type ValidateInput = {
  readonly source?: string;
  readonly filePath?: string;
};

export interface ValidateResult {
  readonly ok: boolean;
  readonly line?: number;
  readonly message?: string;
  readonly suggestion?: string;
}

export function registerValidateTool(server: McpServer, deps: ValidateDeps): void {
  server.registerTool(
    VALIDATE_TOOL.name,
    {
      title: "Validate PlantUML",
      description: VALIDATE_TOOL.description,
      inputSchema: VALIDATE_INPUT_SCHEMA,
      outputSchema: {
        ok: z.boolean(),
        line: z.number().int().positive().optional(),
        message: z.string().optional(),
        suggestion: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) => validatePlantUml(input, deps)
  );
}

export async function validatePlantUml(
  input: ValidateInput,
  deps: ValidateDeps
): Promise<CallToolResult> {
  const result = await validatePlantUmlSource(input, deps);

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: { ...result },
    isError: !result.ok,
  };
}

async function validatePlantUmlSource(
  input: ValidateInput,
  deps: ValidateDeps
): Promise<ValidateResult> {
  let source: string;
  try {
    source = await resolveValidateInput(input, deps);
  } catch (err) {
    return {
      ok: false,
      message: errorMessage(err),
      suggestion: "Check include paths, remote include allowlist, and configured size/depth limits.",
    };
  }

  try {
    const result = await deps.engine.render({ source, format: "svg" });
    const svg = Buffer.from(result.bytes).toString("utf8");
    return parsePlantUmlDiagnostic(svg, source) ?? { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: errorMessage(err),
      suggestion: "Check PlantUML syntax near the reported message.",
    };
  }
}

async function resolveValidateInput(input: ValidateInput, deps: ValidateDeps): Promise<string> {
  if (input.source && input.filePath) {
    throw new Error("Provide either source or filePath, not both.");
  }
  if (input.filePath) {
    return resolveIncludes(
      new FilesystemSource({ baseDir: deps.filesystemBaseDir, entryPath: input.filePath }),
      deps.includeResolverOptions
    );
  }
  if (input.source) {
    return resolveIncludes(new TextSource(input.source), deps.includeResolverOptions);
  }
  throw new Error("PlantUML source or filePath is required.");
}

function parsePlantUmlDiagnostic(svg: string, source: string): ValidateResult | undefined {
  const text = extractSvgText(svg).join("\n");
  if (!/syntax error|error\?/iu.test(text)) {
    return undefined;
  }

  const line = Number(text.match(/\(line\s+(\d+)\)/iu)?.[1] ?? NaN);
  const message =
    extractSvgText(svg).find((entry) => /syntax error|error\?/iu.test(entry)) ??
    "PlantUML syntax error";

  return {
    ok: false,
    line: Number.isInteger(line) ? line : undefined,
    message,
    suggestion: suggestFix(text, source),
  };
}

function extractSvgText(svg: string): string[] {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/giu)]
    .map((match) => decodeXmlEntities((match[1] ?? "").replace(/<[^>]+>/gu, "")))
    .map((text) => text.trim())
    .filter(Boolean);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&");
}

function suggestFix(text: string, source: string): string {
  if (!/@enduml/iu.test(source)) {
    return "Add or restore the closing @enduml line.";
  }
  if (/syntax error/iu.test(text)) {
    return "Check PlantUML syntax around the reported line.";
  }
  return "Review the PlantUML diagnostic and nearby lines.";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
