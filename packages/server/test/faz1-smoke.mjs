import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WasmEngine } from "../dist/engines/wasm-engine.js";
import { renderDiagram } from "../dist/tools/render-diagram.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

for (const fixture of fixtures) {
  const startedAt = performance.now();
  const result = await renderDiagram(
    { source: fixture.source },
    { engine, defaultFormat: "png" }
  );
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

  console.log(
    `${fixture.name}: ${size.width}x${size.height}, ${png.length} PNG bytes, ${svg.length} SVG chars, ${elapsedMs.toFixed(1)}ms`
  );
}

const svgOnly = await renderDiagram(
  { source: fixtures[0].source, format: "svg" },
  { engine, defaultFormat: "png" }
);
assert.equal(svgOnly.content.length, 1);
assert.equal(svgOnly.content[0].type, "resource");
assert.equal(svgOnly.content[0].resource.mimeType, "image/svg+xml");

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
  } finally {
    await client.close();
  }

  assert.equal(stderr.trim(), "", "MCP server stderr should stay quiet during smoke render");
  console.log("mcp-stdio-client: render_diagram returned inline PNG and SVG resource");
}
