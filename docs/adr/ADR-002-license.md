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
