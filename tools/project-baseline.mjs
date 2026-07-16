import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { evaluateProjectBaseline } from "./lib/project-baseline.mjs";

const root = path.resolve(".");
const args = new Set(process.argv.slice(2));
const modeArg = process.argv.find((value) => value.startsWith("--mode="));
const modeIndex = process.argv.indexOf("--mode");
const mode = modeArg?.split("=")[1] || (modeIndex >= 0 ? process.argv[modeIndex + 1] : "baseline");
const requireClean = args.has("--require-clean");
const requireUpstream = args.has("--require-upstream");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

let gitAvailable = true;
function git(argsList, fallback = "") {
  try {
    return execFileSync("git", argsList, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    gitAvailable = false;
    return fallback;
  }
}

function gitOptional(argsList, fallback = "") {
  try {
    return execFileSync("git", argsList, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return fallback;
  }
}

function splitNull(value) {
  return value.split("\0").filter(Boolean);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeArtifacts(result) {
  const key = result.gitState.head?.slice(0, 12) || "no-git-head";
  const suffix = result.gitState.dirty ? "-dirty" : "";
  const output = path.join(root, "outputs", "project_baseline", `${key}${suffix}`);
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  const manifestRows = ["path,category,bytes,sha256", ...result.manifest.map((row) =>
    [row.path, row.category, row.bytes, row.sha256].map(csvCell).join(","),
  )];
  fs.writeFileSync(path.join(output, "baseline_manifest.csv"), `${manifestRows.join("\n")}\n`);

  const summary = {
    schema: result.schema,
    generatedAt: new Date().toISOString(),
    projectId: result.projectId,
    pass: result.pass,
    baselineDigest: result.baselineDigest,
    trackedFileCount: result.trackedFileCount,
    untrackedFileCount: result.untrackedFileCount,
    shippingFileCount: result.shippingFileCount,
    gitState: result.gitState,
    findingCount: result.findings.length,
    findings: result.findings,
  };
  fs.writeFileSync(path.join(output, "baseline_summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(
    path.join(output, "scope_gate.json"),
    `${JSON.stringify({ pass: result.pass, findings: result.findings }, null, 2)}\n`,
  );

  const report = [
    "# idlewuxia 项目基线报告",
    "",
    `- 结果：${result.pass ? "PASS" : "FAIL"}`,
    `- 基线摘要：\`${result.baselineDigest}\``,
    `- 跟踪文件：${result.trackedFileCount}`,
    `- 非忽略未跟踪文件：${result.untrackedFileCount}`,
    `- 发布闭包文件：${result.shippingFileCount}`,
    `- Git HEAD：\`${result.gitState.head || "unavailable"}\``,
    "",
    "## 发现",
    "",
    ...(result.findings.length
      ? result.findings.map((row) => `- [${row.code}] ${row.subject}: ${row.message}`)
      : ["- 无阻断项。"]),
    "",
  ];
  fs.writeFileSync(path.join(output, "baseline_report.md"), report.join("\n"));
  return output;
}

const scope = readJson("config/project_scope.json");
const contract = readJson("config/project_baseline_contract.json");
const injectedSnapshot = process.env.IDLEWUXIA_GIT_SNAPSHOT
  ? JSON.parse(Buffer.from(process.env.IDLEWUXIA_GIT_SNAPSHOT, "base64").toString("utf8"))
  : null;
const trackedFiles = injectedSnapshot?.trackedFiles || splitNull(git(["ls-files", "-z"]));
const untrackedFiles = injectedSnapshot?.untrackedFiles || splitNull(git(["ls-files", "--others", "--exclude-standard", "-z"]));
const head = injectedSnapshot?.head || git(["rev-parse", "HEAD"]);
const upstream = injectedSnapshot?.upstream || gitOptional(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
const upstreamHead = injectedSnapshot?.upstreamHead || (upstream ? gitOptional(["rev-parse", "@{u}"]) : "");
const dirty = injectedSnapshot ? Boolean(injectedSnapshot.dirty) : Boolean(git(["status", "--porcelain", "--untracked-files=normal"]));
if (injectedSnapshot) gitAvailable = true;
const fileSystem = {
  exists(file) {
    return fs.existsSync(path.join(root, file));
  },
  readFile(file) {
    return fs.readFileSync(path.join(root, file));
  },
};

const result = evaluateProjectBaseline({
  fileSystem,
  scope,
  contract,
  trackedFiles,
  untrackedFiles,
  gitState: {
    available: gitAvailable,
    branch: injectedSnapshot?.branch || git(["branch", "--show-current"]),
    head,
    upstream: upstream || null,
    upstreamHead: upstreamHead || null,
    upstreamConfigured: Boolean(upstream),
    dirty,
  },
  requireClean,
  requireUpstream,
});

const output = mode === "baseline" || mode === "build" ? writeArtifacts(result) : null;
console.log(
  JSON.stringify(
    {
      mode,
      pass: result.pass,
      baselineDigest: result.baselineDigest,
      trackedFileCount: result.trackedFileCount,
      shippingFileCount: result.shippingFileCount,
      findings: result.findings,
      output,
    },
    null,
    2,
  ),
);
if (!result.pass) process.exitCode = 1;
