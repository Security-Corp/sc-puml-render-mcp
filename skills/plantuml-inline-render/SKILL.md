---
name: plantuml-inline-render
description: Render PlantUML/PUML diagrams inline in chat with the sc-puml-render MCP tools. Use when the user asks for PlantUML, PUML, UML, C4, sequence, component, deployment, state, class, activity, or architecture diagrams in PlantUML syntax, or whenever Codex is about to include a PlantUML code block in a response and should also show the rendered diagram without requiring a separate render prompt.
---

# PlantUML Inline Render

## Overview

When creating, editing, or explaining PlantUML, show both the source and the rendered result in the
same chat turn. Use the `sc-puml-render` MCP tools proactively; do not wait for the user to ask for
PNG/JPEG conversion unless they explicitly asked for source code only.

## Workflow

1. Include the PlantUML source in a fenced `plantuml` code block when the user should see or reuse
   the source.
2. Call `mcp__sc_puml_render.render_diagram` with the exact same `source`, `format: "png"`, and
   `targetWidth: 1600` before the final response. Omit `writeFile` or set it to `true` so the
   default file-backed Markdown output is available. Only omit `targetWidth` when the user
   explicitly asks for native-size output.
3. If the source comes from a local `.puml`, `.plantuml`, or `.iuml` file and the user wants that
   file rendered, call `render_diagram` with `filePath` instead.
4. In the final response, insert the returned `structuredContent.markdownImage` string exactly as
   Markdown so Codex can display the local PNG inline in the assistant message.
5. Use `mcp__sc_puml_render.validate` first when syntax is uncertain or when the user asks for a
   syntax check.
6. Use `mcp__sc_puml_render.resolve_includes` for multi-file diagrams before rendering or explaining
   include graphs.
7. If rendering fails, keep the PlantUML source in the answer and briefly report the render error.

## Output Rules

- Prefer PNG for inline chat display.
- For Codex final answers, use `targetWidth: 1600` so the Markdown image has enough raster width to
  fill the chat column while remaining sharp on high-DPI displays.
- Do not write "shown above" or similar unless the final response itself contains the
  `markdownImage` Markdown image.
- Do not describe the plugin mechanics unless the user asks.
- Do not ask the user for a second prompt like "render this" when the current task already includes
  PlantUML output.
- If the user asks for code-only output, skip rendering and state that the diagram was not rendered
  because code-only output was requested.
