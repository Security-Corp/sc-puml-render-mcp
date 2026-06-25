import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
    writeFile: z.boolean().optional(),
    targetWidth: z.number().int().positive().optional(),
};
const MIN_TARGET_WIDTH = 64;
const MAX_TARGET_WIDTH = 4_096;
const OUTPUT_DIR = path.join(tmpdir(), "sc-puml-render-mcp");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export function registerRenderDiagramTool(server, deps) {
    server.registerTool(RENDER_DIAGRAM_TOOL.name, {
        title: "Render PlantUML diagram",
        description: RENDER_DIAGRAM_TOOL.description,
        inputSchema: RENDER_DIAGRAM_INPUT_SCHEMA,
        outputSchema: {
            ok: z.boolean(),
            format: z.enum(["png", "svg"]),
            mimeType: z.enum(["image/png", "image/svg+xml"]),
            width: z.number().int().positive().optional(),
            height: z.number().int().positive().optional(),
            filePath: z.string().optional(),
            markdownImage: z.string().optional(),
            image: z
                .object({
                mimeType: z.literal("image/png"),
                width: z.number().int().positive(),
                height: z.number().int().positive(),
                filePath: z.string().optional(),
                markdownImage: z.string().optional(),
            })
                .optional(),
        },
        annotations: { readOnlyHint: true },
    }, async (input) => renderDiagram(input, deps));
}
export async function renderDiagram(input, deps) {
    const source = await resolveRenderInput(input, deps);
    const format = input.format ?? deps.defaultFormat;
    const writePngFile = format === "png" && input.writeFile !== false;
    const targetWidth = normalizeTargetWidth(input.targetWidth);
    const result = await deps.engine.render({
        source,
        format,
        ...(targetWidth === undefined ? {} : { targetWidth }),
    });
    const content = [
        result.format === "png" ? toImageContentBlock(result) : toSvgResourceContentBlock(result),
    ];
    const svgArtifact = result.additionalArtifacts?.find(isSvgArtifact);
    if (svgArtifact) {
        content.push(toSvgResourceContentBlock(svgArtifact));
    }
    return {
        content,
        structuredContent: await createStructuredContent(input, source, result, writePngFile),
    };
}
function isSvgArtifact(artifact) {
    return artifact.format === "svg";
}
async function createStructuredContent(input, source, result, writePngFile) {
    const dimensions = result.format === "png" ? pngDimensions(result.bytes) : undefined;
    const filePath = result.format === "png" && writePngFile
        ? await writePngArtifact(input, source, result.bytes)
        : undefined;
    const markdownImage = filePath === undefined ? undefined : `![PlantUML diagram](${filePath})`;
    return {
        ok: true,
        format: result.format,
        mimeType: result.mimeType,
        ...(dimensions === undefined ? {} : dimensions),
        ...(filePath === undefined ? {} : { filePath }),
        ...(markdownImage === undefined ? {} : { markdownImage }),
        ...(dimensions === undefined
            ? {}
            : {
                image: {
                    mimeType: "image/png",
                    width: dimensions.width,
                    height: dimensions.height,
                    ...(filePath === undefined ? {} : { filePath }),
                    ...(markdownImage === undefined ? {} : { markdownImage }),
                },
            }),
    };
}
async function writePngArtifact(input, source, bytes) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
    const rawBaseName = input.filePath === undefined
        ? "plantuml-source"
        : path.basename(input.filePath, path.extname(input.filePath));
    const baseName = sanitizeFileComponent(rawBaseName);
    const filePath = path.join(OUTPUT_DIR, `${baseName}-${hash}.png`);
    await writeFile(filePath, bytes);
    return filePath;
}
function sanitizeFileComponent(value) {
    const sanitized = value
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9._-]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, 64);
    if (!sanitized || sanitized === "." || sanitized === "..") {
        return "plantuml-diagram";
    }
    return sanitized;
}
function normalizeTargetWidth(targetWidth) {
    if (targetWidth === undefined) {
        return undefined;
    }
    if (!Number.isFinite(targetWidth)) {
        throw new Error(`targetWidth must be a finite positive integer, got ${targetWidth}`);
    }
    return Math.min(MAX_TARGET_WIDTH, Math.max(MIN_TARGET_WIDTH, Math.round(targetWidth)));
}
function pngDimensions(bytes) {
    const buffer = Buffer.from(bytes);
    if (buffer.length < 24 || !buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        throw new Error("Rendered PNG is invalid or missing the PNG signature.");
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
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