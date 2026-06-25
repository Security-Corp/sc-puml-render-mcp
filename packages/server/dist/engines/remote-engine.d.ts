import type { RenderEngine, RenderRequest, RenderResult } from "../core/engine.js";
/**
 * Opt-in engine (ADR-001). Sends PlantUML source to a user-supplied PlantUML
 * server (their own / company-hosted, or any compatible server). This covers
 * the "user's own web server" + IDE-plugin-style flexibility requirement.
 *
 * PRIVACY: this engine intentionally sends source off-machine. It is only ever
 * selected when the user sets engine=remote + PLANTUML_SERVER_URL. Never make it
 * the default and never point it at a public server implicitly.
 *
 * TODO(Faz 3): PlantUML text encoding (deflate + custom base64) and GET/POST to
 * the configured server's /png and /svg endpoints.
 */
export declare class RemoteEngine implements RenderEngine {
    private readonly serverUrl;
    readonly id = "remote";
    constructor(serverUrl: string);
    render(_req: RenderRequest): Promise<RenderResult>;
}
