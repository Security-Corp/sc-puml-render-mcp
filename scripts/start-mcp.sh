#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "${PLUGIN_ROOT}"
"${SCRIPT_DIR}/ensure-runtime-deps.sh"

exec node "${PLUGIN_ROOT}/packages/server/dist/index.js"
