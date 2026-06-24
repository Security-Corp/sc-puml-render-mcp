import type { Source } from "./source.js";

/**
 * Reads PlantUML from a local file path (e.g. a local git checkout). Preferred
 * over a GitHub source where possible — no token, and !include resolution can
 * walk the local tree (Faz 2).
 *
 * TODO(Faz 2): read file, and constrain include resolution to an allowed base
 * directory to avoid path traversal.
 */
export class FilesystemSource implements Source {
  readonly kind = "filesystem";
  constructor(private readonly path: string) {}
  async load(): Promise<string> {
    throw new Error(`not implemented (Faz 2); path=${this.path}`);
  }
}
