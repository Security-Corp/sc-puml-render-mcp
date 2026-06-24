# Privacy Policy — sc-puml-render-mcp

_Last updated: 2026-06-19_

A clear, accessible privacy policy is required for the Anthropic MCP directory. This is a draft
to be finalized before submission (Faz 4) and published at a stable public URL.

## Summary

`sc-puml-render-mcp` runs locally as an MCP server on your own machine. In its **default
configuration** it does not transmit your diagram source, file contents, or any personal data to
the maintainers or to any third party.

## Data handling by render engine

- **`wasm` (default):** PlantUML source is rendered entirely on your machine. Nothing is sent
  anywhere.
- **`remote` (opt-in):** If you configure `PLANTUML_SERVER_URL`, your PlantUML source is sent to
  the server you specify so it can be rendered. You control that server and its data practices.
  Choose a server you trust; do not point it at a public server for confidential diagrams.
- **`jar` (opt-in):** Rendering happens locally via a Java process. Nothing is sent anywhere.

## What we collect

The maintainers collect **no** data. This software has no telemetry, analytics, or phone-home
behavior.

## Includes and external resources

If your diagrams use `!includeurl` or similar directives that reference remote URLs, resolving
them will fetch those URLs. This is controlled by your diagram content and configuration.

## Contact

_Add a verified support/contact channel before submission (required by the directory policy)._
