import type { Source } from "./source.js";

/** The common case: PlantUML text passed directly (e.g. via tool chaining). */
export class TextSource implements Source {
  readonly kind = "text";
  constructor(private readonly text: string) {}
  async load(): Promise<string> {
    return this.text;
  }
}
