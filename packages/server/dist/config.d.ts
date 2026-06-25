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
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
