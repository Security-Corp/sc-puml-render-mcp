import type { Source, SourceContent, SourceLoadRequest } from "../core/source.js";
/** The common case: PlantUML text passed directly (e.g. via tool chaining). */
export declare class TextSource implements Source {
    private readonly text;
    readonly kind = "text";
    constructor(text: string);
    load(request?: SourceLoadRequest): Promise<SourceContent>;
}
