# ADR-004: Inline PNG, SVG offered as an additional resource

- Status: Accepted
- Date: 2026-06-19

## Context

The product goal is diagrams rendered **inline in the chat**. MCP tool results carry images as
`image` content blocks. In practice, raster formats (PNG/JPEG) render inline reliably across
clients; `image/svg+xml` as an inline image content block is not reliably displayed everywhere.
Users still sometimes want vector output (scaling, editing).

## Decision

- `render_diagram` returns a **PNG `image` content block** for inline display by default.
- When the user requests SVG (or for large diagrams), provide **SVG as a separate resource/file**
  alongside, rather than as the inline image.
- `format` remains a user-controllable parameter; the inline-vs-resource handling adapts to it.

## Consequences

- Inline rendering is dependable regardless of client SVG support.
- Vector consumers are served without compromising inline display.
- Large-diagram strategy (DPI/scale caps, prefer SVG-as-resource) builds naturally on this split.
