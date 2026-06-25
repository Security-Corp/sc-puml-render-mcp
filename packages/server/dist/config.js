export function loadConfig(env = process.env) {
    const engine = env.PUML_ENGINE ?? "wasm";
    const defaultFormat = env.PUML_DEFAULT_FORMAT ?? "png";
    const plantumlServerUrl = env.PLANTUML_SERVER_URL;
    const filesystemBaseDir = env.PUML_BASE_DIR ?? process.cwd();
    const includeMaxDepth = readPositiveInteger(env.PUML_INCLUDE_MAX_DEPTH, 10);
    const includeMaxTotalBytes = readPositiveInteger(env.PUML_INCLUDE_MAX_TOTAL_BYTES, 1_000_000);
    const remoteIncludeAllowlist = splitCsv(env.PUML_REMOTE_INCLUDE_ALLOWLIST);
    if (engine === "remote" && !plantumlServerUrl) {
        throw new Error("engine=remote requires PLANTUML_SERVER_URL to be set");
    }
    return {
        engine,
        defaultFormat,
        filesystemBaseDir,
        includeMaxDepth,
        includeMaxTotalBytes,
        remoteIncludeAllowlist,
        plantumlServerUrl,
    };
}
function readPositiveInteger(value, fallback) {
    if (value === undefined || value.trim() === "") {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`expected positive integer, got ${value}`);
    }
    return parsed;
}
function splitCsv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
//# sourceMappingURL=config.js.map