#!/usr/bin/env node
/**
 * Entry point. Loads config and starts the MCP server over stdio (the transport
 * Claude Desktop / Claude Code use for local connectors).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[sc-puml-render-mcp] fatal:", err);
  process.exit(1);
});
