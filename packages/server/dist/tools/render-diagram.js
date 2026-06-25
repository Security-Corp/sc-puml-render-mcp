import { z } from "zod";
import { resolveIncludes } from "../core/include-resolver.js";
import { toImageContentBlock, toSvgResourceContentBlock } from "../core/image-result.js";
import { FilesystemSource } from "../sources/filesystem-source.js";
import { TextSource } from "../sources/text-source.js";
export const RENDER_DIAGRAM_TOOL = {
    name: "render_diagram",
    description: "Render PlantUML source to an image shown inline in the chat. Renders locally by default; source does not leave the machine unless a remote engine is configured.",
};
export const RENDER_DIAGRAM_INPUT_SCHEMA = {
    source: z.string().min(1, "PlantUML source is required").optional(),
    filePath: z.string().min(1, "PlantUML file path is required").optional(),
    format: z.enum(["png", "svg"]).optional(),
};
export function registerRenderDiagramTool(server, deps) {
    server.registerTool(RENDER_DIAGRAM_TOOL.name, {
        title: "Render PlantUML diagram",
        description: RENDER_DIAGRAM_TOOL.description,
        inputSchema: RENDER_DIAGRAM_INPUT_SCHEMA,
        annotations: { readOnlyHint: true },
    }, async (input) => renderDiagram(input, deps));
}
export async function renderDiagram(input, deps) {
    const source = await resolveRenderInput(input, deps);
    const result = await deps.engine.render({
        source,
        format: input.format ?? deps.defaultFormat,
    });
    const content = [
        result.format === "png" ? toImageContentBlock(result) : toSvgResourceContentBlock(result),
    ];
    const svgArtifact = result.additionalArtifacts?.find(isSvgArtifact);
    if (svgArtifact) {
        content.push(toSvgResourceContentBlock(svgArtifact));
    }
    return { content };
}
function isSvgArtifact(artifact) {
    return artifact.format === "svg";
}
async function resolveRenderInput(input, deps) {
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
//# sourceMappingURL=render-diagram.js.map