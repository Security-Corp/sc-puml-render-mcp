import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import opentype from "opentype.js";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
const require = createRequire(import.meta.url);
const RENDER_TIMEOUT_MS = 15_000;
const MAX_AUTO_TARGET_WIDTH = 2_000;
const FONT_RENDER_OPTIONS = { kerning: true };
let sharedEnvironment;
let plantUmlQueue = Promise.resolve();
/**
 * Default engine (ADR-001). Renders PlantUML entirely in-process via the
 * official WASM/JS build (plantuml-core / plantuml.js, TeaVM + Viz.js).
 * No Java, external Graphviz, Docker, or web server; source never leaves the
 * machine. It uses a Node DOM shim plus an in-process WASM SVG rasterizer.
 */
export class WasmEngine {
    id = "wasm";
    async render(req) {
        const env = await getSharedEnvironment();
        const svg = await renderToSvg(req.source, env.renderToString);
        const svgResult = {
            format: "svg",
            bytes: Buffer.from(svg, "utf8"),
            mimeType: "image/svg+xml",
        };
        if (req.format === "svg") {
            return svgResult;
        }
        return {
            format: "png",
            bytes: rasterizeSvgToPng(svg, env.fontBuffers, req.targetWidth),
            mimeType: "image/png",
            additionalArtifacts: [svgResult],
        };
    }
}
async function getSharedEnvironment() {
    sharedEnvironment ??= initializeEnvironment().catch((err) => {
        sharedEnvironment = undefined;
        throw err;
    });
    return sharedEnvironment;
}
async function initializeEnvironment() {
    const [wasmBytes, fontAssets] = await Promise.all([
        readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
        loadFontAssets(),
    ]);
    const renderToString = await initializePlantUml(fontAssets.measurementFont);
    await initWasm(wasmBytes);
    return { renderToString, fontBuffers: fontAssets.fontBuffers };
}
async function initializePlantUml(measurementFont) {
    const vizGlobalUrl = pathToFileURL(require.resolve("@plantuml/core/viz-global.js")).href;
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://local.plantuml.invalid/",
        pretendToBeVisual: true,
    });
    const window = dom.window;
    installDomMeasurementShims(window, measurementFont);
    Object.assign(globalThis, {
        window,
        document: window.document,
        DOMParser: window.DOMParser,
        XMLSerializer: window.XMLSerializer,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        SVGElement: window.SVGElement,
        self: window,
    });
    Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: { href: vizGlobalUrl },
    });
    return runPlantUmlOperation(async () => {
        await import("@plantuml/core/viz-global.js");
        const plantUml = (await import("@plantuml/core/plantuml.js"));
        return plantUml.renderToString;
    });
}
function installDomMeasurementShims(window, measurementFont) {
    window.HTMLCanvasElement.prototype.getContext = function getContext(contextId) {
        if (contextId !== "2d") {
            return null;
        }
        return {
            font: "12px sans-serif",
            measureText(text) {
                const fontSize = parseFontSize(this.font);
                const width = measureTextWidth(text, fontSize, measurementFont);
                return {
                    width,
                    actualBoundingBoxAscent: fontSize * 0.8,
                    actualBoundingBoxDescent: fontSize * 0.2,
                    fontBoundingBoxAscent: fontSize * 0.8,
                    fontBoundingBoxDescent: fontSize * 0.2,
                };
            },
            createImageData(width, height) {
                return {
                    width,
                    height,
                    data: new Uint8ClampedArray(width * height * 4),
                };
            },
            getImageData(width, height) {
                return {
                    width,
                    height,
                    data: new Uint8ClampedArray(width * height * 4),
                };
            },
            clearRect() { },
            drawImage() { },
            fillRect() { },
            fillText() { },
            putImageData() { },
        };
    };
    window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFFAL+Q9QAAAAASUVORK5CYII=";
    window.SVGElement.prototype.getBBox = function getBBox() {
        return createRectForElement(this, measurementFont);
    };
    window.SVGElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
        return createRectForElement(this, measurementFont);
    };
    window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
        const fontSize = fontSizeForElement(this);
        return measureTextWidth(this.textContent ?? "", fontSize, measurementFont);
    };
}
function createRectForElement(element, measurementFont) {
    const fontSize = fontSizeForElement(element);
    const width = measureTextWidth(element.textContent ?? "", fontSize, measurementFont);
    const height = ((measurementFont.ascender - measurementFont.descender) / measurementFont.unitsPerEm) * fontSize;
    return {
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        toJSON: () => ({ x: 0, y: 0, width, height }),
    };
}
function fontSizeForElement(element) {
    const explicitSize = element.getAttribute("font-size");
    const styleSize = element.getAttribute("style")?.match(/font-size:\s*([^;]+)/u)?.[1];
    return parseFontSize(explicitSize ?? styleSize ?? "12px");
}
function parseFontSize(font) {
    return Number.parseFloat(font.match(/(\d+(?:\.\d+)?)px?/u)?.[1] ?? "12");
}
function measureTextWidth(text, fontSize, measurementFont) {
    try {
        return Math.max(1, measurementFont.getAdvanceWidth(text, fontSize, FONT_RENDER_OPTIONS) * 1.03);
    }
    catch {
        return estimateTextWidth(text, fontSize);
    }
}
function estimateTextWidth(text, fontSize) {
    let width = 0;
    for (const char of text) {
        width += fontSize * widthFactor(char);
    }
    return Math.max(1, width);
}
function widthFactor(char) {
    if (char === " " || char === "\t") {
        return 0.33;
    }
    if (/[\u{1f300}-\u{1faff}]/u.test(char)) {
        return 1.15;
    }
    if (/[\u{1100}-\u{11ff}\u{2e80}-\u{a4cf}\u{ac00}-\u{d7af}\u{f900}-\u{faff}]/u.test(char)) {
        return 1;
    }
    if (/[ilI.,:;|'!]/u.test(char)) {
        return 0.28;
    }
    if (/[mwMW@#%&]/u.test(char)) {
        return 0.86;
    }
    if (/[A-Z]/u.test(char)) {
        return 0.66;
    }
    if (/[0-9]/u.test(char)) {
        return 0.56;
    }
    return 0.54;
}
function renderToSvg(source, renderToString) {
    return runPlantUmlOperation(() => renderToSvgUnlocked(source, renderToString));
}
function renderToSvgUnlocked(source, renderToString) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`PlantUML render timed out after ${RENDER_TIMEOUT_MS}ms`)), RENDER_TIMEOUT_MS);
        try {
            renderToString(source.split(/\r\n|\r|\n/), (svg) => {
                clearTimeout(timeout);
                resolve(svg);
            }, (message) => {
                clearTimeout(timeout);
                reject(new Error(message));
            });
        }
        catch (err) {
            clearTimeout(timeout);
            reject(err);
        }
    });
}
async function runPlantUmlOperation(operation) {
    const previous = plantUmlQueue;
    let release = () => { };
    plantUmlQueue = new Promise((resolve) => {
        release = resolve;
    });
    await previous.catch(() => undefined);
    const originalLog = console.log;
    console.log = () => { };
    try {
        return await operation();
    }
    finally {
        console.log = originalLog;
        release();
    }
}
function rasterizeSvgToPng(svg, fontBuffers, targetWidth) {
    const baseOptions = {
        background: "white",
        font: {
            fontBuffers: [...fontBuffers],
            defaultFontFamily: "DejaVu Sans",
            sansSerifFamily: "DejaVu Sans",
            monospaceFamily: "DejaVu Sans Mono",
        },
    };
    let resvg = new Resvg(svg, baseOptions);
    const effectiveTargetWidth = targetWidth ?? (resvg.width > MAX_AUTO_TARGET_WIDTH ? MAX_AUTO_TARGET_WIDTH : undefined);
    if (effectiveTargetWidth !== undefined) {
        resvg.free();
        resvg = new Resvg(svg, {
            ...baseOptions,
            fitTo: { mode: "width", value: effectiveTargetWidth },
        });
    }
    let image;
    try {
        image = resvg.render();
        return Buffer.from(image.asPng());
    }
    finally {
        image?.free();
        resvg.free();
    }
}
async function loadFontAssets() {
    const fontBuffers = await Promise.all([
        readFile(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf")),
        readFile(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf")),
    ]);
    return {
        fontBuffers,
        measurementFont: opentype.parse(toArrayBuffer(fontBuffers[0])),
    };
}
function toArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
//# sourceMappingURL=wasm-engine.js.map