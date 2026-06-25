import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
export class FilesystemSourceError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "FilesystemSourceError";
    }
}
/**
 * Reads PlantUML from a local file path (e.g. a local git checkout). Preferred
 * over a GitHub source where possible — no token, and !include resolution can
 * walk the local tree (Faz 2).
 */
export class FilesystemSource {
    options;
    kind = "filesystem";
    baseDirRealPath;
    constructor(options) {
        this.options = options;
        this.baseDirRealPath = realpath(options.baseDir);
    }
    async load(request = {}) {
        const requestedPath = request.path ?? this.options.entryPath;
        if (!requestedPath) {
            throw new FilesystemSourceError("FILE_NOT_FOUND", "No PlantUML file path was provided.");
        }
        const baseDir = await this.baseDirRealPath;
        const filePath = await this.resolveInsideBase(requestedPath, request.includingPath, baseDir);
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
            throw new FilesystemSourceError("NOT_FILE", `PlantUML path is not a file: ${filePath}`);
        }
        return {
            text: await readFile(filePath, "utf8"),
            uri: pathToFileURL(filePath).href,
            path: filePath,
        };
    }
    async resolveInsideBase(requestedPath, includingPath, baseDir) {
        const candidates = candidatePaths(requestedPath, includingPath, baseDir);
        let lastNotFound;
        for (const candidate of candidates) {
            try {
                const realCandidate = await realpath(candidate);
                assertInsideBase(realCandidate, baseDir, requestedPath);
                return realCandidate;
            }
            catch (err) {
                if (err instanceof FilesystemSourceError) {
                    throw err;
                }
                if (!isNotFoundError(err)) {
                    throw err;
                }
                lastNotFound = err;
            }
        }
        throw new FilesystemSourceError("FILE_NOT_FOUND", `PlantUML file was not found inside ${baseDir}: ${requestedPath}`, { cause: lastNotFound });
    }
}
function candidatePaths(requestedPath, includingPath, baseDir) {
    const normalizedPath = stripPlantUmlIncludeDelimiters(requestedPath);
    if (path.isAbsolute(normalizedPath)) {
        return [path.resolve(normalizedPath)];
    }
    const candidates = [];
    if (includingPath) {
        candidates.push(path.resolve(path.dirname(includingPath), normalizedPath));
    }
    candidates.push(path.resolve(baseDir, normalizedPath));
    return [...new Set(candidates)];
}
function stripPlantUmlIncludeDelimiters(value) {
    const trimmed = value.trim();
    const unquoted = stripMatchingDelimiters(trimmed, '"', '"') ?? stripMatchingDelimiters(trimmed, "'", "'");
    const withoutQuotes = unquoted ?? trimmed;
    return stripMatchingDelimiters(withoutQuotes, "<", ">") ?? withoutQuotes;
}
function stripMatchingDelimiters(value, left, right) {
    if (value.startsWith(left) && value.endsWith(right) && value.length >= left.length + right.length) {
        return value.slice(left.length, -right.length);
    }
    return undefined;
}
function assertInsideBase(filePath, baseDir, requestedPath) {
    const relative = path.relative(baseDir, filePath);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
        return;
    }
    throw new FilesystemSourceError("PATH_OUTSIDE_BASE", `Refusing to read outside allowed base directory: ${requestedPath}`);
}
function isNotFoundError(err) {
    return typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT";
}
//# sourceMappingURL=filesystem-source.js.map