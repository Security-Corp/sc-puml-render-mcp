# Contributing

Thanks for your interest in `sc-puml-render-mcp`.

## Before you start

- Read [`AGENTS.md`](./AGENTS.md) for the architecture invariants and the "do NOT" list.
- Read the relevant ADR in [`docs/adr/`](./docs/adr) before changing anything architectural.
  If you need to deviate from a decision, **add a new ADR** rather than silently overriding it.

## Workflow

1. `pnpm install`
2. Make your change in a feature branch.
3. Keep the dependency direction: `tools/` → `core/` → interfaces only. `core/` must not import
   concrete engines or sources.
4. Add/adjust tests under the affected package.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

## Architecture principles

SOLID and KISS. No over-engineering. Fix root causes, not symptoms — if a change feels like a
workaround, raise the underlying problem in the PR description instead of papering over it.

## AI coding agents

This repo is set up for AI-assisted development. `CLAUDE.md` imports `AGENTS.md` so Claude Code
and other agents load the same project knowledge. If you use a different tool, point it at
`AGENTS.md`.
