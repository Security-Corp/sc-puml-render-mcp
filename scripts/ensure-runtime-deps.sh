#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SERVER_ROOT="${PLUGIN_ROOT}/packages/server"
DIST_ENTRY="${SERVER_ROOT}/dist/index.js"

if [[ ! -f "${DIST_ENTRY}" ]]; then
  echo "[sc-puml-render-mcp] missing built server: ${DIST_ENTRY}" >&2
  echo "[sc-puml-render-mcp] run: pnpm -F sc-puml-render-mcp build" >&2
  exit 1
fi

runtime_deps_available() {
  (
    cd "${SERVER_ROOT}"
    node --input-type=module -e "
      await import('@modelcontextprotocol/sdk/server/stdio.js');
      await import('@plantuml/core');
      await import('@resvg/resvg-wasm');
      await import('jsdom');
      await import('opentype.js');
      await import('zod');
    " >/dev/null 2>&1
  )
}

resolve_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"
    return
  fi
  if command -v corepack >/dev/null 2>&1; then
    echo "corepack pnpm"
    return
  fi
  return 1
}

if runtime_deps_available; then
  exit 0
fi

PNPM_COMMAND="$(resolve_pnpm || true)"
if [[ -z "${PNPM_COMMAND}" ]]; then
  echo "[sc-puml-render-mcp] runtime dependencies are missing and pnpm/corepack was not found" >&2
  exit 1
fi

echo "[sc-puml-render-mcp] installing runtime dependencies" >&2
(
  cd "${PLUGIN_ROOT}"
  # shellcheck disable=SC2086
  ${PNPM_COMMAND} install --prod --frozen-lockfile --filter sc-puml-render-mcp
)

if ! runtime_deps_available; then
  echo "[sc-puml-render-mcp] runtime dependency check failed after install" >&2
  exit 1
fi
