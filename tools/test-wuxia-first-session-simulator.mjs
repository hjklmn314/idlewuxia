import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const simulatorPath = path.join(root, "tools", "simulate-wuxia-first-session-flow.mjs");
const reportPath = path.join(root, "outputs", "idlewuxia_migration", "wuxia_first_session_flow_simulation.json");

const result = spawnSync(process.execPath, [simulatorPath], {
  cwd: root,
  encoding: "utf8",
});

assert.equal(
  result.status,
  0,
  `first-session simulator must complete its configured path\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
);

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.summary?.mismatches, 0, "every configured simulation step must match its expected outcome");
assert.deepEqual(report.summary?.unexpectedRejectedActionIds, [], "golden path must not contain unexpected rejection");
assert.deepEqual(
  report.summary?.expectedRejectedActionIds,
  ["ACTION_FS_005_LOCKED_EXP_1000"],
  "the locked experience probe is the only expected rejection",
);
assert.equal(report.finalState, "STATE_FS_011_CHAPTER_LOOP_RETURN");

const ownerWingRoute = report.trace.find((entry) => entry.actionId === "ACT_CH1_SELECT_OWNER_WING");
assert.equal(ownerWingRoute?.accepted, true, "node selection must be a real runtime dispatch");
assert.equal(ownerWingRoute?.fromState, "STATE_FS_008_MAP_EXPLORE");
assert.equal(ownerWingRoute?.toState, "STATE_FS_010_NPC_INTERACTION");

console.log("first-session simulator regression: PASS");
