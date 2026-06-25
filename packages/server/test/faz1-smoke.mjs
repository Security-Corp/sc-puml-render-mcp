import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WasmEngine } from "../dist/engines/wasm-engine.js";
import { renderDiagram } from "../dist/tools/render-diagram.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const LEGACY_FORCED_TARGET_WIDTH = 1_200;
const MAX_AUTO_TARGET_WIDTH = 2_000;

const fixtures = [
  {
    name: "text-heavy-sequence",
    minWidth: 500,
    minHeight: 220,
    labels: [
      "AuthorizationApprovedButSettlementPendingAndReconciliationRequired",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "Unicode",
    ],
    source: `@startuml
title Text width probe
participant "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii" as Narrow
participant "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" as Wide
participant "Unicode: Istanbul Tokyo locked" as Unicode
Narrow -> Wide: iiiiiiiiiiiiiiiiiii vs WWWWWWWWWWWWWWW
Wide --> Unicode: mixed ASCII / CJK-width / emoji-width probe
note over Narrow, Unicode
WWWWWWWWWWWWWWWWWWWWWWWW
iiiiiiiiiiiiiiiiiiiiiiii
AuthorizationApprovedButSettlementPendingAndReconciliationRequired
end note
@enduml`,
  },
  {
    name: "graphviz-component",
    minWidth: 450,
    minHeight: 260,
    labels: [
      "AuthorizationGatewayWWWWWWWWWWWW",
      "SettlementCallbackWWWWWW",
      "postLedgerEntryWhenDecisionIsApproved",
    ],
    source: `@startuml
skinparam componentStyle rectangle
package "Online Banking Context WWWWWWWWWWWWW" {
  [AuthorizationGatewayWWWWWWWWWWWW] as Auth
  [LedgerPostingServiceiiiiiiiiiiiiiiii] as Ledger
  [FraudDecisioningComponentWithVeryLongName] as Fraud
  interface "ISettlementCallbackWWWWWW" as Callback
}
Auth --> Fraud : authorizePaymentWith3DSecureAndRiskSignals(...)
Fraud --> Ledger : postLedgerEntryWhenDecisionIsApproved(...)
Ledger ..> Callback : settlementCompletedOrRejected(event)
@enduml`,
  },
  {
    name: "graphviz-state",
    minWidth: 430,
    minHeight: 150,
    labels: [
      "Payment Lifecycle WWWWWWWWWWWWW",
      "Risk Review WWWWWWWWWWWWW",
      "reverseHold",
    ],
    source: `@startuml
state "Payment Lifecycle WWWWWWWWWWWWW" as Payment {
  state "Authorization Requested iiiiiiiiiiiiiii" as Requested
  state "Risk Review WWWWWWWWWWWWW" as Risk
  state "Settlement Pending mmmmmmmmmmmmm" as Settlement
  state "Rejected By Acquirer WWWWWWW" as Rejected
  [*] --> Requested
  Requested --> Risk : riskScore >= threshold / holdForManualReview()
  Risk --> Settlement : approvedByAnalyst / releaseAuthorization()
  Settlement --> Rejected : responseCode != 00 / reverseHold()
}
@enduml`,
  },
];

const engine = new WasmEngine();
const defaultToolDeps = {
  engine,
  defaultFormat: "png",
  filesystemBaseDir: process.cwd(),
  includeResolverOptions: {
    maxDepth: 10,
    maxTotalBytes: 1_000_000,
    remoteAllowlist: [],
  },
};

const smallNativeSource = `@startuml
Alice -> Bob: ok
Bob --> Alice: done
@enduml`;

const wideCapSource = `@startuml
title Wide auto-cap probe
${Array.from(
  { length: 8 },
  (_, index) =>
    `participant "Wide ${String(index + 1).padStart(2, "0")} WWWWWWWWWWWW" as P${index + 1}`
).join("\n")}
P1 -> P8: force enough natural width to exceed the inline raster cap
@enduml`;

