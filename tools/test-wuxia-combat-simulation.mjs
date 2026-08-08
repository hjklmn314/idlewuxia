import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "outputs", "combat_simulation", "combat_simulation_report.json");
if (!fs.existsSync(reportPath)) throw new Error("combat simulation report is missing; run npm run runtime:combat-simulation first");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.schema, "idlewuxia.combat_simulation_report.v1");
assert.equal(report.sharedRuntime, true, "simulation must use the runtime interpreter");
assert.equal(report.accepted, true, "all configured balance limits must pass");
assert.ok(report.reports.length >= 2, "at least two configured balance scenarios are required");
for (const scenario of report.reports) {
  assert.ok(Array.isArray(scenario.runs) && scenario.runs.length >= 10);
  assert.equal(scenario.balancePass, true);
  assert.ok(scenario.runs.every((run) => typeof run.replayId === "string" && run.replayId.startsWith("replay-")));
}
console.log("combat simulation tests: PASS (shared runtime + configured scenarios + balance limits)");
