import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);
const argValue = (name, fallback = "") => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
};
const priority = argValue("--priority", "all");
const requestedConcurrency = Math.max(1, Number(argValue("--concurrency", "1")) || 1);
if (requestedConcurrency !== 1) {
  throw new Error("Real-browser acceptance is deliberately single-session only. Use --concurrency 1; concurrent Edge launches invalidate coverage evidence.");
}
const concurrency = 1;
const resume = argValue("--resume", "true") !== "false";
const outputRoot = path.join(root, "outputs", "wuxia_full_browser_audit_20260711");
const batchesPath = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl_batches", "fb01_browser_crawl_batches.csv");
const batchRunner = path.join(root, "tools", "run-wuxia-fb01-browser-crawl-batch.mjs");

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function readJson(filePath, fallback = null) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback; }
  catch { return fallback; }
}

function writeProgress(progress) {
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, "progress.json"), `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

function batchSummary(batchId) {
  return readJson(path.join(root, "outputs", "wuxia_fb01_browser_crawl_runs", batchId, "summary.json"));
}

const allBatches = parseCsv(batchesPath).filter((batch) => priority === "all" || batch.priority === priority);
const completed = resume ? allBatches.filter((batch) => batchSummary(batch.batchId)) : [];
const pending = resume ? allBatches.filter((batch) => !batchSummary(batch.batchId)) : allBatches;
const progress = {
  generatedAt: new Date().toISOString(), priority, concurrency, resume,
  executionPolicy: "single_browser_sequential",
  totalBatches: allBatches.length, skippedExisting: completed.map((batch) => batch.batchId),
  completed: [], running: [], pending: pending.map((batch) => batch.batchId),
};
writeProgress(progress);

function runBatch(batch, slot) {
  return new Promise((resolve) => {
    const portBase = 9600 + (slot * 20);
    const child = spawn(process.execPath, [batchRunner, "--batch-id", batch.batchId, "--port-base", String(portBase)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (exitCode) => resolve({ batch, slot, exitCode: exitCode ?? -1, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000), summary: batchSummary(batch.batchId) }));
    child.on("error", (error) => resolve({ batch, slot, exitCode: -1, stdout, stderr: error.message, summary: batchSummary(batch.batchId) }));
  });
}

let cursor = 0;
async function worker(slot) {
  while (cursor < pending.length) {
    const batch = pending[cursor]; cursor += 1;
    progress.running.push(batch.batchId); writeProgress(progress);
    const result = await runBatch(batch, slot);
    progress.running = progress.running.filter((id) => id !== batch.batchId);
    progress.pending = progress.pending.filter((id) => id !== batch.batchId);
    progress.completed.push({
      batchId: batch.batchId, priority: batch.priority, exitCode: result.exitCode,
      total: result.summary?.total ?? 0, passed: result.summary?.passed ?? 0,
      blocked: result.summary?.blocked ?? 0, failed: result.summary?.failed ?? 0,
      stderrTail: result.stderr,
    });
    writeProgress(progress);
    console.log(JSON.stringify(progress.completed.at(-1)));
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, (_value, index) => worker(index)));
const summary = {
  ...progress,
  finishedAt: new Date().toISOString(),
  totals: progress.completed.reduce((result, row) => ({
    batches: result.batches + 1, targets: result.targets + row.total,
    passed: result.passed + row.passed, blocked: result.blocked + row.blocked,
    failed: result.failed + row.failed,
  }), { batches: 0, targets: 0, passed: 0, blocked: 0, failed: 0 }),
};
fs.writeFileSync(path.join(outputRoot, `summary_${priority}.json`), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary.totals, null, 2));
if (summary.totals.failed > 0) process.exitCode = 1;
