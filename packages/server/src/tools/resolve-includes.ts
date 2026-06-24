/**
 * `resolve_includes` — returns the flattened PlantUML after resolving the
 * !include graph, as plain text. Useful for debugging multi-file arc42/C4
 * diagrams and for transparency about what will actually be rendered. Read-only.
 *
 * TODO(Faz 2): implement via core/include-resolver against a Source.
 */
export const RESOLVE_INCLUDES_TOOL = {
  name: "resolve_includes",
  description:
    "Resolve a PlantUML file's !include graph and return the flattened source as text.",
} as const;
