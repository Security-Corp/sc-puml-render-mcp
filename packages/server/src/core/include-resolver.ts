import type { Source, SourceContent, SourceLoadRequest } from "./source.js";

export type IncludeResolutionErrorCode =
  | "INCLUDE_CYCLE"
  | "INCLUDE_ONCE_REPEATED"
  | "INVALID_REMOTE_URL"
  | "LOCAL_INCLUDE_UNAVAILABLE"
  | "MAX_DEPTH_EXCEEDED"
  | "MAX_TOTAL_SIZE_EXCEEDED"
  | "REMOTE_REDIRECT_NOT_ALLOWED"
  | "REMOTE_HOST_NOT_ALLOWED"
  | "REMOTE_INCLUDE_DISABLED"
  | "UNSUPPORTED_INCLUDE_SELECTOR";

export class IncludeResolutionError extends Error {
  constructor(
    readonly code: IncludeResolutionErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "IncludeResolutionError";
  }
}

export interface IncludeResolverOptions {
  readonly maxDepth: number;
  readonly maxTotalBytes: number;
  /** Hosts permitted for !includeurl. Empty = remote includes disabled. */
  readonly remoteAllowlist: readonly string[];
}

interface IncludeDirective {
  readonly command: "include" | "include_many" | "include_once" | "includeurl";
  readonly target: string;
  readonly lineNumber: number;
}

interface ResolverState {
  readonly source: Source;
  readonly options: IncludeResolverOptions;
  readonly includedUris: Set<string>;
  readonly remoteAllowlist: Set<string>;
  totalBytes: number;
}

/**
 * Resolves the `!include` / `!includeurl` graph for multi-file diagrams
 * (arc42 / C4). This is the real differentiator over other PlantUML MCP servers.
 *
 * SECURITY (AGENTS.md invariant #6): remote includes are an injection surface.
 * - Resolve local includes first (filesystem source / local checkout).
 * - Gate remote includes behind an explicit allowlist.
 * - Enforce a maximum include depth and total size limit.
 */
export async function resolveIncludes(
  source: Source,
  opts: IncludeResolverOptions,
  request: SourceLoadRequest = {}
): Promise<string> {
  const normalizedOptions = normalizeOptions(opts);
  const state: ResolverState = {
    source,
    options: normalizedOptions,
    includedUris: new Set(),
    remoteAllowlist: new Set(normalizedOptions.remoteAllowlist.map((host) => host.toLowerCase())),
    totalBytes: 0,
  };
  const entry = await source.load(request);
  return resolveLoadedSource(entry, state, 0, []);
}

function normalizeOptions(options: IncludeResolverOptions): IncludeResolverOptions {
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0) {
    throw new IncludeResolutionError("MAX_DEPTH_EXCEEDED", "maxDepth must be a non-negative integer");
  }
  if (!Number.isInteger(options.maxTotalBytes) || options.maxTotalBytes <= 0) {
    throw new IncludeResolutionError(
      "MAX_TOTAL_SIZE_EXCEEDED",
      "maxTotalBytes must be a positive integer"
    );
  }

  return {
    maxDepth: options.maxDepth,
    maxTotalBytes: options.maxTotalBytes,
    remoteAllowlist: options.remoteAllowlist.map((host) => host.trim()).filter(Boolean),
  };
}

async function resolveLoadedSource(
  content: SourceContent,
  state: ResolverState,
  depth: number,
  stack: readonly string[]
): Promise<string> {
  if (stack.includes(content.uri)) {
    throw new IncludeResolutionError("INCLUDE_CYCLE", "Cycle detected in PlantUML include graph", {
      cycle: [...stack, content.uri],
    });
  }

  addSize(content, state);

  const nextStack = [...stack, content.uri];
  const output: string[] = [];
  const lines = content.text.split(/\r\n|\r|\n/u);
  let inBlockComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const commentState = updateBlockCommentState(line, inBlockComment);
    const directive = commentState.inComment
      ? undefined
      : parseIncludeDirective(line, index + 1);
    inBlockComment = commentState.nextInBlockComment;
    if (!directive) {
      output.push(line);
      continue;
    }

    if (depth + 1 > state.options.maxDepth) {
      throw new IncludeResolutionError(
        "MAX_DEPTH_EXCEEDED",
        `Maximum include depth exceeded at ${content.uri}:${directive.lineNumber}`,
        { maxDepth: state.options.maxDepth, uri: content.uri, line: directive.lineNumber }
      );
    }

    const knownRemoteUri = remoteIncludeUriIfKnown(directive, content);
    if (
      knownRemoteUri &&
      isIncludeOnceByDefault(directive.command) &&
      state.includedUris.has(knownRemoteUri)
    ) {
      continue;
    }
    if (
      knownRemoteUri &&
      directive.command === "include_once" &&
      state.includedUris.has(knownRemoteUri)
    ) {
      throw new IncludeResolutionError(
        "INCLUDE_ONCE_REPEATED",
        `!include_once target was included more than once: ${knownRemoteUri}`,
        { uri: knownRemoteUri }
      );
    }

    const included = await loadIncludedSource(directive, content, state);

    if (isIncludeOnceByDefault(directive.command) && state.includedUris.has(included.uri)) {
      continue;
    }
    if (directive.command === "include_once" && state.includedUris.has(included.uri)) {
      throw new IncludeResolutionError(
        "INCLUDE_ONCE_REPEATED",
        `!include_once target was included more than once: ${included.uri}`,
        { uri: included.uri }
      );
    }
    if (directive.command !== "include_many") {
      state.includedUris.add(included.uri);
    }

    output.push(await resolveLoadedSource(included, state, depth + 1, nextStack));
  }

  return output.join("\n");
}

