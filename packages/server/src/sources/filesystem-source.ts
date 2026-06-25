import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Source, SourceContent, SourceLoadRequest } from "../core/source.js";

export type FilesystemSourceErrorCode = "FILE_NOT_FOUND" | "NOT_FILE" | "PATH_OUTSIDE_BASE";

export class FilesystemSourceError extends Error {
  constructor(
    readonly code: FilesystemSourceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "FilesystemSourceError";
  }
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
export class FilesystemSource implements Source {
  readonly kind = "filesystem";
  private readonly baseDirRealPath: Promise<string>;

  constructor(private readonly options: FilesystemSourceOptions) {
    this.baseDirRealPath = realpath(options.baseDir);
  }

  async load(request: SourceLoadRequest = {}): Promise<SourceContent> {
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

  private async resolveInsideBase(
    requestedPath: string,
    includingPath: string | undefined,
    baseDir: string
  ): Promise<string> {
    const candidates = candidatePaths(requestedPath, includingPath, baseDir);
    let lastNotFound: unknown;

    for (const candidate of candidates) {
      try {
        const realCandidate = await realpath(candidate);
        assertInsideBase(realCandidate, baseDir, requestedPath);
        return realCandidate;
      } catch (err) {
        if (err instanceof FilesystemSourceError) {
          throw err;
        }
        if (!isNotFoundError(err)) {
          throw err;
        }
        lastNotFound = err;
      }
    }

    throw new FilesystemSourceError(
      "FILE_NOT_FOUND",
      `PlantUML file was not found inside ${baseDir}: ${requestedPath}`,
      { cause: lastNotFound }
    );
  }
}

function candidatePaths(requestedPath: string, includingPath: string | undefined, baseDir: string): string[] {
  const normalizedPath = stripPlantUmlIncludeDelimiters(requestedPath);
  if (path.isAbsolute(normalizedPath)) {
    return [path.resolve(normalizedPath)];
  }

  const candidates: string[] = [];
  if (includingPath) {
    candidates.push(path.resolve(path.dirname(includingPath), normalizedPath));
  }
  candidates.push(path.resolve(baseDir, normalizedPath));
  return [...new Set(candidates)];
}

function stripPlantUmlIncludeDelimiters(value: string): string {
  const trimmed = value.trim();
  const unquoted = stripMatchingDelimiters(trimmed, '"', '"') ?? stripMatchingDelimiters(trimmed, "'", "'");
  const withoutQuotes = unquoted ?? trimmed;
  return stripMatchingDelimiters(withoutQuotes, "<", ">") ?? withoutQuotes;
}

function stripMatchingDelimiters(value: string, left: string, right: string): string | undefined {
  if (value.startsWith(left) && value.endsWith(right) && value.length >= left.length + right.length) {
    return value.slice(left.length, -right.length);
  }
  return undefined;
}

function assertInsideBase(filePath: string, baseDir: string, requestedPath: string): void {
  const relative = path.relative(baseDir, filePath);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new FilesystemSourceError(
    "PATH_OUTSIDE_BASE",
    `Refusing to read outside allowed base directory: ${requestedPath}`
  );
}

function isNotFoundError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT";
}
