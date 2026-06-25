import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import opentype from "opentype.js";
import type { Font, RenderOptions } from "opentype.js";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { ResvgRenderOptions } from "@resvg/resvg-wasm";
import type { RenderEngine, RenderRequest, RenderResult } from "../core/engine.js";

type RenderToString = (
  lines: string[],
  onSuccess: (svg: string) => void,
  onError: (message: string) => void,
  options?: { dark?: boolean }
) => void;

type PlantUmlModule = {
  readonly renderToString: RenderToString;
};

type BrowserWindowShim = {
  readonly document: unknown;
  readonly DOMParser: unknown;
  readonly XMLSerializer: unknown;
  readonly Node: unknown;
  readonly Element: unknown;
  readonly HTMLElement: unknown;
  readonly SVGElement: { readonly prototype: Record<string, unknown> };
  readonly HTMLCanvasElement: { readonly prototype: Record<string, unknown> };
};

type SvgElementLike = {
  getAttribute(name: string): string | null;
  readonly textContent?: string | null;
};

type RendererEnvironment = {
  readonly renderToString: RenderToString;
  readonly fontBuffers: readonly Uint8Array[];
};

type FontAssets = {
  readonly fontBuffers: readonly Uint8Array[];
  readonly measurementFont: Font;
};

const require = createRequire(import.meta.url);
const RENDER_TIMEOUT_MS = 15_000;
const MAX_AUTO_TARGET_WIDTH = 2_000;
const FONT_RENDER_OPTIONS: RenderOptions = { kerning: true };
let sharedEnvironment: Promise<RendererEnvironment> | undefined;
let plantUmlQueue: Promise<void> = Promise.resolve();

/**
 * Default engine (ADR-001). Renders PlantUML entirely in-process via the
 * official WASM/JS build (plantuml-core / plantuml.js, TeaVM + Viz.js).
 * No Java, external Graphviz, Docker, or web server; source never leaves the
 * machine. It uses a Node DOM shim plus an in-process WASM SVG rasterizer.
 */
export class WasmEngine implements RenderEngine {
  readonly id = "wasm";