function addSize(content: SourceContent, state: ResolverState): void {
  state.totalBytes += Buffer.byteLength(content.text, "utf8");
  if (state.totalBytes > state.options.maxTotalBytes) {
    throw new IncludeResolutionError(
      "MAX_TOTAL_SIZE_EXCEEDED",
      `Resolved PlantUML include graph exceeds ${state.options.maxTotalBytes} bytes`,
      { maxTotalBytes: state.options.maxTotalBytes, totalBytes: state.totalBytes }
    );
  }
}

function parseIncludeDirective(line: string, lineNumber: number): IncludeDirective | undefined {
  const trimmed = line.trimStart();
  if (!trimmed || trimmed.startsWith("'")) {
    return undefined;
  }

  const match = trimmed.match(/^!(include(?:_many|_once)?|includeurl|includesub)\s+(.+)$/u);
  if (!match) {
    return undefined;
  }

  const command = match[1];
  const rawTarget = match[2];
  if (!isIncludeCommand(command) || rawTarget === undefined) {
    if (command === "includesub") {
      throw new IncludeResolutionError(
        "UNSUPPORTED_INCLUDE_SELECTOR",
        "!includesub is not supported by the Faz 2 include resolver"
      );
    }
    return undefined;
  }

  const target = stripInlinePlantUmlComment(rawTarget).trim();
  if (!target) {
    return undefined;
  }

  return { command, target, lineNumber };
}

function isIncludeCommand(value: string | undefined): value is IncludeDirective["command"] {
  return (
    value === "include" ||
    value === "include_many" ||
    value === "include_once" ||
    value === "includeurl"
  );
}

function isIncludeOnceByDefault(command: IncludeDirective["command"]): boolean {
  return command === "include" || command === "includeurl";
}

