# ADR-008: Claude Code plugin packaging — repo-root plugin, `source: "./"`, env-resolved server path

- Status: Accepted
- Date: 2026-06-25

## Context

ADR-005 chose to distribute the host-agnostic stdio MCP server as a Claude Code plugin via a
marketplace, with host integration living in thin wrappers — never in `core/` or `tools/`. This
ADR records the concrete packaging layout for that wrapper so the repo is installable with
`/plugin marketplace add Security-Corp/sc-puml-render-mcp` then
`/plugin install sc-puml-render@sc-puml-render-mcp`, exposing `render_diagram`, `resolve_includes`,
and `validate`.

Two facts from the current Claude Code docs (code.claude.com/docs) constrain the layout:

- **Cache-copy rule.** On install, Claude Code copies **only the plugin directory** to
  `~/.claude/plugins/cache`. Paths that traverse outside the plugin root (`../shared-utils`) do
  **not** resolve, because those files are never copied. So any file the plugin launches must sit
  **inside** the plugin tree.
- **Path variable.** `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's installed directory and is
  the supported way to reference bundled files from `.mcp.json`. `${CLAUDE_PROJECT_DIR}` resolves
  to the user's project root.

The built server lives at `packages/server/dist/index.js` and is **unbundled** (it imports
`@modelcontextprotocol/sdk`, `jsdom`, `zod`, `@resvg/resvg-wasm`, `opentype.js` at runtime).
`dist/` and `node_modules/` are both git-ignored.

## Decision

1. **Plugin root = repo root.** The marketplace entry uses `source: "./"`, the documented pattern
   where the marketplace root is itself the plugin. Both manifests live in the repo-root
   `.claude-plugin/` directory (`marketplace.json` + `plugin.json`). Because the whole repo is the
   plugin, `packages/server/dist` is inside the copied tree and survives the cache copy. A
   dedicated plugin subfolder (e.g. `plugins/sc-puml-render/`) was **rejected**: it cannot reach
   `../packages/server/dist` after the cache copy.

2. **Env-resolved launch, no absolute path, no `../`.** A root `.mcp.json` launches the server as
   `node ${CLAUDE_PLUGIN_ROOT}/packages/server/dist/index.js`. The default engine is pinned with
   `PUML_ENGINE=wasm`, and `PUML_BASE_DIR=${CLAUDE_PROJECT_DIR}` so local `!include` resolves
   against the user's project. The remaining knobs (`PUML_INCLUDE_MAX_DEPTH`,
   `PUML_INCLUDE_MAX_TOTAL_BYTES`, `PUML_REMOTE_INCLUDE_ALLOWLIST`, `PLANTUML_SERVER_URL`) keep
   their server-side defaults and are overridable through the user's shell environment, inherited
   by the stdio subprocess.

3. **Thin wrapper only.** This slice adds manifests, `.mcp.json`, docs, and this ADR. It does not
   touch `core/`, `tools/`, `engines/`, or `sources/`. AGENTS.md invariants hold unchanged: renders
   in-process, no HTTP/web server, default path needs no Java/Graphviz/Docker, and diagram source
   does not leave the machine (`wasm` engine, no remote URL).

4. **Private-repo install.** The repo is private; `/plugin marketplace add` clones it using the
   user's own git credentials (`gh auth login` or an SSH key). No token or credential is embedded
   anywhere in the repo or manifests.

5. **Known limitation — build prerequisite (Faz 4 follow-up).** `dist/` and `node_modules/` are
   git-ignored and `dist` is unbundled, so a *pure* clone from GitHub will not run until the server
   is built (`pnpm install && pnpm -F server build`). This slice deliberately targets the
   **minimum scaffold**: install from a built working tree / local path, with the build prerequisite
   documented in the README. Making a pure clone self-contained — a bundled single-file `dist`, an
   on-install build hook, or an npm-package source — is deferred to the rest of Faz 4.

## Consequences

- Install copies the **whole repo** into the plugin cache (including `node_modules`/`spikes`/`docs`
  when present locally). Acceptable for this slice; a bundled artifact would shrink it later.
- Changes to `.mcp.json` require `/reload-plugins` or a Claude Code restart to take effect (skills
  reload live; MCP config does not).
- Verification for this slice is: manifests are valid JSON and `node packages/server/dist/index.js`
  speaks MCP over stdio and lists the three tools — the docs-blessed proof when an interactive
  restart is needed to load the plugin.
- The `source: "./"` choice means the marketplace and the plugin version-track together off the
  same repo; fine while they ship as one unit.
