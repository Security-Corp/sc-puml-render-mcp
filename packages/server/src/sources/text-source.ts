import type { Source, SourceContent, SourceLoadRequest } from "../core/source.js";

/** The common case: PlantUML text passed directly (e.g. via tool chaining). */
export class TextSource implements Source {
  readonly kind = "text";
  constructor(private readonly text: string) {}

  async load(request: SourceLoadRequest = {}): Promise<SourceContent> {
    if (request.path) {
      throw new Error("Inline PlantUML text cannot resolve local !include paths.");
    }
    return { text: this.text, uri: "text://inline" };
  }
}
