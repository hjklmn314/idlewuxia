import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { evaluateApkWebBundleTraceability } from "./lib/apk-web-bundle-traceability.mjs";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
const identity = readJson(path.join(root, "config", "android_identity_contract.json"));
const projectScope = readJson(path.join(root, "config", "project_scope.json"));
const sourceApk = path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const deliveryApk = path.join(outputDir, "idlewuxia-debug.apk");
const bundleManifestPath = path.join(outputDir, "web_bundle_freshness", "web_bundle_manifest.json");
const requireCleanRevision = process.argv.includes("--require-clean");
const forbiddenTerms = [
  ...identity.forbiddenRuntimeTokens,
  ["game", "killer"].join(""),
  ["splash", "activity", "king"].join(""),
  ["games", "activity"].join(""),
  ["m", "od-game", "killerapp"].join(""),
  ["com", "aimobilestudio", "king"].join("."),
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertInside(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedParent + path.sep)) {
    throw new Error("Refusing filesystem operation outside " + resolvedParent + ": " + resolvedTarget);
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
      throw new Error("Invalid central directory entry at " + cursor);
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
      throw new Error("Invalid local ZIP entry for " + fileName);
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
    if (!content) throw new Error("Unsupported ZIP compression method " + method + " for " + fileName);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
  }
}

function gitRevision() {
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    dirty: Boolean(execFileSync(
      "git",
      ["status", "--porcelain"],
      { cwd: root, encoding: "utf8" },
    ).trim()),
  };
}

if (!fs.existsSync(sourceApk)) throw new Error("Debug APK not found: " + sourceApk);
if (!fs.existsSync(bundleManifestPath)) throw new Error("Web bundle manifest not found: " + bundleManifestPath);

const sourceApkStat = fs.statSync(sourceApk);
const sourceApkBytes = fs.readFileSync(sourceApk);
const deliveryBytes = fs.existsSync(deliveryApk) ? fs.readFileSync(deliveryApk) : null;
const bundleManifestBytes = fs.readFileSync(bundleManifestPath);
const bundleManifest = JSON.parse(bundleManifestBytes.toString("utf8").replace(/^\uFEFF/, ""));
fs.mkdirSync(outputDir, { recursive: true });
const extractDir = fs.mkdtempSync(path.join(outputDir, "idlewuxia-debug-audit-extract-"));
assertInside(outputDir, extractDir);
process.on("exit", () => {
  fs.rmSync(extractDir, { recursive: true, force: true });
});
extractZip(sourceApk, extractDir);

const files = walk(extractDir);
const entries = files.map((file) => path.relative(extractDir, file).replaceAll("\\", "/")).sort();
const fileByEntry = new Map(entries.map((entry) => [entry, path.join(extractDir, ...entry.split("/"))]));
const termHits = [];
for (const file of files) {
  const relative = path.relative(extractDir, file).replaceAll("\\", "/");
  const buffer = fs.readFileSync(file);
  const searchable = (
    relative + "\n" + buffer.toString("latin1") + "\n" + buffer.toString("utf16le")
  ).toLowerCase();
  for (const term of forbiddenTerms) {
    if (searchable.includes(term)) termHits.push({ term, file: relative });
  }
}

const apkAssets = new Map();
for (const [entry, absolute] of fileByEntry) {
  if (entry.startsWith("assets/public/")) {
    apkAssets.set(entry.slice("assets/public/".length), fs.readFileSync(absolute));
  }
}
const productEntries = projectScope.shippingFiles.map((file) => "assets/public/" + file);
const platformEntries = (bundleManifest.platformGeneratedFiles || [])
  .map((file) => "assets/public/" + file.path);
