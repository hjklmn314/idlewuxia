import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs", "full_release_audit_20260804");
const textExtensions = new Set([".js", ".mjs", ".cjs", ".json", ".md", ".html", ".css", ".xml", ".gradle", ".properties", ".yml", ".yaml", ".txt", ".csv", ".ps1", ".java", ".svg", ".gitignore"]);
const codeExtensions = new Set([".js", ".mjs", ".cjs", ".html", ".css", ".ps1", ".java", ".gradle"]);
const resourceExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ogg", ".mp3", ".wav", ".woff", ".woff2", ".ttf", ".otf"]);

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: root, encoding: options.encoding ?? "utf8", maxBuffer: 128 * 1024 * 1024 });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  fs.writeFileSync(filePath, `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`, "utf8");
}

function categoryFor(relativePath, extension) {
  if (relativePath.endsWith(".md")) return "markdown";
  if (relativePath.startsWith("config/") || extension === ".json") return "configuration";
  if (resourceExtensions.has(extension)) return "resource";
  if (relativePath.startsWith("android/")) return "android";
  if (relativePath.startsWith("tools/")) return "tooling";
  if (relativePath.startsWith("src/") || codeExtensions.has(extension)) return "runtime-code";
  return "project-control";
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function walk(directory, rows = []) {
  if (!fs.existsSync(directory)) return rows;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath, rows);
    else rows.push(absolutePath);
  }
  return rows;
}

