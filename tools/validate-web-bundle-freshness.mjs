import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { evaluateWebBundleFreshness } from "./lib/web-bundle-freshness.mjs";

const root = path.resolve(".");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function collectFiles(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  const files = new Map();
  if (!fs.existsSync(absoluteRoot)) return files;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        files.set(path.relative(absoluteRoot, absolute).replaceAll("\\", "/"), fs.readFileSync(absolute));
      }
    }
  }
  walk(absoluteRoot);
  return files;
}

function assertInsideRoot(relativePath) {
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Refusing output outside project root: " + target);
  }
  return target;
}

function gitRevision() {
  try {
    return {
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      dirty: Boolean(execFileSync(
        "git",
        ["status", "--porcelain", "--untracked-files=no"],
        { cwd: root, encoding: "utf8" },
      ).trim()),
    };
  } catch {
    return { commit: null, dirty: true };
  }
}

const scope = readJson("config/project_scope.json");
const contract = readJson("config/web_bundle_contract.json");
const sourceFiles = new Map();
for (const relativePath of scope.shippingFiles || []) {
  const absolute = path.join(root, relativePath);
  if (fs.existsSync(absolute)) sourceFiles.set(relativePath, fs.readFileSync(absolute));
}

const report = evaluateWebBundleFreshness({
  scope,
  contract,
  sourceFiles,
  wwwFiles: collectFiles(contract.webRoot),
  androidFiles: collectFiles(contract.androidAssetsRoot),
  revision: gitRevision(),
});

const manifestPath = assertInsideRoot(contract.manifestPath);
const reportPath = assertInsideRoot(contract.reportPath);
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(report, null, 2) + "\n", "utf8");
fs.writeFileSync(reportPath, [
  "# Idle Wuxia Web Bundle Freshness",
  "",
  "- Status: " + report.status,
  "- Git commit: " + (report.revision.commit || "unavailable"),
  "- Git dirty: " + report.revision.dirty,
  "- Shipping files: " + report.summary.shippingFiles,
  "- Direct-copy files: " + report.summary.copyFiles,
  "- Deterministically transformed files: " + report.summary.transformedFiles,
  "- Unexpected www files: " + report.summary.wwwUnexpectedFiles,
  "- Unexpected Android files: " + report.summary.androidUnexpectedFiles,
  "- Findings: " + report.summary.findings,
  "",
  "The two runtime JSON files retain source provenance but are compared after the declared evidence-sanitization transform.",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({
  status: report.status,
  manifestPath,
  revision: report.revision,
  summary: report.summary,
  findings: report.findings,
}, null, 2));
if (report.status !== "pass") process.exit(1);