const requiredEntries = [...productEntries, ...platformEntries, "classes.dex"];
const missingEntries = requiredEntries.filter((entry) => !fileByEntry.has(entry));
const manifestBuffer = fs.readFileSync(path.join(extractDir, "AndroidManifest.xml"));
const resourcesBuffer = fs.readFileSync(path.join(extractDir, "resources.arsc"));
const manifestSearch = manifestBuffer.toString("latin1") + "\n" + manifestBuffer.toString("utf16le");
const packageMetadataSearch = (
  manifestSearch + "\n" + resourcesBuffer.toString("latin1") + "\n" + resourcesBuffer.toString("utf16le")
);
const packageLine = identity.debugApplicationId;
const launchableLine = identity.launcherClass;
const versionName = identity.versionName + identity.debugVersionNameSuffix;
const permissions = ["android.permission.INTERNET"];
const revision = gitRevision();
const generatedAt = new Date().toISOString();
const traceability = evaluateApkWebBundleTraceability({
  scope: projectScope,
  manifest: bundleManifest,
  manifestBytes: bundleManifestBytes,
  apkAssets,
  revision,
  apkBuiltAt: sourceApkStat.mtime.toISOString(),
  auditGeneratedAt: generatedAt,
  requireCleanRevision,
});
const findings = [...traceability.findings];

if (!deliveryBytes || !deliveryBytes.equals(sourceApkBytes)) {
  findings.push({
    severity: "error",
    type: "delivery-apk-mismatch",
    detail: "outputs/idlewuxia-debug.apk must be the exact APK published by the Gradle build.",
  });
}
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
  $schema: "idlewuxia.android_debug_apk_audit.v2",
  generatedAt,
  status: findings.length ? "fail" : "pass",
  formalAudit: {
    requireCleanRevision,
    ready: findings.length === 0 && traceability.formalReady,
  },
  revision,
  apk: {
    path: deliveryApk,
    sourcePath: sourceApk,
    bytes: sourceApkBytes.length,
    sha256: sha256(sourceApkBytes),
    deliveryMatchesSource: Boolean(deliveryBytes && deliveryBytes.equals(sourceApkBytes)),
    builtAt: sourceApkStat.mtime.toISOString(),
    packageLine,
    versionName,
    launchableLine,
    permissions,
  },
  webBundleManifest: {
    path: bundleManifestPath,
    bytes: bundleManifestBytes.length,
    sha256: sha256(bundleManifestBytes),
    generatedAt: bundleManifest.generatedAt,
    status: bundleManifest.status,
    revision: bundleManifest.revision,
    summary: bundleManifest.summary,
  },
  checks: {
    entryCount: entries.length,
    requiredProductEntries: productEntries,
    requiredPlatformEntries: platformEntries,
    requiredEntries,
    missingEntries,
    forbiddenHits: termHits,
    apkWebAssetCount: apkAssets.size,
    unexpectedWebAssets: traceability.unexpectedAssets,
  },
  traceability,
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
  JSON.stringify(report, null, 2) + "\n",
  "utf8",
);
const tick = String.fromCharCode(96);
fs.writeFileSync(
  path.join(outputDir, "idlewuxia_android_debug_build.md"),
  [
    "# Idle Wuxia Android Debug Build",
    "",
    "- Status: " + report.status,
    "- Formal audit ready: " + report.formalAudit.ready,
    "- Git commit: " + tick + revision.commit + tick,
    "- Git dirty: " + revision.dirty,
    "- APK: " + tick + path.basename(deliveryApk) + tick,
    "- Size: " + report.apk.bytes + " bytes",
    "- SHA-256: " + tick + report.apk.sha256 + tick,
    "- Package: " + tick + packageLine + tick,
    "- Launcher: " + tick + launchableLine + tick,
    "- Web manifest SHA-256: " + tick + report.webBundleManifest.sha256 + tick,
    "- Product asset hashes: " + traceability.summary.productFilesMatched + "/" + traceability.summary.productFiles,
    "- Platform asset hashes: " + traceability.summary.platformGeneratedFilesMatched + "/" + traceability.summary.platformGeneratedFiles,
    "- Unexpected web assets: " + traceability.summary.unexpectedAssets,
    "- Evidence timestamps ordered: " + traceability.timestamps.ordered,
    "- Findings: " + findings.length,
    "",
    "This development build does not certify store signing, live billing, backend receipt verification, or device acceptance.",
    "",
  ].join("\n"),
  "utf8",
);

assertInside(outputDir, extractDir);
fs.rmSync(extractDir, { recursive: true, force: true });
console.log(JSON.stringify(report, null, 2));
if (findings.some((entry) => entry.severity === "error")) process.exit(1);
