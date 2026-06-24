import type { AppConfig, EngineId } from "./config.js";
import type { RenderEngine } from "./core/engine.js";
import { WasmEngine } from "./engines/wasm-engine.js";
import { RemoteEngine } from "./engines/remote-engine.js";
import { JarEngine } from "./engines/jar-engine.js";

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
 * TODO(Faz 1): instantiate @modelcontextprotocol/sdk Server, register
 * render_diagram (then validate, resolve_includes), and return it.
 */
export function createServer(_config: AppConfig): unknown {
  throw new Error("not implemented (Faz 1)");
}
