import type { DiagramFormat } from "./core/engine.js";

/**
 * Runtime configuration. Read from environment variables so it works for both
 * stdio (Claude Desktop / Claude Code) and MCPB packaging.
 *
 * Default engine is "wasm" — no Java, external Graphviz, Docker, or web server;
 * bundled npm/WASM dependencies render locally and no source leaves the machine.
 * "remote" requires the user to supply their own PLANTUML_SERVER_URL.
 */

export type EngineId = "wasm" | "remote" | "jar";

export interface AppConfig {
  readonly engine: EngineId;
  readonly defaultFormat: DiagramFormat;
  readonly filesystemBaseDir: string;
  readonly includeMaxDepth: number;
  readonly includeMaxTotalBytes: number;
  readonly remoteIncludeAllowlist: readonly string[];
  /** Only used by the remote engine. Absence + engine=remote is a config error. */
  readonly plantumlServerUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const engine = (env.PUML_ENGINE as EngineId | undefined) ?? "wasm";
  const defaultFormat = (env.PUML_DEFAULT_FORMAT as DiagramFormat | undefined) ?? "png";
  const plantumlServerUrl = env.PLANTUML_SERVER_URL;
  const filesystemBaseDir = env.PUML_BASE_DIR ?? process.cwd();
  const includeMaxDepth = readPositiveInteger(env.PUML_INCLUDE_MAX_DEPTH, 10);
  const includeMaxTotalBytes = readPositiveInteger(env.PUML_INCLUDE_MAX_TOTAL_BYTES, 1_000_000);
  const remoteIncludeAllowlist = splitCsv(env.PUML_REMOTE_INCLUDE_ALLOWLIST);

  if (engine === "remote" && !plantumlServerUrl) {
    throw new Error("engine=remote requires PLANTUML_SERVER_URL to be set");
  }
  return {
    engine,
    defaultFormat,
    filesystemBaseDir,
    includeMaxDepth,
    includeMaxTotalBytes,
    remoteIncludeAllowlist,
    plantumlServerUrl,
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`expected positive integer, got ${value}`);
  }
  return parsed;
}

function splitCsv(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
