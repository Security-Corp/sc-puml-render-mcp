# ADR-004: Inline PNG, SVG offered as an additional resource

- Status: Accepted
- Date: 2026-06-19

## Context

The product goal is diagrams rendered **inline in the chat**. MCP tool results carry images as
`image` content blocks. In practice, raster formats (PNG/JPEG) render inline reliably across
clients; `image/svg+xml` as an inline image content block is not reliably displayed everywhere.
Users still sometimes want vector output (scaling, editing).

Codex has a second display surface: the assistant's final Markdown response. A PNG `image` content
block can appear in the tool result panel without reliably being inserted into the assistant's final
message. Codex therefore needs a stable local PNG artifact and a Markdown image string the model can
copy into its answer.

## Decision

- `render_diagram` returns a **PNG `image` content block** for inline display by default.
- For PNG renders, `render_diagram` also writes a local temp/cache PNG by default and returns
  structured metadata containing the absolute file path, dimensions, MIME type, and Markdown image
  string for assistant-final Markdown embedding.
- File-backed Markdown PNG output defaults to a chat-friendly target width of about 1200 px while
  preserving aspect ratio.
- When the user requests SVG (or for large diagrams), provide **SVG as a separate resource/file**
  alongside, rather than as the inline image.
- `format` remains a user-controllable parameter; the inline-vs-resource handling adapts to it.

## Consequences

- Inline rendering is dependable regardless of client SVG support.
- Vector consumers are served without compromising inline display.
- Codex can include a full-width local PNG in the final assistant response instead of relying on
  implicit promotion of a tool-result image block.
- Large-diagram strategy (DPI/scale caps, prefer SVG-as-resource) builds naturally on this split.
