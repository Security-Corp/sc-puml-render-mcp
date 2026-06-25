import { z } from "zod";
import { resolveIncludes } from "../core/include-resolver.js";
import { FilesystemSource } from "../sources/filesystem-source.js";
import { TextSource } from "../sources/text-source.js";
export const VALIDATE_TOOL = {
    name: "validate",
    description: "Validate PlantUML source and report syntax errors (line + suggestion) without rendering.",
};
export const VALIDATE_INPUT_SCHEMA = {
    source: z.string().min(1, "PlantUML source is required").optional(),
    filePath: z.string().min(1, "PlantUML file path is required").optional(),
};
export function registerValidateTool(server, deps) {
    server.registerTool(VALIDATE_TOOL.name, {
        title: "Validate PlantUML",
        description: VALIDATE_TOOL.description,
        inputSchema: VALIDATE_INPUT_SCHEMA,
        outputSchema: {
            ok: z.boolean(),
            line: z.number().int().positive().optional(),
            message: z.string().optional(),
            suggestion: z.string().optional(),
        },
        annotations: { readOnlyHint: true },
    }, async (input) => validatePlantUml(input, deps));
}
export async function validatePlantUml(input, deps) {
    const result = await validatePlantUmlSource(input, deps);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: { ...result },
        isError: !result.ok,
    };
}
async function validatePlantUmlSource(input, deps) {
    let source;
    try {
        source = await resolveValidateInput(input, deps);
    }
    catch (err) {
        return {
            ok: false,
            message: errorMessage(err),
            suggestion: "Check include paths, remote include allowlist, and configured size/depth limits.",
        };
    }
    try {
        const result = await deps.engine.render({ source, format: "svg" });
        const svg = Buffer.from(result.bytes).toString("utf8");
        return parsePlantUmlDiagnostic(svg, source) ?? { ok: true };
    }
    catch (err) {
        return {
            ok: false,
            message: errorMessage(err),
            suggestion: "Check PlantUML syntax near the reported message.",
        };
    }
}
async function resolveValidateInput(input, deps) {
    if (input.source && input.filePath) {
        throw new Error("Provide either source or filePath, not both.");
    }
    if (input.filePath) {
        return resolveIncludes(new FilesystemSource({ baseDir: deps.filesystemBaseDir, entryPath: input.filePath }), deps.includeResolverOptions);
    }
    if (input.source) {
        return resolveIncludes(new TextSource(input.source), deps.includeResolverOptions);
    }
    throw new Error("PlantUML source or filePath is required.");
}
function parsePlantUmlDiagnostic(svg, source) {
    const text = extractSvgText(svg).join("\n");
    if (!/syntax error|error\?/iu.test(text)) {
        return undefined;
    }
    const line = Number(text.match(/\(line\s+(\d+)\)/iu)?.[1] ?? NaN);
    const message = extractSvgText(svg).find((entry) => /syntax error|error\?/iu.test(entry)) ??
        "PlantUML syntax error";
    return {
        ok: false,
        line: Number.isInteger(line) ? line : undefined,
        message,
        suggestion: suggestFix(text, source),
    };
}
function extractSvgText(svg) {
    return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/giu)]
        .map((match) => decodeXmlEntities((match[1] ?? "").replace(/<[^>]+>/gu, "")))
        .map((text) => text.trim())
        .filter(Boolean);
}
function decodeXmlEntities(value) {
    return value
        .replace(/&lt;/gu, "<")
        .replace(/&gt;/gu, ">")
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, "'")
        .replace(/&amp;/gu, "&");
}
function suggestFix(text, source) {
    if (!/@enduml/iu.test(source)) {
        return "Add or restore the closing @enduml line.";
    }
    if (/syntax error/iu.test(text)) {
        return "Check PlantUML syntax around the reported line.";
    }
    return "Review the PlantUML diagnostic and nearby lines.";
}
function errorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
//# sourceMappingURL=validate.js.map