import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const output = path.join(root, "www");
const scope = JSON.parse(
  fs.readFileSync(path.join(root, "config", "project_scope.json"), "utf8").replace(/^\uFEFF/, ""),
);
const omitted = Symbol("omitted-development-evidence");
const sanitization = scope.shippingSanitization || {};
const sanitizedJsonFiles = new Set(sanitization.jsonFiles || []);
const removedKeys = new Set(sanitization.removeObjectKeys || []);
const forbiddenStringPatterns = (sanitization.forbiddenStringPatterns || []).map((value) => value.toLowerCase());

function sanitizeShippingValue(value) {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return forbiddenStringPatterns.some((pattern) => normalized.includes(pattern)) ? omitted : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeShippingValue).filter((entry) => entry !== omitted);
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (removedKeys.has(key)) continue;
      const sanitized = sanitizeShippingValue(entry);
      if (sanitized !== omitted) output[key] = sanitized;
    }
    return output;
  }
  return value;
}

fs.rmSync(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
fs.mkdirSync(output, { recursive: true });

for (const relativePath of scope.shippingFiles) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Missing scoped web build input: ${relativePath}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (sanitizedJsonFiles.has(relativePath)) {
    const sourceData = JSON.parse(fs.readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
    fs.writeFileSync(destination, `${JSON.stringify(sanitizeShippingValue(sourceData), null, 2)}\n`);
  } else {
    fs.copyFileSync(source, destination);
  }
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
builtFiles.sort((a, b) => a.localeCompare(b, "en"));

const expectedFiles = [...scope.shippingFiles].sort((a, b) => a.localeCompare(b, "en"));
if (JSON.stringify(builtFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`Shipping closure mismatch. Expected ${JSON.stringify(expectedFiles)}, built ${JSON.stringify(builtFiles)}.`);
}

const indexPath = path.join(output, scope.htmlEntry);
const index = fs.readFileSync(indexPath, "utf8");
for (const requiredNode of ['id="app"', 'id="wuxiaShell"']) {
  if (!index.includes(requiredNode)) {
    throw new Error(`Wuxia web shell node is missing from web build: ${requiredNode}`);
  }
}

for (const developmentReference of scope.developmentReferenceFiles) {
  if (builtFiles.includes(developmentReference)) {
    throw new Error(`Development reference leaked into shipping closure: ${developmentReference}`);
  }
}

for (const relativePath of builtFiles) {
  if (!/\.(?:html|css|js|mjs|json|svg)$/i.test(relativePath)) continue;
  const contents = fs.readFileSync(path.join(output, relativePath), "utf8").toLowerCase();
  const leakedPattern = forbiddenStringPatterns.find((pattern) => contents.includes(pattern));
  if (leakedPattern) {
    throw new Error(`Development evidence token ${leakedPattern} leaked into shipping file: ${relativePath}`);
  }
}

console.log(`Built ${builtFiles.length} scoped and evidence-sanitized Capacitor web assets at ${output}`);
