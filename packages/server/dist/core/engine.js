/**
 * The seam the whole render strategy hangs on (ADR-001).
 *
 * `core` depends ONLY on this interface. Concrete engines live in `../engines`
 * and are selected at runtime via config (`engine: wasm | remote | jar`).
 * Do not import a concrete engine from `core`.
 */
export {};
//# sourceMappingURL=engine.js.map