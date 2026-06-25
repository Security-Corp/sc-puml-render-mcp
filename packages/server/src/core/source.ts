/**
 * A Source resolves some reference into raw PlantUML text. Keeping this behind
 * an interface lets tools accept text, a local file, or (later) a GitHub
 * coordinate without the include resolver caring which concrete adapter is used.
 */
export interface SourceLoadRequest {
  /**
   * Source-specific path or coordinate to load. Filesystem sources interpret
   * relative paths against `includingPath` first, then their allowed base dir.
   */
  readonly path?: string;
  /** Canonical path/coordinate of the file containing a relative include. */
  readonly includingPath?: string;
}

export interface SourceContent {
  readonly text: string;
  /** Stable identity used for cycle detection and diagnostics. */
  readonly uri: string;
  /** Canonical local path when the source is filesystem-backed. */
  readonly path?: string;
}

export interface Source {
  readonly kind: string;
  /** Resolve to raw PlantUML text plus source identity. */
  load(request?: SourceLoadRequest): Promise<SourceContent>;
}
