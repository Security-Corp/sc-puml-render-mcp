# ADR-007: Include resolution and filesystem security

- Status: Accepted
- Date: 2026-06-25

## Context

Faz 2 adds local `!include` graph resolution so multi-file arc42/C4 diagrams can render through
the local WASM engine. Include handling is security-sensitive because local paths can attempt
path traversal and `!includeurl` can fetch untrusted remote source.

PlantUML's preprocessor supports `!include`, `!include_many`, `!include_once`, URL includes,
block selectors such as `file.puml!1`, and `!includesub` sections. Faz 2 needs the common local
file graph first, without weakening the default privacy boundary.

## Decision

Implement include graph traversal in `core/include-resolver.ts` against the core `Source`
interface. Concrete source adapters live outside `core/`; `FilesystemSource` is the local adapter.
Tools only validate inputs, construct configured sources, call the resolver, and format MCP
responses.

Filesystem reads are confined to a configured base directory:

- Resolve the configured base directory with `realpath`.
- Resolve every entry/include candidate, then compare the candidate's `realpath` to the base
  `realpath`.
- Reject path traversal and symlink escapes when the final real path is outside the base.
- Resolve relative includes against the including file's real directory first, then the base
  directory.

Remote includes are denied by default:

- Empty remote allowlist means no remote fetch.
- Allowlist matching is exact against URL `host` or `hostname`; no suffix or substring matching.
- Redirects are not followed in Faz 2. A future implementation may follow redirects only if each
  hop is checked against the same allowlist before the next request.
- Remote response bodies are streamed and capped; missing or dishonest `Content-Length` headers
  cannot bypass the total size limit.
- Maximum include depth and total UTF-8 byte size apply to local and remote sources.

Supported Faz 2 include directives:

- `!include`: include a canonical target once.
- `!include_many`: include the same canonical target repeatedly, while still rejecting active
  include cycles.
- `!include_once`: reject if a canonical target is encountered more than once.
- `!includeurl`: fetch only when the final host is explicitly allowlisted.

Unsupported in Faz 2:

- `!includesub`
- block selectors such as `foo.puml!1` or `foo.puml!MY_ID`

Unsupported forms fail closed with a clear resolver error rather than being misread as filenames.

## Consequences

- The render engine still receives plain flattened PlantUML and remains unaware of filesystem or
  remote include policy.
- `render_diagram`, `resolve_includes`, and `validate` all share the same resolver path, so
  security behavior is consistent.
- Standard-library angle includes such as `<C4/...>` are treated as local include specifiers in
  Faz 2. Users who need C4 should keep those files under the configured base directory. A future
  stdlib resolver can be added deliberately if needed.
- Remote private-repo include chains remain deferred; they need a separate authenticated source
  design rather than model-controlled tool arguments.
