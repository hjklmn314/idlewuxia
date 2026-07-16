import fs from "node:fs";
import path from "node:path";

import { compareRuntimeCombatAuditCapture } from "../src/runtimeCombatAudit.js";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
const configDir = path.join(root, "config");
fs.mkdirSync(outputDir, { recursive: true });

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function markdownReport(report) {
  const stepRows = report.comparison.steps
    .map((step) => `| ${step.stage} | ${step.status} | ${step.deltaSeconds ?? ""} | ${step.actual?.type || ""} |`)
    .join("\n");
  const findingRows = report.findings
    .map((item) => `| ${item.severity} | ${item.type} | ${item.stage || ""} | ${item.deltaSeconds ?? ""} |`)
    .join("\n");
  return [
    "# Runtime Combat Capture Comparison",
    "",
    `Generated: ${report.generatedAt}`,
    `Capture: ${report.captureFile}`,
    `Status: ${report.comparison.passed ? "PASS" : "FAIL"}`,
    `Stream events: ${report.comparison.capturedStreamCount}`,
    `Timing tolerance: ${report.comparison.timingToleranceSeconds}s`,
    "",
    "## Stage Comparison",
    "",
    "| Stage | Status | Delta seconds | Actual type |",
    "| --- | --- | --- | --- |",
    stepRows || "| none | missing | | |",
    "",
    "## Findings",
    "",
    "| Severity | Type | Stage | Delta seconds |",
    "| --- | --- | --- | --- |",
    findingRows || "| info | clean | | |",
    "",
  ].join("\n");
}

const defaultFreshCapture = path.join("outputs", "runtime_combat_audit_browser_blackhole10_20260701_runtime.json");
const defaultCapture = fs.existsSync(path.join(root, defaultFreshCapture))
  ? defaultFreshCapture
  : path.join("outputs", "runtime_combat_audit_browser_blackhole10.json");
const captureFile = path.resolve(root, argValue("capture", defaultCapture));
const demoId = argValue("demo", "blackhole10");
const tolerance = Number(argValue("tolerance", "0.45"));

const combatFeedback = readJson(path.join(configDir, "combat_feedback.json"));
const adDemos = readJson(path.join(configDir, "ad_demo_timelines.json"));
const vfxRecipes = readJson(path.join(configDir, "vfx_recipes.json"));
const capture = readJson(captureFile);
const comparison = compareRuntimeCombatAuditCapture(capture, {
  config: { combatFeedback, adDemos, vfxRecipes },
  demoId,
  timingToleranceSeconds: tolerance,
});

const report = {
  generatedAt: new Date().toISOString(),
  captureFile,
  configFiles: [
    "config/combat_feedback.json",
    "config/ad_demo_timelines.json",
    "config/vfx_recipes.json",
    "src/firstSessionCombatFlow.js",
  ],
  comparison,
  findings: comparison.findings,
};

fs.writeFileSync(
  path.join(outputDir, "runtime_combat_capture_comparison_report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "runtime_combat_capture_comparison_report.md"),
  markdownReport(report),
  "utf8",
);

console.log(JSON.stringify({
  passed: comparison.passed,
  capturedStreamCount: comparison.capturedStreamCount,
  findings: comparison.findings.length,
}, null, 2));

if (!comparison.passed) {
  process.exit(1);
}
