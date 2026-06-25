import { z } from "zod";
import { resolveIncludes } from "../core/include-resolver.js";
import { FilesystemSource } from "../sources/filesystem-source.js";
export const RESOLVE_INCLUDES_TOOL = {
    name: "resolve_includes",
    description: "Resolve a PlantUML file's !include graph and return the flattened source as text.",
};
export const RESOLVE_INCLUDES_INPUT_SCHEMA = {
    filePath: z.string().min(1, "PlantUML file path is required"),
};
export function registerResolveIncludesTool(server, deps) {
    server.registerTool(RESOLVE_INCLUDES_TOOL.name, {
        title: "Resolve PlantUML includes",
        description: RESOLVE_INCLUDES_TOOL.description,
        inputSchema: RESOLVE_INCLUDES_INPUT_SCHEMA,
        annotations: { readOnlyHint: true },
    }, async (input) => resolveIncludesTool(input, deps));
}
export async function resolveIncludesTool(input, deps) {
    const flattened = await resolveIncludes(new FilesystemSource({ baseDir: deps.filesystemBaseDir, entryPath: input.filePath }), deps.includeResolverOptions);
    return {
        content: [{ type: "text", text: flattened }],
        structuredContent: {
            ok: true,
            bytes: Buffer.byteLength(flattened, "utf8"),
        },
    };
}
//# sourceMappingURL=resolve-includes.js.map