/**
 * A Source resolves some reference into raw PlantUML text. Keeping this behind
 * an interface lets tools accept text, a local file, or (later) a GitHub
 * coordinate without the core caring which.
 */
export interface Source {
  readonly kind: string;
  /** Resolve to raw PlantUML text. */
  load(): Promise<string>;
}
