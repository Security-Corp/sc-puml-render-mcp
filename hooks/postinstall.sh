#!/usr/bin/env bash
set -e
cd "$CLAUDE_PLUGIN_ROOT"
pnpm install --prod --filter sc-puml-render-mcp
pnpm --filter sc-puml-render-mcp build
