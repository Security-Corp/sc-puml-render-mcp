import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config.js";
import type { RenderEngine } from "./core/engine.js";
/** Engine factory — the one place that knows about concrete engines. */
export declare function createEngine(config: AppConfig): RenderEngine;
/**
 * Build and wire the MCP server: create the engine from config, register the
 * tools, and connect a transport (caller passes the transport in index.ts).
 *
 */
export declare function createServer(config: AppConfig): McpServer;
