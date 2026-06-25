import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { IncludeResolverOptions } from "../core/include-resolver.js";
import type { RenderEngine } from "../core/engine.js";
/**
 * `validate` — checks PlantUML syntax without producing a full diagram, and
 * returns the offending line plus a suggested fix when it can. Read-only.
 */
export interface ValidateDeps {
    readonly engine: RenderEngine;
    readonly filesystemBaseDir: string;
    readonly includeResolverOptions: IncludeResolverOptions;
}
export declare const VALIDATE_TOOL: {
    readonly name: "validate";
    readonly description: "Validate PlantUML source and report syntax errors (line + suggestion) without rendering.";
};
export declare const VALIDATE_INPUT_SCHEMA: {
    readonly source: z.ZodOptional<z.ZodString>;
    readonly filePath: z.ZodOptional<z.ZodString>;
};
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
export declare function registerValidateTool(server: McpServer, deps: ValidateDeps): void;
export declare function validatePlantUml(input: ValidateInput, deps: ValidateDeps): Promise<CallToolResult>;
