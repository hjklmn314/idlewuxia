import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
const identity = JSON.parse(
  fs.readFileSync(path.join(root, "config", "android_identity_contract.json"), "utf8").replace(/^\uFEFF/, ""),
);
const projectScope = JSON.parse(
  fs.readFileSync(path.join(root, "config", "project_scope.json"), "utf8").replace(/^\uFEFF/, ""),
);
const sourceApk = path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const deliveryApk = path.join(outputDir, "idlewuxia-debug.apk");
const extractDir = path.join(outputDir, "idlewuxia-debug-audit-extract");
const forbiddenTerms = [
  ...identity.forbiddenRuntimeTokens,
  ["game", "killer"].join(""),
  ["splash", "activity", "king"].join(""),
  ["games", "activity"].join(""),
  ["m", "od-game", "killerapp"].join(""),
  ["com", "aimobilestudio", "king"].join("."),
];
const requiredEntries = [
  ...projectScope.shippingFiles.map((file) => `assets/public/${file}`),
  "classes.dex",
];

function assertInside(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(`${resolvedParent}${path.sep}`)) {
    throw new Error(`Refusing filesystem operation outside ${resolvedParent}: ${resolvedTarget}`);
  }
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else files.push(target);
  }
  return files;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("APK ZIP central directory was not found");
}

function extractZip(zipPath, destination) {
  const zip = fs.readFileSync(zipPath);
  const eocd = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Invalid central directory entry at ${cursor}`);
    }
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const fileNameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const fileName = zip.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
    cursor += 46 + fileNameLength + extraLength + commentLength;

    if (fileName.endsWith("/")) continue;
    const outputPath = path.resolve(destination, fileName);
    assertInside(destination, outputPath);
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP entry for ${fileName}`);
    }
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0
      ? compressed
      : method === 8
        ? zlib.inflateRawSync(compressed)
        : null;
    if (!content) throw new Error(`Unsupported ZIP compression method ${method} for ${fileName}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
  }
}

if (!fs.existsSync(sourceApk)) throw new Error(`Debug APK not found: ${sourceApk}`);

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(sourceApk, deliveryApk);

assertInside(outputDir, extractDir);
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });
extractZip(deliveryApk, extractDir);

const files = walk(extractDir);
const entries = files.map((file) => path.relative(extractDir, file).replaceAll("\\", "/")).sort();
const termHits = [];

for (const file of files) {
  const relative = path.relative(extractDir, file).replaceAll("\\", "/");
  const buffer = fs.readFileSync(file);
  const searchable = `${relative}\n${buffer.toString("latin1")}\n${buffer.toString("utf16le")}`.toLowerCase();
  for (const term of forbiddenTerms) {
    if (searchable.includes(term)) termHits.push({ term, file: relative });
  }
}

const missingEntries = requiredEntries.filter((entry) => !entries.includes(entry));
const manifestPath = path.join(extractDir, "AndroidManifest.xml");
const manifestBuffer = fs.readFileSync(manifestPath);
const resourcesBuffer = fs.readFileSync(path.join(extractDir, "resources.arsc"));
const manifestSearch = `${manifestBuffer.toString("latin1")}\n${manifestBuffer.toString("utf16le")}`;
const packageMetadataSearch = `${manifestSearch}\n${resourcesBuffer.toString("latin1")}\n${resourcesBuffer.toString("utf16le")}`;
const packageLine = identity.debugApplicationId;
const launchableLine = identity.launcherClass;
const versionName = `${identity.versionName}${identity.debugVersionNameSuffix}`;
const permissions = ["android.permission.INTERNET"];
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(deliveryApk)).digest("hex");
const findings = [];

if (!manifestSearch.includes(packageLine)) {
  findings.push({ severity: "error", type: "unexpected-package", detail: packageLine });
}
if (!packageMetadataSearch.includes(versionName)) {
  findings.push({ severity: "error", type: "unexpected-version", detail: versionName });
}
if (!manifestSearch.includes(launchableLine) && !manifestSearch.includes(".MainActivity")) {
  findings.push({ severity: "error", type: "unexpected-launcher", detail: launchableLine });
}
if (missingEntries.length) {
  findings.push({ severity: "error", type: "missing-required-entries", entries: missingEntries });
}
if (termHits.length) {
  findings.push({ severity: "error", type: "excluded-content-found", hits: termHits });
}

const report = {
  generatedAt: new Date().toISOString(),
  apk: {
    path: deliveryApk,
    bytes: fs.statSync(deliveryApk).size,
    sha256,
    packageLine,
    versionName,
    launchableLine,
    permissions,
  },
  checks: {
    entryCount: entries.length,
    requiredEntries,
    missingEntries,
    forbiddenHits: termHits,
  },
  commercialStatus: {
    mode: "DEVELOPMENT_DEBUG",
    liveAdMobSdk: false,
    livePlayBillingSdk: false,
    backendReceiptVerification: false,
  },
  findings,
};

fs.writeFileSync(
  path.join(outputDir, "android_debug_apk_audit.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "idlewuxia_android_debug_build.md"),
  [
    "# Idle Wuxia Android Debug Build",
    "",
    `- APK: \`${path.basename(deliveryApk)}\``,
    `- Size: ${report.apk.bytes} bytes`,
    `- SHA-256: \`${sha256}\``,
    `- Package: \`${packageLine}\``,
    `- Launcher: \`${launchableLine}\``,
    `- Required game entries: ${missingEntries.length ? "FAIL" : "PASS"}`,
    `- Excluded wrapper scan: ${termHits.length ? "FAIL" : "PASS"}`,
    `- Findings: ${findings.length}`,
    "",
    "This development build does not certify store signing, live billing, backend receipt verification, or device acceptance.",
    "",
  ].join("\n"),
  "utf8",
);

assertInside(outputDir, extractDir);
fs.rmSync(extractDir, { recursive: true, force: true });

console.log(JSON.stringify(report, null, 2));
if (findings.some((finding) => finding.severity === "error")) process.exit(1);
