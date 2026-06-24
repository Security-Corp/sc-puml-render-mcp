/**
 * `validate` — checks PlantUML syntax without producing a full diagram, and
 * returns the offending line plus a suggested fix when it can. Read-only.
 *
 * TODO(Faz 2+): implement using the same engine's error output; map engine
 * diagnostics into a structured { ok, line?, message?, suggestion? }.
 */
export const VALIDATE_TOOL = {
  name: "validate_plantuml",
  description:
    "Validate PlantUML source and report syntax errors (line + suggestion) without rendering.",
} as const;
