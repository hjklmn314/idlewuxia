import fs from "node:fs";
import path from "node:path";
import { materializeWebBundle } from "./lib/web-bundle-freshness.mjs";

const root = path.resolve(".");
const output = path.join(root, "www");
const scope = JSON.parse(
  fs.readFileSync(path.join(root, "config", "project_scope.json"), "utf8").replace(/^\uFEFF/, ""),
);
const sourceFiles = new Map();

for (const relativePath of scope.shippingFiles || []) {
  const source = path.join(root, relativePath);
  if (fs.existsSync(source)) sourceFiles.set(relativePath, fs.readFileSync(source));
}

const build = materializeWebBundle({ scope, sourceFiles });
if (build.findings.length) {
  throw new Error("Web bundle materialization failed:\n" + JSON.stringify(build.findings, null, 2));
}

fs.rmSync(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
fs.mkdirSync(output, { recursive: true });
for (const [relativePath, bytes] of build.outputFiles) {
  const destination = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

const builtFiles = [];
function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute);
    else builtFiles.push(path.relative(output, absolute).replaceAll("\\", "/"));
  }
}
collectFiles(output);
builtFiles.sort((left, right) => left.localeCompare(right, "en"));

if (JSON.stringify(builtFiles) !== JSON.stringify(build.shippingFiles)) {
  throw new Error(
    "Shipping closure mismatch. Expected " + JSON.stringify(build.shippingFiles)
    + ", built " + JSON.stringify(builtFiles) + ".",
  );
}

const index = fs.readFileSync(path.join(output, scope.htmlEntry), "utf8");
for (const requiredNode of ['id="app"', 'id="wuxiaShell"']) {
  if (!index.includes(requiredNode)) {
    throw new Error("Wuxia web shell node is missing from web build: " + requiredNode);
  }
}
for (const developmentReference of scope.developmentReferenceFiles || []) {
  if (builtFiles.includes(developmentReference)) {
    throw new Error("Development reference leaked into shipping closure: " + developmentReference);
  }
}

console.log(
  "Built " + builtFiles.length + " scoped assets ("
  + build.filePlans.filter((entry) => entry.transform === "copy").length + " copy, "
  + build.filePlans.filter((entry) => entry.transform !== "copy").length
  + " transformed) at " + output,
);
