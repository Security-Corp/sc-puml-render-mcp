/**
 * FAZ 0 SPIKE — the single highest-risk question in the whole project:
 *
 *   Can the official PlantUML WASM/JS build render headless in Node.js?
 *
 * If YES  → the "zero-dependency default engine" thesis holds; build WasmEngine on it.
 * If NO   → fall back to the jar engine and revise ADR-001 + the install story.
 *
 * Goal of this spike (keep it throwaway): take a hard-coded .puml string, render
 * it, and write a real PNG to ./out/spike.png. Success = a valid, openable PNG.
 *
 * Candidate packages to evaluate (verify exact API / npm names when implementing,
 * the ecosystem moves fast):
 *   - plantuml-core / plantuml.js  (TeaVM + Viz.js, browser-targeted — the crux:
 *     does it run without `window`/`document`, or need a shim like jsdom?)
 *   - @plantuml-mcp/plantuml, node-plantuml (these pull in Java — only the
 *     fallback path, NOT what this spike is trying to prove)
 *
 * What to find out and write down (paste findings into docs/adr/ADR-001 as an
 * update, or open ADR-005 if the conclusion changes the architecture):
 *   1. Does it run in Node at all? Any browser globals needed?
 *   2. Cold-start time for one render. Does it need a warmed/reused instance?
 *   3. Does it cover Graphviz-dependent diagram types (class/component/state)?
 *   4. PNG and SVG output both available?
 *   5. Bundle size / how it ships (affects MCPB packaging in Faz 4).
 *
 * Run:  pnpm -F wasm-node-render dev
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { JSDOM } from "jsdom";
import { Resvg } from "@resvg/resvg-js";

type RenderToString = (
  lines: string[],
  onSuccess: (svg: string) => void,
  onError: (message: string) => void,
  options?: { dark?: boolean }
) => void;

type PlantUmlModule = {
  renderToString: RenderToString;
};

type RenderOutput = {
  name: string;
  svgBytes: number;
  pngBytes: number;
  svgRenderMs: number;
  pngRenderMs: number;
  pngWidth: number;
  pngHeight: number;
};

const require = createRequire(import.meta.url);
const outputDir = new URL("./out/", import.meta.url);

const SEQUENCE_SAMPLE = `@startuml
Alice -> Bob: hello
Bob --> Alice: hi
@enduml`;

const CLASS_SAMPLE = `@startuml
skinparam classAttributeIconSize 0

class Account {
  +deposit(amount: Money)
  +withdraw(amount: Money)
}

class Ledger {
  +post(entry: Entry)
}

Account --> Ledger : posts
@enduml`;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function main(): Promise<void> {
  console.log("Faz 0 spike: attempting headless PlantUML render in Node.\n");

  const startMs = performance.now();
  const { renderToString } = await initializePlantUml();
  const initMs = performance.now() - startMs;

  const graphvizOutput = await renderSample("spike", CLASS_SAMPLE, renderToString);
  const sequenceOutput = await renderSample("sequence", SEQUENCE_SAMPLE, renderToString);
  const packageInfo = await inspectPackageSizes();

  const totalMs = performance.now() - startMs;

  console.log("\nWASM-in-Node: PROVEN");
  console.log(`Cold start total: ${totalMs.toFixed(1)} ms`);
  console.log(`Import/shim setup: ${initMs.toFixed(1)} ms`);
  console.log(`Graphviz-dependent sample: class diagram -> out/spike.png`);
  console.log(formatRenderOutput(graphvizOutput));
  console.log(formatRenderOutput(sequenceOutput));
  console.log(`SVG output: out/spike.svg and out/sequence.svg`);
  console.log(
    `Package sizes: @plantuml/core ${formatBytes(packageInfo.plantumlCoreBytes)} unpacked, ` +
      `plantuml.js ${formatBytes(packageInfo.plantumlJsBytes)}, ` +
      `viz-global.js ${formatBytes(packageInfo.vizGlobalBytes)}, ` +
      `@resvg/resvg-js runtime ${formatBytes(packageInfo.resvgRuntimeBytes)} unpacked`
  );
  console.log(
    "Browser globals shimmed: window, document, self, location. Worker was not required."
  );
}

async function initializePlantUml(): Promise<PlantUmlModule> {
  const vizGlobalUrl = pathToFileURL(require.resolve("@plantuml/core/viz-global.js")).href;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://local.plantuml.invalid/",
    pretendToBeVisual: true,
  });
  installDomMeasurementShims(dom.window);

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    DOMParser: dom.window.DOMParser,
    XMLSerializer: dom.window.XMLSerializer,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    SVGElement: dom.window.SVGElement,
    self: dom.window,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { href: vizGlobalUrl },
  });

  await import("@plantuml/core/viz-global.js");
  const plantUml = (await import("@plantuml/core/plantuml.js")) as PlantUmlModule;

  return plantUml;
}

function installDomMeasurementShims(window: Window): void {
  window.HTMLCanvasElement.prototype.getContext = function getContext(contextId: string) {
    if (contextId !== "2d") {
      return null;
    }

    return {
      font: "12px sans-serif",
      measureText(text: string) {
        const fontSize = parseFontSize(this.font);
        const width = estimateTextWidth(text, fontSize);

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
  } as typeof window.HTMLCanvasElement.prototype.getContext;

  window.HTMLCanvasElement.prototype.toDataURL = () =>
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFFAL+Q9QAAAAASUVORK5CYII=";

  window.SVGElement.prototype.getBBox = function getBBox() {
    const fontSize = parseFontSize(this.getAttribute("font-size") ?? "12px");
    const text = this.textContent ?? "";

    return createRect(estimateTextWidth(text, fontSize), fontSize * 1.2);
  };
  window.SVGElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const fontSize = parseFontSize(this.getAttribute("font-size") ?? "12px");
    const text = this.textContent ?? "";

    return createRect(estimateTextWidth(text, fontSize), fontSize * 1.2);
  };
  window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
    const fontSize = parseFontSize(this.getAttribute("font-size") ?? "12px");
    return estimateTextWidth(this.textContent ?? "", fontSize);
  };
}

function createRect(width: number, height: number): DOMRect {
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

function parseFontSize(font: string): number {
  return Number.parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "12");
}

function estimateTextWidth(text: string, fontSize: number): number {
  return Math.max(1, text.length * fontSize * 0.62);
}

async function renderSample(
  name: string,
  source: string,
  renderToString: RenderToString
): Promise<RenderOutput> {
  console.log(`Rendering ${name} sample...`);
  const svgStartMs = performance.now();
  const svg = await renderToSvg(source, renderToString);
  const svgRenderMs = performance.now() - svgStartMs;

  const pngStartMs = performance.now();
  const resvg = new Resvg(svg, { background: "white" });
  const pngData = resvg.render();
  const png = pngData.asPng();
  const pngRenderMs = performance.now() - pngStartMs;

  assertPng(png);

  await mkdir(outputDir, { recursive: true });
  await writeFile(new URL(`${name}.svg`, outputDir), svg);
  await writeFile(new URL(`${name}.png`, outputDir), png);

  return {
    name,
    svgBytes: Buffer.byteLength(svg),
    pngBytes: png.length,
    svgRenderMs,
    pngRenderMs,
    pngWidth: pngData.width,
    pngHeight: pngData.height,
  };
}

function renderToSvg(source: string, renderToString: RenderToString): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PlantUML render timed out after 15 seconds")),
      15_000
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

function assertPng(png: Buffer): void {
  if (png.length <= PNG_MAGIC.length || !png.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new Error("Rendered output is not a valid PNG file.");
  }
}

async function inspectPackageSizes(): Promise<{
  plantumlCoreBytes: number;
  plantumlJsBytes: number;
  vizGlobalBytes: number;
  resvgRuntimeBytes: number;
}> {
  const plantumlPackagePath = require.resolve("@plantuml/core/package.json");
  const resvgPackagePath = require.resolve("@resvg/resvg-js/package.json");
  const plantumlPackageDir = dirname(plantumlPackagePath);
  const resvgPackageDir = dirname(resvgPackagePath);
  const resvgPackageJson = require(resvgPackagePath) as {
    optionalDependencies?: Record<string, string>;
  };

  const [plantumlCoreBytes, plantumlJs, vizGlobal, resvgPackageBytes, resvgNativeBytes] =
    await Promise.all([
    directorySize(plantumlPackageDir),
    stat(require.resolve("@plantuml/core/plantuml.js")),
    stat(require.resolve("@plantuml/core/viz-global.js")),
    directorySize(resvgPackageDir),
    installedOptionalDependencySize(resvgPackageJson.optionalDependencies ?? {}),
  ]);

  return {
    plantumlCoreBytes,
    plantumlJsBytes: plantumlJs.size,
    vizGlobalBytes: vizGlobal.size,
    resvgRuntimeBytes: resvgPackageBytes + resvgNativeBytes,
  };
}

async function installedOptionalDependencySize(
  optionalDependencies: Record<string, string>
): Promise<number> {
  const sizes = await Promise.all(
    Object.keys(optionalDependencies).map(async (packageName) => {
      try {
        return directorySize(dirname(require.resolve(`${packageName}/package.json`)));
      } catch {
        return 0;
      }
    })
  );

  return sizes.reduce((sum, size) => sum + size, 0);
}

async function directorySize(path: string): Promise<number> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(path, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = `${path}/${entry.name}`;
      if (entry.isDirectory()) {
        return directorySize(entryPath);
      }
      if (entry.isFile()) {
        return (await stat(entryPath)).size;
      }
      return 0;
    })
  );

  return sizes.reduce((sum, size) => sum + size, 0);
}

function formatRenderOutput(output: RenderOutput): string {
  return (
    `${output.name}: svg ${formatBytes(output.svgBytes)} in ${output.svgRenderMs.toFixed(1)} ms, ` +
    `png ${formatBytes(output.pngBytes)} (${output.pngWidth}x${output.pngHeight}) ` +
    `in ${output.pngRenderMs.toFixed(1)} ms`
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

main().catch((err) => {
  console.error("\nSPIKE FAILED:", err.message);
  process.exit(1);
});