  async render(req: RenderRequest): Promise<RenderResult> {
    const env = await getSharedEnvironment();
    const svg = await renderToSvg(req.source, env.renderToString);
    const svgResult = {
      format: "svg" as const,
      bytes: Buffer.from(svg, "utf8"),
      mimeType: "image/svg+xml" as const,
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

async function getSharedEnvironment(): Promise<RendererEnvironment> {
  sharedEnvironment ??= initializeEnvironment().catch((err: unknown) => {
    sharedEnvironment = undefined;
    throw err;
  });
  return sharedEnvironment;
}

async function initializeEnvironment(): Promise<RendererEnvironment> {
  const [wasmBytes, fontAssets] = await Promise.all([
    readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
    loadFontAssets(),
  ]);

  const renderToString = await initializePlantUml(fontAssets.measurementFont);
  await initWasm(wasmBytes);

  return { renderToString, fontBuffers: fontAssets.fontBuffers };
}

async function initializePlantUml(measurementFont: Font): Promise<RenderToString> {
  const vizGlobalUrl = pathToFileURL(require.resolve("@plantuml/core/viz-global.js")).href;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://local.plantuml.invalid/",
    pretendToBeVisual: true,
  });
  const window = dom.window as unknown as BrowserWindowShim;
  installDomMeasurementShims(window, measurementFont);

  Object.assign(globalThis as typeof globalThis & Record<string, unknown>, {
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
    const plantUml = (await import("@plantuml/core/plantuml.js")) as PlantUmlModule;
    return plantUml.renderToString;
  });
}

function installDomMeasurementShims(window: BrowserWindowShim, measurementFont: Font): void {
  window.HTMLCanvasElement.prototype.getContext = function getContext(contextId: string) {
    if (contextId !== "2d") {
      return null;
    }

    return {
      font: "12px sans-serif",
      measureText(text: string) {
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
      createImageData(width: number, height: number) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      getImageData(width: number, height: number) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      clearRect() {},
      drawImage() {},
      fillRect() {},
      fillText() {},
      putImageData() {},
    };
  };

  window.HTMLCanvasElement.prototype.toDataURL = () =>
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFFAL+Q9QAAAAASUVORK5CYII=";

  window.SVGElement.prototype.getBBox = function getBBox(this: SvgElementLike) {
    return createRectForElement(this, measurementFont);
  };
  window.SVGElement.prototype.getBoundingClientRect = function getBoundingClientRect(
    this: SvgElementLike
  ) {
    return createRectForElement(this, measurementFont);
  };
  window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength(
    this: SvgElementLike
  ) {
    const fontSize = fontSizeForElement(this);
    return measureTextWidth(this.textContent ?? "", fontSize, measurementFont);
  };
}

function createRectForElement(element: SvgElementLike, measurementFont: Font): {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  toJSON(): Record<string, number>;
} {
  const fontSize = fontSizeForElement(element);
  const width = measureTextWidth(element.textContent ?? "", fontSize, measurementFont);
  const height =
    ((measurementFont.ascender - measurementFont.descender) / measurementFont.unitsPerEm) * fontSize;

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

function fontSizeForElement(element: SvgElementLike): number {
  const explicitSize = element.getAttribute("font-size");
  const styleSize = element.getAttribute("style")?.match(/font-size:\s*([^;]+)/u)?.[1];
  return parseFontSize(explicitSize ?? styleSize ?? "12px");
}

function parseFontSize(font: string): number {
  return Number.parseFloat(font.match(/(\d+(?:\.\d+)?)px?/u)?.[1] ?? "12");
}

function measureTextWidth(text: string, fontSize: number, measurementFont: Font): number {
  try {
    return Math.max(1, measurementFont.getAdvanceWidth(text, fontSize, FONT_RENDER_OPTIONS) * 1.03);
  } catch {
    return estimateTextWidth(text, fontSize);
  }
}

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    width += fontSize * widthFactor(char);
  }
  return Math.max(1, width);
}

function widthFactor(char: string): number {
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

function renderToSvg(source: string, renderToString: RenderToString): Promise<string> {
  return runPlantUmlOperation(() => renderToSvgUnlocked(source, renderToString));
}

function renderToSvgUnlocked(source: string, renderToString: RenderToString): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`PlantUML render timed out after ${RENDER_TIMEOUT_MS}ms`)),
      RENDER_TIMEOUT_MS
    );

    try {
      renderToString(
        source.split(/\r\n|\r|\n/),
        (svg) => {
          clearTimeout(timeout);
          resolve(svg);
        },
        (message) => {
          clearTimeout(timeout);
          reject(new Error(message));
        }
      );
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

async function runPlantUmlOperation<T>(operation: () => Promise<T>): Promise<T> {
  const previous = plantUmlQueue;
  let release: () => void = () => {};
  plantUmlQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  const originalLog = console.log;
  console.log = () => {};
  try {
    return await operation();
  } finally {
    console.log = originalLog;
    release();
  }
}

function rasterizeSvgToPng(
  svg: string,
  fontBuffers: readonly Uint8Array[],
  targetWidth?: number
): Uint8Array {
  const baseOptions: ResvgRenderOptions = {
    background: "white",
    font: {
      fontBuffers: [...fontBuffers],
      defaultFontFamily: "DejaVu Sans",
      sansSerifFamily: "DejaVu Sans",
      monospaceFamily: "DejaVu Sans Mono",
    },
  };
  let resvg = new Resvg(svg, baseOptions);
  const effectiveTargetWidth =
    targetWidth ?? (resvg.width > MAX_AUTO_TARGET_WIDTH ? MAX_AUTO_TARGET_WIDTH : undefined);

  if (effectiveTargetWidth !== undefined) {
    resvg.free();
    resvg = new Resvg(svg, {
      ...baseOptions,
      fitTo: { mode: "width", value: effectiveTargetWidth },
    });
  }

  let image: ReturnType<InstanceType<typeof Resvg>["render"]> | undefined;

  try {
    image = resvg.render();
    return Buffer.from(image.asPng());
  } finally {
    image?.free();
    resvg.free();
  }
}

async function loadFontAssets(): Promise<FontAssets> {
  const fontBuffers = await Promise.all([
    readFile(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf")),
    readFile(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf")),
  ]);

  return {
    fontBuffers,
    measurementFont: opentype.parse(toArrayBuffer(fontBuffers[0])),
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
