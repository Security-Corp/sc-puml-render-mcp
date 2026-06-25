import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { IncludeResolutionError, resolveIncludes } from "../dist/core/include-resolver.js";
import { FilesystemSource, FilesystemSourceError } from "../dist/sources/filesystem-source.js";
import { TextSource } from "../dist/sources/text-source.js";
import { WasmEngine } from "../dist/engines/wasm-engine.js";
import { renderDiagram } from "../dist/tools/render-diagram.js";
import { resolveIncludesTool } from "../dist/tools/resolve-includes.js";
import { validatePlantUml } from "../dist/tools/validate.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const tmpRoot = await mkdtemp(path.join(tmpdir(), "sc-puml-faz2-"));

try {
  const baseDir = path.join(tmpRoot, "base");
  const outsideDir = path.join(tmpRoot, "outside");
  await mkdir(baseDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeHappyPathFixture(baseDir);

  const includeOptions = {
    maxDepth: 10,
    maxTotalBytes: 100_000,
    remoteAllowlist: [],
  };
  const deps = {
    filesystemBaseDir: baseDir,
    includeResolverOptions: includeOptions,
  };
  const engine = new WasmEngine();

  const flattened = await resolveIncludes(
    new FilesystemSource({ baseDir, entryPath: "diagrams/main.puml" }),
    includeOptions
  );
  assertFlattenedHappyPath(flattened);

  const resolvedTool = await resolveIncludesTool({ filePath: "diagrams/main.puml" }, deps);
  assert.equal(resolvedTool.content[0].type, "text");
  assertFlattenedHappyPath(resolvedTool.content[0].text);

  const rendered = await renderDiagram(
    { filePath: "diagrams/main.puml" },
    { engine, defaultFormat: "png", ...deps }
  );
  const image = rendered.content.find((block) => block.type === "image");
  const resource = rendered.content.find((block) => block.type === "resource");
  assert.ok(image, "filePath render should return an inline image");
  assert.equal(image.mimeType, "image/png");
  assertValidPng(Buffer.from(image.data, "base64"), "filePath render");
  assert.ok(resource, "filePath render should return an SVG resource");
  assert.ok(resource.resource.text.includes("Payment Initiation API"));
  await assertMarkdownPngMetadata(rendered, "filePath render");

  const valid = await validatePlantUml(
    { filePath: "diagrams/main.puml" },
    { engine, ...deps }
  );
  assert.equal(valid.structuredContent.ok, true, "valid fixture should validate");

  const invalid = await validatePlantUml(
    { source: "@startuml\n!thisisnotvalid\n@enduml" },
    { engine, ...deps }
  );
  assert.equal(invalid.structuredContent.ok, false, "bad syntax should not validate");
  assert.equal(typeof invalid.structuredContent.message, "string");

  await assertTraversalRejected(baseDir, outsideDir, includeOptions);
  await assertSymlinkEscapeRejected(baseDir, outsideDir, includeOptions);
  await assertRemoteIncludes(baseDir);
  await assertCycleRejected(baseDir, includeOptions);
  await assertDepthLimit(baseDir);
  await assertSizeLimit(baseDir);
  await assertMcpStdio(baseDir);

  console.log("faz2-includes: include resolution, security limits, validate, and MCP tools passed");
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}

async function writeHappyPathFixture(baseDir) {
  await mkdir(path.join(baseDir, "diagrams", "shared"), { recursive: true });
  await mkdir(path.join(baseDir, "diagrams", "views"), { recursive: true });
  await writeFile(
    path.join(baseDir, "diagrams", "main.puml"),
    `@startuml
!include shared/theme.puml
!include views/context.puml
!include views/containers.puml
@enduml
`
  );
  await writeFile(
    path.join(baseDir, "diagrams", "shared", "theme.puml"),
    `skinparam componentStyle rectangle
skinparam shadowing false
`
  );
  await writeFile(
    path.join(baseDir, "diagrams", "shared", "c4-lite.puml"),
    `!procedure $system($alias, $label)
rectangle "$label" as $alias
!endprocedure
`
  );
  await writeFile(
    path.join(baseDir, "diagrams", "views", "context.puml"),
    `!include ../shared/c4-lite.puml
actor "Internet Banking Customer" as Customer
$system(Api, "Payment Initiation API")
Customer --> Api : starts payment
`
  );
  await writeFile(
    path.join(baseDir, "diagrams", "views", "containers.puml"),
    `rectangle "Fraud Decision Service" as Fraud
rectangle "Audit Trail Writer" as Audit
database "Settlement Core" as Settlement
Api --> Fraud
Api --> Audit
Api --> Settlement
`
  );
}

function assertFlattenedHappyPath(flattened) {
  assert.ok(flattened.includes("Internet Banking Customer"));
  assert.ok(flattened.includes("Payment Initiation API"));
  assert.ok(flattened.includes("Fraud Decision Service"));
  assert.ok(flattened.includes("Audit Trail Writer"));
  assert.ok(flattened.includes("Settlement Core"));
  assert.ok(!flattened.includes("!include"), "flattened output should not contain local includes");
}

async function assertTraversalRejected(baseDir, outsideDir, includeOptions) {
  await writeFile(path.join(outsideDir, "secret.puml"), "rectangle LeakedSecret\n");
  await mkdir(path.join(baseDir, "traversal"), { recursive: true });
  await writeFile(
    path.join(baseDir, "traversal", "main.puml"),
    "@startuml\n!include ../../outside/secret.puml\n@enduml\n"
  );

  await assertRejectCode(
    () =>
      resolveIncludes(
        new FilesystemSource({ baseDir, entryPath: "traversal/main.puml" }),
        includeOptions
      ),
    FilesystemSourceError,
    "PATH_OUTSIDE_BASE"
  );
}

async function assertSymlinkEscapeRejected(baseDir, outsideDir, includeOptions) {
  await writeFile(path.join(outsideDir, "symlink-secret.puml"), "rectangle SymlinkSecret\n");
  await mkdir(path.join(baseDir, "symlink"), { recursive: true });
  await symlink(path.join(outsideDir, "symlink-secret.puml"), path.join(baseDir, "symlink", "escape.puml"));
  await writeFile(
    path.join(baseDir, "symlink", "main.puml"),
    "@startuml\n!include escape.puml\n@enduml\n"
  );

  await assertRejectCode(
    () =>
      resolveIncludes(new FilesystemSource({ baseDir, entryPath: "symlink/main.puml" }), includeOptions),
    FilesystemSourceError,
    "PATH_OUTSIDE_BASE"
  );
}

async function assertRemoteIncludes(baseDir) {
  let requestCount = 0;
  const server = createServer((req, res) => {
    requestCount += 1;
    if (req.url === "/huge.puml") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("rectangle " + "x".repeat(1024));
      return;
    }
    if (req.url === "/redirect.puml") {
      res.writeHead(302, { location: "/remote.puml" });
      res.end();
      return;
    }

    res.writeHead(200, { "content-type": "text/plain" });
    res.end('rectangle "Allowlisted Remote Include" as Remote\n');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/remote.puml`;
  const source = new TextSource(`@startuml\n!includeurl ${url}\n@enduml`);

  try {
    await assertRejectCode(
      () => resolveIncludes(source, { maxDepth: 5, maxTotalBytes: 20_000, remoteAllowlist: [] }),
      IncludeResolutionError,
      "REMOTE_INCLUDE_DISABLED"
    );
    assert.equal(requestCount, 0, "remote deny should happen before fetch");

    const allowed = await resolveIncludes(source, {
      maxDepth: 5,
      maxTotalBytes: 20_000,
      remoteAllowlist: [`127.0.0.1:${address.port}`],
    });
    assert.ok(allowed.includes("Allowlisted Remote Include"));
    assert.equal(requestCount, 1);

    requestCount = 0;
    const duplicateAllowed = await resolveIncludes(
      new TextSource(`@startuml\n!includeurl ${url}\n!includeurl ${url}\n@enduml`),
      {
        maxDepth: 5,
        maxTotalBytes: 20_000,
        remoteAllowlist: [`127.0.0.1:${address.port}`],
      }
    );
    assert.ok(duplicateAllowed.includes("Allowlisted Remote Include"));
    assert.equal(requestCount, 1, "duplicate remote !include should be fetched once");

    await assertRejectCode(
      () =>
        resolveIncludes(new TextSource(`@startuml\n!includeurl ${url.replace("remote", "huge")}\n@enduml`), {
          maxDepth: 5,
          maxTotalBytes: 100,
          remoteAllowlist: [`127.0.0.1:${address.port}`],
        }),
      IncludeResolutionError,
      "MAX_TOTAL_SIZE_EXCEEDED"
    );
    const requestCountBeforeRedirect = requestCount;
    await assertRejectCode(
      () =>
        resolveIncludes(
          new TextSource(`@startuml\n!includeurl ${url.replace("remote", "redirect")}\n@enduml`),
          {
            maxDepth: 5,
            maxTotalBytes: 20_000,
            remoteAllowlist: [`127.0.0.1:${address.port}`],
          }
        ),
      IncludeResolutionError,
      "REMOTE_REDIRECT_NOT_ALLOWED"
    );
    assert.equal(requestCount, requestCountBeforeRedirect + 1, "remote redirects should not be followed");
    const requestCountBeforeWrongHost = requestCount;

    await assertRejectCode(
      () =>
        resolveIncludes(source, {
          maxDepth: 5,
          maxTotalBytes: 20_000,
          remoteAllowlist: ["example.com"],
        }),
      IncludeResolutionError,
      "REMOTE_HOST_NOT_ALLOWED"
    );
    assert.equal(requestCount, requestCountBeforeWrongHost, "non-allowlisted host should not be fetched");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

}

async function assertCycleRejected(baseDir, includeOptions) {
  await mkdir(path.join(baseDir, "cycle"), { recursive: true });
  await writeFile(path.join(baseDir, "cycle", "a.puml"), "@startuml\n!include b.puml\n@enduml\n");
  await writeFile(path.join(baseDir, "cycle", "b.puml"), "!include a.puml\n");
  await assertRejectCode(
    () => resolveIncludes(new FilesystemSource({ baseDir, entryPath: "cycle/a.puml" }), includeOptions),
    IncludeResolutionError,
    "INCLUDE_CYCLE"
  );
}

async function assertDepthLimit(baseDir) {
  await mkdir(path.join(baseDir, "depth"), { recursive: true });
  await writeFile(path.join(baseDir, "depth", "d0.puml"), "@startuml\n!include d1.puml\n@enduml\n");
  await writeFile(path.join(baseDir, "depth", "d1.puml"), "!include d2.puml\n");
  await writeFile(path.join(baseDir, "depth", "d2.puml"), "rectangle TooDeep\n");
  await assertRejectCode(
    () =>
      resolveIncludes(new FilesystemSource({ baseDir, entryPath: "depth/d0.puml" }), {
        maxDepth: 1,
        maxTotalBytes: 20_000,
        remoteAllowlist: [],
      }),
    IncludeResolutionError,
    "MAX_DEPTH_EXCEEDED"
  );
}

async function assertSizeLimit(baseDir) {
  await mkdir(path.join(baseDir, "size"), { recursive: true });
  await writeFile(path.join(baseDir, "size", "main.puml"), "@startuml\n!include big.puml\n@enduml\n");
  await writeFile(path.join(baseDir, "size", "big.puml"), `rectangle "${"x".repeat(512)}"\n`);
  await assertRejectCode(
    () =>
      resolveIncludes(new FilesystemSource({ baseDir, entryPath: "size/main.puml" }), {
        maxDepth: 5,
        maxTotalBytes: 100,
        remoteAllowlist: [],
      }),
    IncludeResolutionError,
    "MAX_TOTAL_SIZE_EXCEEDED"
  );
}

async function assertMcpStdio(baseDir) {
  const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const serverRoot = fileURLToPath(new URL("..", import.meta.url));
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry) => entry[1] !== undefined)
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: serverRoot,
    env: { ...env, PUML_BASE_DIR: baseDir },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: "faz2-smoke", version: "0.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    assert.ok(toolNames.includes("render_diagram"));
    assert.ok(toolNames.includes("resolve_includes"));
    assert.ok(toolNames.includes("validate"));

    const resolved = await client.callTool({
      name: "resolve_includes",
      arguments: { filePath: "diagrams/main.puml" },
    });
    assert.equal(resolved.content[0].type, "text");
    assertFlattenedHappyPath(resolved.content[0].text);

    const validation = await client.callTool({
      name: "validate",
      arguments: { filePath: "diagrams/main.puml" },
    });
    assert.equal(validation.structuredContent.ok, true);

    const rendered = await client.callTool({
      name: "render_diagram",
      arguments: { filePath: "diagrams/main.puml" },
    });
    const image = rendered.content.find((block) => block.type === "image");
    assert.ok(image);
    assertValidPng(Buffer.from(image.data, "base64"), "mcp filePath render");
    await assertMarkdownPngMetadata(rendered, "mcp filePath render");
  } finally {
    await client.close();
  }

  assert.equal(stderr.trim(), "", "MCP server stderr should stay quiet during Faz 2 smoke");
}

async function assertRejectCode(run, errorClass, code) {
  try {
    await run();
  } catch (err) {
    assert.ok(err instanceof errorClass, `expected ${errorClass.name}, got ${err}`);
    assert.equal(err.code, code);
    return;
  }
  assert.fail(`expected rejection with ${code}`);
}

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
  assert.ok(fileSize.width >= 1000, `${fixtureName}: metadata PNG width ${fileSize.width}`);
  assert.equal(structured.width, fileSize.width, `${fixtureName}: metadata width`);
  assert.equal(structured.height, fileSize.height, `${fixtureName}: metadata height`);
  assert.equal(structured.image.width, fileSize.width, `${fixtureName}: nested metadata width`);
  assert.equal(structured.image.height, fileSize.height, `${fixtureName}: nested metadata height`);

  const image = result.content.find((block) => block.type === "image");
  assert.ok(image, `${fixtureName}: expected image block for metadata comparison`);
  assert.deepEqual(Buffer.from(image.data, "base64"), fileBytes, `${fixtureName}: file matches image block`);
}