for (const fixture of fixtures) {
  const startedAt = performance.now();
  const result = await renderDiagram({ source: fixture.source }, defaultToolDeps);
  const elapsedMs = performance.now() - startedAt;
  const image = result.content.find((block) => block.type === "image");
  const resource = result.content.find((block) => block.type === "resource");

  assert.ok(image, `${fixture.name}: expected inline image content block`);
  assert.equal(image.mimeType, "image/png", `${fixture.name}: expected image/png`);
  const png = Buffer.from(image.data, "base64");
  assertValidPng(png, fixture.name);
  const size = pngSize(png);
  assert.ok(size.width >= fixture.minWidth, `${fixture.name}: PNG width ${size.width}`);
  assert.ok(size.height >= fixture.minHeight, `${fixture.name}: PNG height ${size.height}`);

  assert.ok(resource, `${fixture.name}: expected SVG resource content block`);
  assert.equal(resource.resource.mimeType, "image/svg+xml");
  assert.ok("text" in resource.resource, `${fixture.name}: expected text SVG resource`);
  const svg = resource.resource.text;
  assert.ok(svg.includes("<svg"), `${fixture.name}: expected SVG markup`);
  for (const label of fixture.labels) {
    assert.ok(svg.includes(label), `${fixture.name}: SVG missing label ${label}`);
  }
  await assertMarkdownPngMetadata(result, fixture.name);

  console.log(
    `${fixture.name}: ${size.width}x${size.height}, ${png.length} PNG bytes, ${svg.length} SVG chars, ${elapsedMs.toFixed(1)}ms`
  );
}

await assertDefaultWidthPolicy();

const svgOnly = await renderDiagram(
  { source: fixtures[0].source, format: "svg" },
  defaultToolDeps
);
assert.equal(svgOnly.content.length, 1);
assert.equal(svgOnly.content[0].type, "resource");
assert.equal(svgOnly.content[0].resource.mimeType, "image/svg+xml");
assert.equal(svgOnly.structuredContent.ok, true);
assert.equal(svgOnly.structuredContent.format, "svg");
assert.equal(svgOnly.structuredContent.mimeType, "image/svg+xml");
assert.equal(svgOnly.structuredContent.filePath, undefined);
assert.equal(svgOnly.structuredContent.markdownImage, undefined);
assert.equal(svgOnly.structuredContent.image, undefined);

await assertMcpStdioClient();

console.log("faz1-smoke: inline PNG and SVG resource checks passed");

function assertValidPng(buffer, fixtureName) {
  assert.ok(buffer.length > PNG_MAGIC.length, `${fixtureName}: empty PNG`);
  assert.ok(buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC), `${fixtureName}: bad PNG magic`);
}

