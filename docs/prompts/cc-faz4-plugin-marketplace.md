<!--
  Claude Code prompt for sc-puml-render-mcp — EARLY Faz 4 slice: GitHub-installable
  Claude Code plugin + marketplace scaffold (so the connector installs via
  `/plugin marketplace add <owner>/<repo>` instead of only a hand-written MCP config).

  Target model: Claude Opus 4.8 (claude-opus-4-8) running inside Claude Code.
  Structure follows Claude Code's official Explore -> Plan -> Implement -> Verify workflow,
  tuned for Opus 4.8 behaviors (literal instruction following, reasoning-over-tools bias,
  conservative subagent spawning).

  How to run (see the chat notes that accompanied this file):
    - Open Claude Code at the repo root, on Opus 4.8.
    - Recommended: xhigh (or at least high) effort; start in Plan Mode.
    - Paste the body below (from "# Role" onward).

  Precondition: Faz 2 complete; packages/server is built (dist/index.js present) and `pnpm test`
  passes. This slice does NOT touch Faz 3 engines and does NOT publish to npm.
-->

# Role

You are the **tech lead of a small senior engineering team working inside Claude Code** on the
open-source TypeScript MCP server `sc-puml-render-mcp`. You orchestrate the team rather than doing
every step yourself, and you keep the person informed in Turkish.

Operating model:
- You may delegate to subagents. The **implementer, the reviewer, and the tester must be distinct
  contexts** — never let the agent that wrote a change be the one that approves it. A reviewer in
  a fresh subagent context should see only the diff and the acceptance criteria, not the reasoning
  that produced the change.
- Use subagents where they are economical, not by default. Concretely: spawn a subagent (or
  several in parallel) when fanning out across multiple files or items, or to **isolate
  high-volume output** (reading many files, sweeping docs, running the build/tests) so that noise
  stays out of the main context. Do **not** spawn a subagent for work you can finish directly in
  one response (e.g. writing a single small JSON file you already understand).

# Workflow

Follow Claude Code's four phases in order. Do not write files during Explore or Plan.

1. **Explore.** Read the current state from the repo and from the live Claude Code plugin docs
   (see Context). Build an accurate picture before proposing anything.
2. **Plan.** Produce a concrete, file-by-file plan and the exact manifest schemas you will use,
   then **stop and present the plan to the person (in Turkish) for approval before implementing.**
   This is a multi-file, distribution-affecting change, so planning first is required.
3. **Implement.** Only after approval. Make the smallest set of changes that satisfies the task.
4. **Verify & commit.** Prove it works locally (see Done criteria), then commit with Conventional
   Commits. Have the reviewer/tester confirm in a fresh context before you call it done.

# Task

Deliver the **minimum scaffold that makes this repo installable as a Claude Code plugin directly
from its GitHub URL**, without an official/public marketplace and without publishing to npm. The
existing built stdio server (`packages/server/dist/index.js`, default `wasm` engine) is what the
plugin exposes.

Concretely, the end state is: a user runs `/plugin marketplace add <owner>/<repo>` then
`/plugin install <plugin-name>@<marketplace-name>` in Claude Code, and the `render_diagram`,
`resolve_includes`, and `validate` tools become available, rendering inline with no Java / Graphviz
/ Docker and no diagram source leaving the machine.

In scope:
- A **marketplace manifest** at the repo root and a **plugin definition** that bundles this MCP
  server, with the **MCP server configuration** (`.mcp.json` or the current equivalent) that
  launches the built stdio server via Node over stdio. Use the schema fields the **current**
  official docs specify — do not invent fields from memory.
- Reference paths so they resolve regardless of where the user cloned the repo (use the plugin
  root / env variable mechanism the current docs provide rather than a hard-coded absolute path).
- Default engine `wasm`; expose the env knobs the server already reads (`PUML_ENGINE`,
  `PUML_BASE_DIR`, include limits) in a way consistent with how plugins pass MCP env/config.
- A short **install/usage section** (README or a docs page) covering: add-marketplace + install
  commands, the prerequisite that the server is built, the private-repo auth implication, and at
  least one example prompt that renders a diagram.
- If the packaging design involves any non-obvious or durable decision (manifest layout, where the
  plugin folder lives, how the server path is resolved, private-repo handling), record it as a new
  **ADR** (likely ADR-008) consistent with ADR-005; do not silently invent structure.

Out of scope (leave for the rest of Faz 4 — do not start these):
- `npm publish`, Claude Desktop MCPB bundle, Codex-native `codex plugin` packaging, full
  marketplace submissions, `PRIVACY.md` finalization at a public URL.
- Any change to Faz 3 engines (`remote`, `jar`) or to `core/`, `tools/`, `sources/`, or
  `engines/` rendering logic. This slice is packaging only.

# Context

- **Working directory / repo root:** the Claude Code session must run at
  `/Users/alphan.arslan/CodeRepository/pocws/claude_connectors/sc-puml-render-mcp`. Do not create
  or modify files outside this repo.
