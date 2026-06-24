# ADR-003: GitHub access via tool chaining, no embedded auth (MVP)

- Status: Accepted
- Date: 2026-06-19

## Context

Users want to render PlantUML that lives in their GitHub repositories. A third-party MCP server
cannot reuse the OAuth token of Claude's official GitHub connector — that token is scoped to
that connector. Options for our server to reach GitHub directly were: a user-supplied PAT
(`GITHUB_TOKEN` env var), reading a local checkout from the filesystem, or implementing our own
GitHub OAuth flow.

## Decision

For the MVP, **do not implement GitHub access in the connector**. Rely on **tool chaining**:
Claude uses its own GitHub (or filesystem) connector to fetch file contents, then passes the
text to `render_diagram`.

A dedicated GitHub source is deferred to Faz 3+, and only to serve the one case chaining handles
poorly: **recursive `!include` resolution across multiple files** in a private repo. When added,
it will use a user-supplied PAT or a local checkout — not embedded OAuth.

## Consequences

- MVP scope shrinks; no token storage, no OAuth, smaller attack surface and simpler submission.
- Single-file GitHub rendering works today through chaining, with no code in this repo.
- Multi-file `!include` chains from remote private repos are not supported until Faz 3+.
