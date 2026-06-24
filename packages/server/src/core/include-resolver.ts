/**
 * Resolves the `!include` / `!includeurl` graph for multi-file diagrams
 * (arc42 / C4). This is the real differentiator over other PlantUML MCP servers.
 *
 * SECURITY (AGENTS.md invariant #6): remote includes are an injection surface.
 * - Resolve local includes first (filesystem source / local checkout).
 * - Gate remote includes behind an explicit allowlist.
 * - Enforce a maximum include depth and total size limit.
 *
 * TODO(Faz 2): implement against the Source abstraction in ../sources.
 */

export interface IncludeResolverOptions {
  readonly maxDepth: number;
  readonly maxTotalBytes: number;
  /** Hosts permitted for !includeurl. Empty = remote includes disabled. */
  readonly remoteAllowlist: readonly string[];
}

export async function resolveIncludes(
  _entrySource: string,
  _opts: IncludeResolverOptions
): Promise<string> {
  throw new Error("not implemented (Faz 2)");
}