const tracked = git(["ls-files", "-z"], { encoding: "buffer" }).toString("utf8").split("\0").filter(Boolean).sort();
const projectFiles = [...new Set([
  ...tracked,
  ...git(["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "buffer" }).toString("utf8").split("\0").filter(Boolean),
])].sort();
const trackedSet = new Set(tracked.map((value) => value.replaceAll("\\", "/")));
const recentLog = git(["log", "--since=5.days", "--date=iso-strict", "--pretty=format:%H%x09%ad%x09%an%x09%s", "--name-status"]);
const recentLines = recentLog.split(/\r?\n/);
const recentCommits = [];
let activeCommit = null;
for (const line of recentLines) {
  if (/^[a-f0-9]{40}\t/.test(line)) {
    const [sha, date, author, ...subjectParts] = line.split("\t");
    activeCommit = { sha, date, author, subject: subjectParts.join("\t"), files: [] };
    recentCommits.push(activeCommit);
  } else if (activeCommit && /^[AMDTRC]\d*\t/.test(line)) {
    const parts = line.split("\t");
    activeCommit.files.push({ status: parts[0], paths: parts.slice(1) });
  }
}
const recentTouched = new Set(recentCommits.flatMap((commit) => commit.files.flatMap((entry) => entry.paths)));

const findings = [];
const ledger = [];
for (const relativePath of projectFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    findings.push({ severity: "P0", code: "TRACKED_FILE_MISSING", file: relativePath, message: "Tracked file is absent from the worktree." });
    ledger.push({ path: relativePath, present: false, category: "missing", bytes: 0, lines: 0, sha256: "", recent5d: recentTouched.has(relativePath), validation: "missing" });
    continue;
  }
  const buffer = fs.readFileSync(absolutePath);
  const extension = path.extname(relativePath).toLowerCase() || (path.basename(relativePath) === ".gitignore" ? ".gitignore" : "");
  const isText = textExtensions.has(extension);
  const text = isText ? buffer.toString("utf8").replace(/^\uFEFF/, "") : "";
  let validation = "byte-read";
  if (extension === ".json") {
    try { JSON.parse(text); validation = "json-parsed"; }
    catch (error) { findings.push({ severity: "P0", code: "JSON_PARSE_FAILED", file: relativePath, message: error.message }); validation = "json-failed"; }
  } else if ([".js", ".mjs", ".cjs"].includes(extension)) {
    const checked = spawnSync(process.execPath, ["--check", absolutePath], { cwd: root, encoding: "utf8" });
    if (checked.status !== 0) findings.push({ severity: "P0", code: "JS_SYNTAX_FAILED", file: relativePath, message: String(checked.stderr || checked.stdout).trim().slice(-1000) });
    validation = checked.status === 0 ? "js-syntax-pass" : "js-syntax-failed";
  } else if (extension === ".svg") {
    validation = /<svg\b[\s\S]*<\/svg>\s*$/i.test(text) ? "svg-root-pass" : "svg-root-failed";
    if (validation.endsWith("failed")) findings.push({ severity: "P0", code: "SVG_STRUCTURE_FAILED", file: relativePath, message: "SVG root element is incomplete." });
  } else if (isText) validation = "utf8-read";
  const dimensions = extension === ".png" ? pngDimensions(buffer) : null;
  ledger.push({
    path: relativePath.replaceAll("\\", "/"),
    tracked: trackedSet.has(relativePath.replaceAll("\\", "/")),
    present: true,
    category: categoryFor(relativePath.replaceAll("\\", "/"), extension),
    extension: extension || "none",
    bytes: buffer.length,
    lines: isText ? (text ? text.split(/\r?\n/).length : 0) : 0,
    sha256: sha256(buffer),
    recent5d: recentTouched.has(relativePath.replaceAll("\\", "/")),
    validation,
    width: dimensions?.width || "",
    height: dimensions?.height || "",
  });
}

const resourceRoots = [path.join(root, "public"), path.join(root, "android", "app", "src", "main", "res")];
const allResources = resourceRoots.flatMap((directory) => walk(directory)).filter((absolutePath) => resourceExtensions.has(path.extname(absolutePath).toLowerCase()));
const resourceLedger = allResources.map((absolutePath) => {
  const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
  const buffer = fs.readFileSync(absolutePath);
  const extension = path.extname(relativePath).toLowerCase();
  const ignored = spawnSync("git", ["check-ignore", "-v", "--", relativePath], { cwd: root, encoding: "utf8" });
  const dimensions = extension === ".png" ? pngDimensions(buffer) : null;
  return {
    path: relativePath,
    tracked: trackedSet.has(relativePath),
    ignored: ignored.status === 0,
    ignoreRule: ignored.status === 0 ? String(ignored.stdout).trim() : "",
    bytes: buffer.length,
    sha256: sha256(buffer),
    width: dimensions?.width || "",
    height: dimensions?.height || "",
  };
});

const productionAssets = JSON.parse(fs.readFileSync(path.join(root, "config", "production", "asset_registry.json"), "utf8"));
const openAssetSlots = productionAssets.requiredSlots.filter((slot) => slot.status !== "satisfied");
for (const slot of openAssetSlots) findings.push({ severity: "P0", code: "REQUIRED_ASSET_SLOT_OPEN", file: "config/production/asset_registry.json", message: `${slot.id} -> ${slot.taskId}` });
if (!trackedSet.has("android/gradle/wrapper/gradle-wrapper.jar")) findings.push({ severity: "P0", code: "ANDROID_WRAPPER_NOT_TRACKED", file: "android/gradle/wrapper/gradle-wrapper.jar", message: "Clean checkout cannot reproduce Gradle without the wrapper JAR." });
for (const resource of resourceLedger.filter((entry) => !entry.tracked && /android\/app\/src\/main\/res\/(mipmap|drawable)/.test(entry.path))) {
  findings.push({ severity: "P1", code: "ANDROID_BINARY_RESOURCE_UNTRACKED", file: resource.path, message: "Android resource exists locally but is absent from a clean checkout; provenance/adoption must be resolved." });
}

const byCategory = Object.fromEntries([...new Set(ledger.map((entry) => entry.category))].sort().map((category) => [category, {
  files: ledger.filter((entry) => entry.category === category).length,
  bytes: ledger.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.bytes, 0),
  lines: ledger.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.lines, 0),
} ]));
const report = {
  schema: "idlewuxia.full_release_audit_ledger.v1",
  generatedAt: new Date().toISOString(),
  authorityRoot: root.replaceAll("\\", "/"),
  coverage: {
    trackedFiles: tracked.length,
    projectFilesRead: projectFiles.length,
    presentProjectFiles: ledger.filter((entry) => entry.present).length,
    bytesRead: ledger.reduce((sum, entry) => sum + entry.bytes, 0),
    textLinesRead: ledger.reduce((sum, entry) => sum + entry.lines, 0),
    recentCommits: recentCommits.length,
    recentTouchedFiles: recentTouched.size,
    resourcesOnDisk: resourceLedger.length,
    trackedResources: resourceLedger.filter((entry) => entry.tracked).length,
    ignoredOrUntrackedResources: resourceLedger.filter((entry) => !entry.tracked).length,
    byCategory,
  },
  recentCommits,
  openAssetSlots,
  findings,
  verdict: findings.some((finding) => finding.severity === "P0") ? "RELEASE_BLOCKED" : "STATIC_LEDGER_PASS_RUNTIME_AND_MANUAL_GATES_REQUIRED",
};

fs.mkdirSync(outputDir, { recursive: true });
writeCsv(path.join(outputDir, "full_file_ledger.csv"), ledger, ["path", "tracked", "present", "category", "extension", "bytes", "lines", "sha256", "recent5d", "validation", "width", "height"]);
writeCsv(path.join(outputDir, "resource_ledger.csv"), resourceLedger, ["path", "tracked", "ignored", "ignoreRule", "bytes", "sha256", "width", "height"]);
writeCsv(path.join(outputDir, "findings.csv"), findings, ["severity", "code", "file", "message"]);
fs.writeFileSync(path.join(outputDir, "full_release_audit_ledger.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ verdict: report.verdict, coverage: report.coverage, findings: { total: findings.length, p0: findings.filter((entry) => entry.severity === "P0").length, p1: findings.filter((entry) => entry.severity === "P1").length }, outputDir: path.relative(root, outputDir).replaceAll("\\", "/") }, null, 2));
