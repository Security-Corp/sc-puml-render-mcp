# ADR-002: License — Apache-2.0

- Status: Accepted
- Date: 2026-06-19

## Context

The connector will be open-sourced and submitted to the Anthropic MCP directory. Target users
are in banking / financial-sector organizations, where legal review of third-party software is
common and patent posture matters.

## Decision

License under **Apache-2.0**.

## Consequences

- Includes an explicit patent grant, which enterprise/legal reviewers generally prefer over MIT.
- Compatible with directory distribution and commercial use.
- Adds a small `NOTICE`/attribution obligation for downstream redistributors (acceptable).
- Reversible to MIT before first public release if a contributor or policy requires it; after
  external contributions arrive, a license change needs contributor agreement.

## Update 2026-06-24 — Runtime Dependency Licenses

Faz 1 adds runtime dependencies to the publishable server. They are compatible with distributing
this project under Apache-2.0, but their own license notices must remain available in the npm
package:

- `@plantuml/core@1.2026.6` — MIT. Versions before `1.2026.6` were GPL-3.0-or-later, so the
  package must stay pinned at or above the MIT-licensed release line.
- `@resvg/resvg-wasm@2.6.2` — MPL-2.0. MPL-2.0 is a weak-copyleft license compatible with
  Apache-2.0 distribution when the covered files remain under MPL-2.0 and the license text is
  preserved. We do not modify the upstream MPL-covered files.
- `dejavu-fonts-ttf@2.37.3` — Bitstream Vera / Arev font terms. The font copyright and
  permission notices must be preserved; the fonts must not be sold by themselves; modified fonts
  would need to be renamed. We ship them unmodified as a runtime font dependency.

Practical packaging rule: for npm distribution, rely on the normal dependency tree to carry each
dependency's license files; for MCPB or any bundled binary-style distribution, include prominent
third-party license labels/notices for MPL-2.0 and font dependencies. Include this note in release
review before public distribution.
