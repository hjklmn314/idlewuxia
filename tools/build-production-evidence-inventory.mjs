import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs", "production_os");
const textExtensions = new Set([
  ".css",
  ".gradle",
  ".html",
  ".java",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".properties",
  ".pro",
  ".ps1",
  ".svg",
  ".ts",
  ".xml",
  ".yml",
  ".yaml",
]);
const exactTextFiles = new Set([
  ".gitignore",
  "android/gradlew",
  "android/gradlew.bat",
]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function listTrackedFiles() {
  const result = childProcess.spawnSync(
    "git",
    ["-c", "core.quotepath=false", "ls-files", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ls-files failed (${result.status}): ${result.stderr || "no stderr"}`);
  }
  return result.stdout.split("\0").filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function isTextPath(file) {
  return exactTextFiles.has(file) || textExtensions.has(path.extname(file).toLowerCase());
}

const tracked = listTrackedFiles();
const records = [];
const parseFailures = [];
let totalBytes = 0;
let textBytes = 0;
let textLines = 0;

for (const file of tracked) {
  const filePath = path.join(root, file);
  const buffer = fs.readFileSync(filePath);
  totalBytes += buffer.length;
  const text = isTextPath(file);
  const record = {
    path: file.replace(/\\/g, "/"),
    bytes: buffer.length,
    sha256: sha256(buffer),
    mode: text ? "full-text-read" : "full-binary-read",
  };
  if (text) {
    const value = buffer.toString("utf8");
    record.lines = value.length === 0 ? 0 : value.split(/\r?\n/).length;
    record.utf8Bom = value.charCodeAt(0) === 0xfeff;
    textBytes += buffer.length;
    textLines += record.lines;
    if (path.extname(file).toLowerCase() === ".json") {
      try {
        JSON.parse(record.utf8Bom ? value.slice(1) : value);
        record.parse = "json-pass";
      } catch (error) {
        record.parse = "json-fail";
        parseFailures.push({ path: record.path, message: error.message });
      }
    }
  }
  records.push(record);
}

const report = {
  schema: "idlewuxia.production_evidence_inventory.v1",
  generatedAt: new Date().toISOString(),
  repository: root.replace(/\\/g, "/"),
  scope: "git-tracked-files",
  method: "Every tracked file was read to EOF as bytes; known text formats were decoded in full; JSON files were parsed in full.",
  summary: {
    trackedFiles: records.length,
    totalBytes,
    textFiles: records.filter((record) => record.mode === "full-text-read").length,
    binaryFiles: records.filter((record) => record.mode === "full-binary-read").length,
    textBytes,
    textLines,
    jsonFiles: records.filter((record) => record.parse).length,
    jsonParseFailures: parseFailures.length,
  },
  parseFailures,
  records,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "tracked-file-full-read-inventory.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  status: parseFailures.length ? "fail" : "pass",
  output: "outputs/production_os/tracked-file-full-read-inventory.json",
  summary: report.summary,
}, null, 2));

if (parseFailures.length) process.exitCode = 1;
