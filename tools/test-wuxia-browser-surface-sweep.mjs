import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findSurfaceCoverageGaps, observedSurfacePairs } from "./lib/browser-surface-coverage.mjs";

const root = process.cwd();
const testOut = path.join(root, "tmp", "work", `qa_ui_sweep_contract_${process.pid}`);
fs.mkdirSync(testOut, { recursive: true });
const execution = spawnSync(process.execPath, [
  path.join(root, "tools", "run-wuxia-browser-surface-sweep.mjs"),
  "--dry-run",
  "--out-dir", path.relative(root, testOut),
], { cwd: root, encoding: "utf8" });
assert.equal(execution.status, 0, `${execution.stdout}\n${execution.stderr}`);
const report = JSON.parse(fs.readFileSync(path.join(testOut, "browser_surface_sweep_report.json"), "utf8"));
const plan = JSON.parse(fs.readFileSync(path.join(testOut, "sweep_plan.json"), "utf8"));
assert.equal(report.status, "pass");
assert.equal(report.mode, "dry-run");
assert.equal(plan.summary.registryScreens, 11);
assert.equal(plan.summary.configuredViewports, 3);
assert.equal(plan.summary.matrixCases, 33);
assert.equal(plan.summary.activeCases, 33);
assert.equal(plan.summary.postponedCases, 0);
assert.equal(plan.configuredModalProbe.resultId, "tmchoice01");
assert.ok(plan.configuredEntryActionIds.includes("ACTION_FS_001_ORIGIN_WUXUE"));
assert.ok(plan.configuredEntryActionIds.includes("ACTION_FS_007_CHAPTER_CARD_ENTRY"));
assert.equal(report.acceptance.runnerConsumesRegistry, true);
assert.match(report.acceptance.failureEvidence, /screenshot.*DOM.*state.*console.*viewport/);
assert.deepEqual(report.validationScope.excludedFromVerdict, ["FIRST_SESSION_SIMULATION_LIFECYCLE"]);
const screens = [{ id: "UI_A" }, { id: "UI_B" }];
const viewports = [{ id: "phone_s" }, { id: "phone_l" }];
const incompleteRuns = [
  { viewportId: "phone_s", observedScreens: ["UI_A", "UI_B"] },
  { viewportId: "phone_l", observedScreens: ["UI_A"] },
];
assert.deepEqual([...observedSurfacePairs(incompleteRuns)].sort(), ["UI_A__phone_l", "UI_A__phone_s", "UI_B__phone_s"]);
assert.deepEqual(findSurfaceCoverageGaps(screens, viewports, incompleteRuns), [{
  caseId: "UI_B__phone_l",
  screenId: "UI_B",
  viewportId: "phone_l",
  reason: "screen_viewport_pair_not_observed",
}], "observing a screen at one viewport must not satisfy another viewport pair");
assert.deepEqual(findSurfaceCoverageGaps(screens, viewports, [
  ...incompleteRuns,
  { viewportId: "phone_l", observedScreens: ["UI_B"] },
]), [], "all four explicit pairs must close coverage");
const source = fs.readFileSync(path.join(root, "tools", "run-wuxia-browser-surface-sweep.mjs"), "utf8");
assert.doesNotMatch(source, /gameCanvas|fireTesla|bossNovaReactor|left-rail|right-rail/);
const browserRunnerSource = fs.readFileSync(path.join(root, "tools", "run-wuxia-real-browser-flow.mjs"), "utf8");
assert.match(browserRunnerSource, /WUXIA_RUNTIME_READY_TIMEOUT_MS\s*\|\|\s*"30000"/);
assert.match(browserRunnerSource, /Date\.now\(\)\s*\+\s*runtimeReadyTimeoutMs/);
console.log(`Wuxia browser surface sweep contract tests: PASS (matrix=${plan.summary.matrixCases}, active=${plan.summary.activeCases}, postponed=${plan.summary.postponedCases}, pair-scoped=true)`);
