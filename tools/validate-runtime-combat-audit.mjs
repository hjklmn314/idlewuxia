import fs from "node:fs";
import path from "node:path";

import {
  createRuntimeCombatAudit,
  installRuntimeCombatAuditBridge,
  publishRuntimeCombatAudit,
} from "../src/runtimeCombatAudit.js";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const combatFeedback = JSON.parse(fs.readFileSync(path.join(root, "config", "combat_feedback.json"), "utf8"));
const adDemos = JSON.parse(fs.readFileSync(path.join(root, "config", "ad_demo_timelines.json"), "utf8"));
const vfxRecipes = JSON.parse(fs.readFileSync(path.join(root, "config", "vfx_recipes.json"), "utf8"));
const config = { combatFeedback, adDemos, vfxRecipes };

const findings = [];
let checkCount = 0;
let now = 10_000;

function expect(name, condition, detail = "") {
  checkCount += 1;
  if (!condition) findings.push({ severity: "error", name, detail });
}

const runtimeAudit = createRuntimeCombatAudit({
  config,
  demoId: "blackhole10",
  now: () => now,
});

runtimeAudit.start({ startedAt: now, sessionId: "runtime-test" });
const expected = runtimeAudit.snapshot().expected.sequence;

for (const event of expected) {
  now = 10_000 + event.t * 1000;
  runtimeAudit.record(event);
}

const comparison = runtimeAudit.compare();
const snapshot = runtimeAudit.snapshot();
const serialized = runtimeAudit.exportJson();
const parsed = JSON.parse(serialized);
const browserTarget = {};
const bridge = installRuntimeCombatAuditBridge(browserTarget, runtimeAudit);
const evidenceNode = { textContent: "" };
const published = publishRuntimeCombatAudit(evidenceNode, runtimeAudit);

expect("snapshot.schema", snapshot.schemaVersion === 1, String(snapshot.schemaVersion));
expect("snapshot.session", snapshot.sessionId === "runtime-test", snapshot.sessionId);
expect("snapshot.relativeTime", snapshot.stream[0]?.t === expected[0].t, JSON.stringify(snapshot.stream[0]));
expect("comparison.clean", comparison.findings.length === 0, JSON.stringify(comparison.findings));
expect(
  "comparison.allStepsPass",
  comparison.steps.length === expected.length && comparison.steps.every((step) => step.status === "pass"),
  JSON.stringify(comparison.steps),
);
expect("export.sameSession", parsed.sessionId === snapshot.sessionId, parsed.sessionId);
expect("export.hasComparison", parsed.comparison?.passed === true, JSON.stringify(parsed.comparison));
expect("bridge.installed", browserTarget.__NOVALITE_AUDIT__ === bridge);
expect("bridge.compare", browserTarget.__NOVALITE_AUDIT__.compare().passed === true);
expect("bridge.export", JSON.parse(browserTarget.__NOVALITE_AUDIT__.exportJson()).sessionId === snapshot.sessionId);
expect("evidence.published", published === true && JSON.parse(evidenceNode.textContent).comparison.passed === true);

const report = {
  generatedAt: new Date().toISOString(),
  checks: checkCount,
  comparison,
  snapshot,
  findings,
};

fs.writeFileSync(
  path.join(outputDir, "runtime_combat_audit_validation_report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(JSON.stringify(report, null, 2));

if (findings.some((item) => item.severity === "error")) {
  process.exit(1);
}
