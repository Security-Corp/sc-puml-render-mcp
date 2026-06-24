# CLAUDE.md

This project's working knowledge for AI agents lives in **`AGENTS.md`** (single source of truth,
shared across all tools). Read it first.

@AGENTS.md

## Claude Code specific notes

- This repo is developed in a Desktop (design/ADR) → Claude Code (implementation) workflow.
  Architecture decisions are made as ADRs under `docs/adr/`; implementation happens here.
- Before changing anything under `packages/server/src/core` or `engines/`, re-read the relevant
  ADR. Architectural deviations require a new ADR, not an inline override.
- Start from **Faz 0**: `spikes/wasm-node-render`. Do not scaffold engines 2 and 3 until the
  WASM-in-Node spike is proven or rejected.