function stripInlinePlantUmlComment(value: string): string {
  return value.replace(/\s+'.*$/u, "");
}

async function loadIncludedSource(
  directive: IncludeDirective,
  current: SourceContent,
  state: ResolverState
): Promise<SourceContent> {
  const target = normalizeIncludeTarget(directive.target);
  rejectUnsupportedSelector(target);

  if (directive.command === "includeurl" || isHttpUrl(target)) {
    return loadRemoteInclude(target, current, state, directive);
  }

  if (!current.path) {
    throw new IncludeResolutionError(
      "LOCAL_INCLUDE_UNAVAILABLE",
      `Cannot resolve local include without a filesystem-backed source at ${current.uri}:${directive.lineNumber}`,
      { uri: current.uri, line: directive.lineNumber, target }
    );
  }

  return state.source.load({ path: target, includingPath: current.path });
}

function normalizeIncludeTarget(target: string): string {
  const trimmed = target.trim();
  const unquoted =
    stripMatchingDelimiters(trimmed, '"', '"') ?? stripMatchingDelimiters(trimmed, "'", "'");
  const withoutQuotes = unquoted ?? trimmed;
  return stripMatchingDelimiters(withoutQuotes, "<", ">") ?? withoutQuotes;
}

function stripMatchingDelimiters(value: string, left: string, right: string): string | undefined {
  if (value.startsWith(left) && value.endsWith(right) && value.length >= left.length + right.length) {
    return value.slice(left.length, -right.length);
  }
  return undefined;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//iu.test(value);
}

function rejectUnsupportedSelector(target: string): void {
  if (/![A-Za-z0-9_-]+$/u.test(target) && !isHttpUrl(target)) {
    throw new IncludeResolutionError(
      "UNSUPPORTED_INCLUDE_SELECTOR",
      `PlantUML include block selectors are not supported in Faz 2: ${target}`,
      { target }
    );
  }
}

async function loadRemoteInclude(
  target: string,
  current: SourceContent,
  state: ResolverState,
  directive: IncludeDirective
): Promise<SourceContent> {
  const url = parseRemoteUrl(target, current.uri, directive);
  assertRemoteAllowed(url, state, current, directive);

  const response = await fetch(url, { redirect: "manual" });
  if (isRedirect(response.status)) {
    throw new IncludeResolutionError(
      "REMOTE_REDIRECT_NOT_ALLOWED",
      `Remote include redirects are not followed in Faz 2: ${url.href}`,
      { url: url.href, location: response.headers.get("location") ?? undefined }
    );
  }
  const finalUrl = response.url ? new URL(response.url) : url;
  assertRemoteAllowed(finalUrl, state, current, directive);
  if (!response.ok) {
    throw new IncludeResolutionError(
      "INVALID_REMOTE_URL",
      `Remote include failed with HTTP ${response.status}: ${finalUrl.href}`,
      { url: finalUrl.href, status: response.status }
    );
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && state.totalBytes + Number(contentLength) > state.options.maxTotalBytes) {
    throw new IncludeResolutionError(
      "MAX_TOTAL_SIZE_EXCEEDED",
      `Remote include would exceed ${state.options.maxTotalBytes} bytes: ${finalUrl.href}`,
      { url: finalUrl.href, maxTotalBytes: state.options.maxTotalBytes }
    );
  }

  return {
    text: await readRemoteTextWithLimit(response, state, finalUrl),
    uri: finalUrl.href,
  };
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function remoteIncludeUriIfKnown(
  directive: IncludeDirective,
  current: SourceContent
): string | undefined {
  const target = normalizeIncludeTarget(directive.target);
  if (directive.command !== "includeurl" && !isHttpUrl(target)) {
    return undefined;
  }

  try {
    return parseRemoteUrl(target, current.uri, directive).href;
  } catch {
    return undefined;
  }
}

async function readRemoteTextWithLimit(
  response: Response,
  state: ResolverState,
  url: URL
): Promise<string> {
  const remainingBytes = state.options.maxTotalBytes - state.totalBytes;
  if (remainingBytes <= 0) {
    throw new IncludeResolutionError(
      "MAX_TOTAL_SIZE_EXCEEDED",
      `Remote include would exceed ${state.options.maxTotalBytes} bytes: ${url.href}`,
      { url: url.href, maxTotalBytes: state.options.maxTotalBytes }
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    bytesRead += value.byteLength;
    if (bytesRead > remainingBytes) {
      await reader.cancel();
      throw new IncludeResolutionError(
        "MAX_TOTAL_SIZE_EXCEEDED",
        `Remote include exceeds ${state.options.maxTotalBytes} bytes: ${url.href}`,
        { url: url.href, maxTotalBytes: state.options.maxTotalBytes }
      );
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(concatChunks(chunks, bytesRead));
}

function concatChunks(chunks: readonly Uint8Array[], totalBytes: number): Uint8Array {
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function parseRemoteUrl(
  target: string,
  currentUri: string,
  directive: IncludeDirective
): URL {
  try {
    if (isHttpUrl(target)) {
      return new URL(target);
    }
    if (isHttpUrl(currentUri)) {
      return new URL(target, currentUri);
    }
  } catch (err) {
    throw new IncludeResolutionError("INVALID_REMOTE_URL", `Invalid remote include URL: ${target}`, {
      target,
      cause: String(err),
    });
  }

  throw new IncludeResolutionError(
    "INVALID_REMOTE_URL",
    `!includeurl requires an absolute http(s) URL at ${directive.lineNumber}`,
    { target, line: directive.lineNumber }
  );
}

function updateBlockCommentState(
  line: string,
  inBlockComment: boolean
): { inComment: boolean; nextInBlockComment: boolean } {
  let nextInBlockComment = inBlockComment;
  let inComment = inBlockComment;
  let searchFrom = 0;

  while (searchFrom < line.length) {
    if (nextInBlockComment) {
      const end = line.indexOf("'/", searchFrom);
      if (end === -1) {
        return { inComment: true, nextInBlockComment: true };
      }
      nextInBlockComment = false;
      searchFrom = end + 2;
      continue;
    }

    const start = line.indexOf("/'", searchFrom);
    if (start === -1) {
      break;
    }
    inComment = start === 0 || line.slice(0, start).trim() === "";
    const end = line.indexOf("'/", start + 2);
    if (end === -1) {
      nextInBlockComment = true;
      break;
    }
    searchFrom = end + 2;
  }

  return { inComment, nextInBlockComment };
}

function assertRemoteAllowed(
  url: URL,
  state: ResolverState,
  current: SourceContent,
  directive: IncludeDirective
): void {
  if (state.remoteAllowlist.size === 0) {
    throw new IncludeResolutionError(
      "REMOTE_INCLUDE_DISABLED",
      `Remote includes are disabled by default: ${url.href}`,
      { url: url.href, uri: current.uri, line: directive.lineNumber }
    );
  }

  const host = url.host.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  if (!state.remoteAllowlist.has(host) && !state.remoteAllowlist.has(hostname)) {
    throw new IncludeResolutionError(
      "REMOTE_HOST_NOT_ALLOWED",
      `Remote include host is not allowlisted: ${url.host}`,
      { url: url.href, host: url.host, uri: current.uri, line: directive.lineNumber }
    );
  }
}
