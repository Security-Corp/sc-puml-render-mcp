import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig, EngineId } from "./config.js";
import type { RenderEngine } from "./core/engine.js";
import { WasmEngine } from "./engines/wasm-engine.js";
import { RemoteEngine } from "./engines/remote-engine.js";
import { JarEngine } from "./engines/jar-engine.js";
import { registerRenderDiagramTool } from "./tools/render-diagram.js";
import { registerResolveIncludesTool } from "./tools/resolve-includes.js";
import { registerValidateTool } from "./tools/validate.js";

/** Engine factory — the one place that knows about concrete engines. */
export function createEngine(config: AppConfig): RenderEngine {
  const id: EngineId = config.engine;
  switch (id) {
    case "wasm":
      return new WasmEngine();
    case "remote":
      return new RemoteEngine(config.plantumlServerUrl!);
    case "jar":
      return new JarEngine();
    default: {
      const _exhaustive: never = id;
      throw new Error(`unknown engine: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Build and wire the MCP server: create the engine from config, register the
 * tools, and connect a transport (caller passes the transport in index.ts).
 *
 */
export function createServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: "sc-puml-render-mcp",
    version: "0.0.1",
  });
  const engine = createEngine(config);
  const includeResolverOptions = {
    maxDepth: config.includeMaxDepth,
    maxTotalBytes: config.includeMaxTotalBytes,
    remoteAllowlist: config.remoteIncludeAllowlist,
  };

  registerRenderDiagramTool(server, {
    engine,
    defaultFormat: config.defaultFormat,
    filesystemBaseDir: config.filesystemBaseDir,
    includeResolverOptions,
  });
  registerResolveIncludesTool(server, {
    filesystemBaseDir: config.filesystemBaseDir,
    includeResolverOptions,
  });
  registerValidateTool(server, {
    engine,
    filesystemBaseDir: config.filesystemBaseDir,
    includeResolverOptions,
  });

  return server;
}
