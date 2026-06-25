import type { Source, SourceLoadRequest } from "./source.js";
export type IncludeResolutionErrorCode = "INCLUDE_CYCLE" | "INCLUDE_ONCE_REPEATED" | "INVALID_REMOTE_URL" | "LOCAL_INCLUDE_UNAVAILABLE" | "MAX_DEPTH_EXCEEDED" | "MAX_TOTAL_SIZE_EXCEEDED" | "REMOTE_REDIRECT_NOT_ALLOWED" | "REMOTE_HOST_NOT_ALLOWED" | "REMOTE_INCLUDE_DISABLED" | "UNSUPPORTED_INCLUDE_SELECTOR";
export declare class IncludeResolutionError extends Error {
    readonly code: IncludeResolutionErrorCode;
    readonly details: Record<string, unknown>;
    constructor(code: IncludeResolutionErrorCode, message: string, details?: Record<string, unknown>);
}
export interface IncludeResolverOptions {
    readonly maxDepth: number;
    readonly maxTotalBytes: number;
    /** Hosts permitted for !includeurl. Empty = remote includes disabled. */
    readonly remoteAllowlist: readonly string[];
}
/**
 * Resolves the `!include` / `!includeurl` graph for multi-file diagrams
 * (arc42 / C4). This is the real differentiator over other PlantUML MCP servers.
 *
 * SECURITY (AGENTS.md invariant #6): remote includes are an injection surface.
 * - Resolve local includes first (filesystem source / local checkout).
 * - Gate remote includes behind an explicit allowlist.
 * - Enforce a maximum include depth and total size limit.
 */
export declare function resolveIncludes(source: Source, opts: IncludeResolverOptions, request?: SourceLoadRequest): Promise<string>;