function pngSize(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function imagePngSize(result, fixtureName) {
  const image = result.content.find((block) => block.type === "image");
  assert.ok(image, `${fixtureName}: expected image block`);
  assert.equal(image.mimeType, "image/png", `${fixtureName}: expected image/png`);
  const png = Buffer.from(image.data, "base64");
  assertValidPng(png, fixtureName);
  return pngSize(png);
}

async function assertDefaultWidthPolicy() {
  const defaultSmall = await renderDiagram({ source: smallNativeSource }, defaultToolDeps);
  const defaultSmallSize = imagePngSize(defaultSmall, "small default");
  assert.ok(
    defaultSmallSize.width < LEGACY_FORCED_TARGET_WIDTH,
    `small default should stay native, got ${defaultSmallSize.width}px`
  );
  await assertMarkdownPngMetadata(defaultSmall, "small default");

  const noFileSmall = await renderDiagram(
    { source: smallNativeSource, writeFile: false },
    defaultToolDeps
  );
  const noFileSmallSize = imagePngSize(noFileSmall, "small writeFile false");
  assert.deepEqual(
    noFileSmallSize,
    defaultSmallSize,
    "writeFile should not change raster dimensions when targetWidth is omitted"
  );
  assert.equal(noFileSmall.structuredContent.filePath, undefined);
  assert.equal(noFileSmall.structuredContent.markdownImage, undefined);

  const explicit = await renderDiagram(
    { source: smallNativeSource, targetWidth: 640 },
    defaultToolDeps
  );
  const explicitSize = imagePngSize(explicit, "explicit targetWidth");
  assert.equal(explicitSize.width, 640, "explicit targetWidth should win");
  await assertMarkdownPngMetadata(explicit, "explicit targetWidth");

  const capped = await renderDiagram({ source: wideCapSource }, defaultToolDeps);
  const cappedSize = imagePngSize(capped, "wide auto-cap");
  assert.equal(cappedSize.width, MAX_AUTO_TARGET_WIDTH, "wide default render should auto-cap");
  await assertMarkdownPngMetadata(capped, "wide auto-cap");

  console.log(
    `width-policy: native ${defaultSmallSize.width}px, explicit ${explicitSize.width}px, capped ${cappedSize.width}px`
  );
}

async function assertMarkdownPngMetadata(result, fixtureName) {
  const structured = result.structuredContent;
  assert.ok(structured, `${fixtureName}: expected structured metadata`);
  assert.equal(structured.ok, true, `${fixtureName}: expected ok metadata`);
  assert.equal(structured.format, "png", `${fixtureName}: expected png metadata`);
  assert.equal(structured.mimeType, "image/png", `${fixtureName}: expected image/png metadata`);
  assert.equal(typeof structured.filePath, "string", `${fixtureName}: expected PNG file path`);
  assert.ok(path.isAbsolute(structured.filePath), `${fixtureName}: expected absolute PNG path`);
  assert.equal(
    structured.markdownImage,
    `![PlantUML diagram](${structured.filePath})`,
    `${fixtureName}: expected Markdown image string`
  );
  assert.equal(structured.image.filePath, structured.filePath, `${fixtureName}: nested file path`);
  assert.equal(
    structured.image.markdownImage,
    structured.markdownImage,
    `${fixtureName}: nested Markdown image string`
  );

  await access(structured.filePath);
  const fileBytes = await readFile(structured.filePath);
  assertValidPng(fileBytes, `${fixtureName} metadata file`);
  const fileSize = pngSize(fileBytes);
  assert.equal(structured.width, fileSize.width, `${fixtureName}: metadata width`);
  assert.equal(structured.height, fileSize.height, `${fixtureName}: metadata height`);
  assert.equal(structured.image.width, fileSize.width, `${fixtureName}: nested metadata width`);
  assert.equal(structured.image.height, fileSize.height, `${fixtureName}: nested metadata height`);

  const image = result.content.find((block) => block.type === "image");
  assert.ok(image, `${fixtureName}: expected image block for metadata comparison`);
  assert.deepEqual(Buffer.from(image.data, "base64"), fileBytes, `${fixtureName}: file matches image block`);
}

async function assertMcpStdioClient() {
  const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const serverRoot = fileURLToPath(new URL("..", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: serverRoot,
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const client = new Client({ name: "faz1-smoke", version: "0.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(
      tools.tools.some((tool) => tool.name === "render_diagram"),
      "MCP stdio server should list render_diagram"
    );

    const result = await client.callTool({
      name: "render_diagram",
      arguments: { source: fixtures[1].source },
    });
    const image = result.content.find((block) => block.type === "image");
    const resource = result.content.find((block) => block.type === "resource");
    assert.ok(image, "MCP client call should return inline image");
    assert.equal(image.mimeType, "image/png");
    assertValidPng(Buffer.from(image.data, "base64"), "mcp-stdio-client");
    assert.ok(resource, "MCP client call should return SVG resource");
    assert.equal(resource.resource.mimeType, "image/svg+xml");
    await assertMarkdownPngMetadata(result, "mcp-stdio-client");
  } finally {
    await client.close();
  }

  assert.equal(stderr.trim(), "", "MCP server stderr should stay quiet during smoke render");
  console.log("mcp-stdio-client: render_diagram returned inline PNG and SVG resource");
}
