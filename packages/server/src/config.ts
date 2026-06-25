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
  /** Only used by the remote engine. Absence + engine=remote is a config error. */
  readonly plantumlServerUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const engine = (env.PUML_ENGINE as EngineId | undefined) ?? "wasm";
  const defaultFormat = (env.PUML_DEFAULT_FORMAT as DiagramFormat | undefined) ?? "png";
  const plantumlServerUrl = env.PLANTUML_SERVER_URL;

  if (engine === "remote" && !plantumlServerUrl) {
    throw new Error("engine=remote requires PLANTUML_SERVER_URL to be set");
  }
  return { engine, defaultFormat, plantumlServerUrl };
}