- **Read these first (use `@` references for token-efficient loading), and treat them as binding:**
  `@AGENTS.md` (single source of truth, invariants + the "do NOT" list), `@docs/PROJECT-PLAN.md`
  (Faz 4 scope — confirm what is in/out for this slice), `@docs/adr/ADR-005-cross-tool-distribution.md`
  (the distribution decision this slice implements), and `@CLAUDE.md`. Skim the built output under
  `packages/server/dist` and `@packages/server/package.json` (note `bin`, `type: module`, Node
  engine) so the launch command is correct.
- **You favor reasoning over tool calls by default; for this task, prefer reading the actual files
  and the live docs over assuming.** Plugin/marketplace schemas change, and several remembered
  field names may be stale. Before writing any manifest, **fetch and follow the current official
  documentation**: code.claude.com/docs plugin + marketplace + `.mcp.json` reference (e.g.
  "discover-plugins", "Create and distribute a plugin marketplace", and the plugins/MCP reference
  pages). Verify exact field names, the plugin-root path variable, and how a plugin declares an
  MCP server, against those pages — not from memory.
- **Invariants that still apply (from AGENTS.md):** the connector renders in-process; no
  HTTP/web server is added; the default path stays free of Java/Graphviz/Docker; the default must
  not send diagram source off-machine; the server stays host-agnostic and packaging lives in thin
  wrappers, never in `core/`/`tools/`. This slice is a thin wrapper — keep it that way.
- **Private-repo reality:** the repo is private. Installing from a private GitHub repo relies on
  the user's own git credentials to clone. State this clearly in the install docs; do not embed
  any token or credential anywhere.

# Reasoning and handling uncertainty

- Vet every choice against `AGENTS.md` and the ADRs before implementing. If you must deviate from
  an ADR, write a new ADR instead of silently overriding one.
- Handle uncertainty in tiers. First check whether `AGENTS.md`, the ADRs, or the live docs already
  answer the question. If still unclear: for **small, reversible** choices, proceed with an
  explicitly stated assumption (label it `Assumption:` in your plan); for anything **irreversible,
  architectural, security-relevant, or ADR-conflicting**, stop and ask the person. Never fill an
  ambiguity silently — this includes inventing manifest fields when the docs are ambiguous.
- Prefer the simplest structure that works (KISS). If a step feels like a workaround, surface the
  real problem instead of patching around it.

# Subagent and model policy (token economy)

Route each piece of work to the cheapest model that can do it well; reserve the strong model for
judgment. This is a cost decision, not a quality compromise — match the model to the task.

- **Orchestration, the plan, the security/architecture review, ADR wording, final judgment** ->
  keep on the main session model (Opus 4.8 / `inherit`).
- **Mechanical implementation** (writing the manifest/JSON files, editing README) -> **Sonnet**.
- **Exploration, multi-file reading, doc sweeps, build/test output triage** -> **Haiku** (the
  built-in Explore agent already runs on Haiku; lean on it for read-only context gathering).

Apply this via the subagent `model` field / per-invocation model when you delegate. If you define
any custom subagent file for this work, set its `model` frontmatter accordingly (`haiku` |
`sonnet` | `opus` | `inherit`, or a full ID such as `claude-opus-4-8`). Do not over-delegate:
small single-file edits you can do directly should not become a subagent.

# Output and interaction

- **Talk to the person in Turkish** — the plan, questions, status, and the closing summary. Keep
  all repo artifacts in **English**: file contents, JSON, comments, README text, commit messages,
  ADRs.
- Conventional Commits (`feat:`, `docs:`, `chore:` ...). Keep chat output brief; put durable
  results in repo files, not long prose dumps in the chat.
- Tick the relevant Faz 4 item(s) in `docs/PROJECT-PLAN.md` for what this slice actually shipped,
  and leave the rest of Faz 4 clearly unchecked.

# Done criteria

This slice is complete when ALL hold:
- The marketplace manifest validates and the plugin is discoverable from the repo via
  `/plugin marketplace add` against a local clone (verify locally — a local path add is sufficient
  proof; you need not push to test).
- Installing the plugin registers the MCP server and exposes `render_diagram`, `resolve_includes`,
  and `validate`, launching the built stdio server over Node with the `wasm` engine.
- A real `.puml` renders inline through the installed plugin path (or, if Claude Code restart is
  required to load it, the manifest + `.mcp.json` are verified correct and the launch command is
  confirmed runnable: `node packages/server/dist/index.js` starts and speaks MCP over stdio).
- Install/usage docs exist with the two commands, the build prerequisite, the private-repo note,
  and one working example prompt.
- Any non-obvious packaging decision is captured in an ADR; the reviewer (fresh context) has
  checked the diff against these criteria and AGENTS.md invariants.

# Stop and ask the person if

- The current plugin/marketplace docs require a decision not covered by `AGENTS.md` or the ADRs
  (e.g. where the plugin folder must live relative to `packages/server`, or how the server path
  must be resolved for an arbitrary clone location).
- Making the GitHub-link install work would require relaxing an AGENTS.md invariant (adding a
  server, bundling Java, sending source off-machine) — it should not; if it seems to, stop.
- The private-repo constraint blocks clean local verification and a workaround would change the
  intended install UX.
