# ADR-008: Claude Code and Codex plugin packaging — repo-root plugin, host-neutral server launch

- Status: Accepted
- Date: 2026-06-25

## Context

ADR-005 chose to distribute the host-agnostic stdio MCP server via thin host integration wrappers
— never in `core/` or `tools/`. This ADR records the concrete packaging layout so the repo is
installable as a Codex Desktop plugin and as a Claude Code plugin, exposing `render_diagram`,
`resolve_includes`, and `validate`.

Two facts from the current Claude Code docs (code.claude.com/docs) originally constrained the
layout:

- **Cache-copy rule.** On install, Claude Code copies **only the plugin directory** to
  `~/.claude/plugins/cache`. Paths that traverse outside the plugin root (`../shared-utils`) do
  **not** resolve, because those files are never copied. So any file the plugin launches must sit
  **inside** the plugin tree.
- **Path variable.** `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's installed directory in
  Claude Code. Codex Desktop does not expand this Claude-specific variable in plugin `.mcp.json`
  files, so the MCP launch path must not depend on it.

The built server lives at `packages/server/dist/index.js` and is **unbundled** (it imports
`@modelcontextprotocol/sdk`, `jsdom`, `zod`, `@resvg/resvg-wasm`, `opentype.js` at runtime).
`dist/` is committed; `node_modules/` is not.

## Decision

1. **Plugin root = repo root.** The marketplace entry uses `source: "./"`, where the marketplace
   root is itself the plugin. Claude Code metadata lives in `.claude-plugin/`; Codex metadata lives
   in `.codex-plugin/`. Because the whole repo is the plugin, `packages/server/dist` is inside the
   copied tree and survives the cache copy. A dedicated plugin subfolder (e.g.
   `plugins/sc-puml-render/`) was **rejected**: it cannot reach `../packages/server/dist` after the
   cache copy.

2. **Host-neutral launch, no Claude-only variables.** A root `.mcp.json` launches
   `bash ./scripts/start-mcp.sh` with `cwd: "."`. The script resolves the plugin root from its own
   path, verifies runtime dependencies, installs production dependencies if needed, and then execs
   `node packages/server/dist/index.js`. The default engine is pinned with `PUML_ENGINE=wasm`.
   Other knobs (`PUML_BASE_DIR`, `PUML_INCLUDE_MAX_DEPTH`, `PUML_INCLUDE_MAX_TOTAL_BYTES`,
   `PUML_REMOTE_INCLUDE_ALLOWLIST`, `PLANTUML_SERVER_URL`) keep their server-side defaults and are
   overridable through the user's shell environment.

3. **Codex manifest is explicit.** Codex Desktop requires `.codex-plugin/plugin.json` and the
   manifest declares `mcpServers: "./.mcp.json"`. Unsupported Codex manifest fields such as
   `hooks` are not used there; Claude Code keeps its own `.claude-plugin/plugin.json`.

4. **Thin wrapper only.** This slice adds manifests, `.mcp.json`, docs, and this ADR. It does not
   touch `core/`, `tools/`, `engines/`, or `sources/`. AGENTS.md invariants hold unchanged: renders
   in-process, no HTTP/web server, default path needs no Java/Graphviz/Docker, and diagram source
   does not leave the machine (`wasm` engine, no remote URL).

5. **Private-repo install.** The repo is private; `codex plugin marketplace add` or Claude Code
   `/plugin marketplace add` clones it using the user's own git credentials (`gh auth login`, or an
   SSH key). No token or credential is embedded anywhere in the repo or manifests.

6. **Runtime dependency bootstrap.** `dist/` is committed but `node_modules/` is not. Startup and
   post-install scripts run a production dependency check and call
   `pnpm install --prod --frozen-lockfile --filter sc-puml-render-mcp` only when runtime
   dependencies are missing. The scripts do not run a TypeScript build; source changes must still be
   built by maintainers before pushing.

## Consequences

- Install copies the **whole repo** into the plugin cache (including `spikes`/`docs`). Acceptable
  for this slice; a smaller packaged artifact can shrink it later.
- Changes to `.mcp.json` require a Codex Desktop restart/new thread or `/reload-plugins` /
  Claude Code restart to take effect.
- Verification for this slice is: manifests are valid JSON and `node packages/server/dist/index.js`
  speaks MCP over stdio and lists the three tools.
- The `source: "./"` choice means the marketplace and the plugin version-track together off the
  same repo; fine while they ship as one unit.
