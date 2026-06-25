/** The common case: PlantUML text passed directly (e.g. via tool chaining). */
export class TextSource {
    text;
    kind = "text";
    constructor(text) {
        this.text = text;
    }
    async load(request = {}) {
        if (request.path) {
            throw new Error("Inline PlantUML text cannot resolve local !include paths.");
        }
        return { text: this.text, uri: "text://inline" };
    }
}
//# sourceMappingURL=text-source.js.map