#!/usr/bin/env node
/**
 * Entry point. Loads config and starts the MCP server over stdio (the transport
 * Claude Desktop / Claude Code use for local connectors).
 *
 * TODO(Faz 1): connect StdioServerTransport from @modelcontextprotocol/sdk to
 * the server returned by createServer().
 */
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  createServer(config);
  // TODO(Faz 1): const transport = new StdioServerTransport(); await server.connect(transport);
}

main().catch((err) => {
  console.error("[sc-puml-render-mcp] fatal:", err);
  process.exit(1);
});
