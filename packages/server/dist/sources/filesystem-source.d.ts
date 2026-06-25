import type { Source, SourceContent, SourceLoadRequest } from "../core/source.js";
export type FilesystemSourceErrorCode = "FILE_NOT_FOUND" | "NOT_FILE" | "PATH_OUTSIDE_BASE";
export declare class FilesystemSourceError extends Error {
    readonly code: FilesystemSourceErrorCode;
    constructor(code: FilesystemSourceErrorCode, message: string, options?: ErrorOptions);
}
export interface FilesystemSourceOptions {
    readonly baseDir: string;
    readonly entryPath?: string;
}
/**
 * Reads PlantUML from a local file path (e.g. a local git checkout). Preferred
 * over a GitHub source where possible — no token, and !include resolution can
 * walk the local tree (Faz 2).
 */
export declare class FilesystemSource implements Source {
    private readonly options;
    readonly kind = "filesystem";
    private readonly baseDirRealPath;
    constructor(options: FilesystemSourceOptions);
    load(request?: SourceLoadRequest): Promise<SourceContent>;
    private resolveInsideBase;
}
