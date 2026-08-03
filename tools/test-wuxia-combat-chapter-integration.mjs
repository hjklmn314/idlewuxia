import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const root = process.cwd();
const flow = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_flow.json"), "utf8"));
const screen = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_screen_contract.json"), "utf8"));
const combatContent = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));

const runtime = createFirstSessionRuntime(flow, {
  initialState: "STATE_FS_008_MAP_EXPLORE",
  initialFlags: ["chapter_fb01_entered"],
  combatContent,
});
assert.equal(runtime.selectChapterRoom("fb01_01").accepted, true);
assert.equal(runtime.selectChapterNpc("fb01r01_1").accepted, true);

const started = runtime.interactWithChapterNpc("fb01r01_1", "compete");
assert.equal(started.accepted, true);
assert.equal(started.snapshot.currentState, "STATE_FS_009_EARLY_COMBAT");
assert.equal(started.snapshot.pendingCombat?.combatOutcome, "victory");
assert.equal(started.snapshot.pendingCombat?.combatSnapshot?.status, "finished");
assert.ok(started.snapshot.pendingCombat?.combatSnapshot?.events.some((event) => event.EventType === "damage"));
assert.ok(started.snapshot.pendingCombat?.combatPresentation?.events.length > 0);

const resolved = runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
assert.equal(resolved.accepted, true);
assert.equal(resolved.event.combatResolution?.accepted, true);
assert.equal(resolved.event.combatResolution?.combatOutcome, "victory");
assert.equal(resolved.snapshot.pendingCombat, null);

const report = {
  generatedAt: new Date().toISOString(),
  status: "pass",
  start: {
    currentState: started.snapshot.currentState,
    encounterId: started.snapshot.pendingCombat?.encounterId || "encounter_first_session_old_steward",
    outcome: started.snapshot.pendingCombat?.combatOutcome,
    eventCount: started.snapshot.pendingCombat?.combatSnapshot?.events.length || 0,
  },
  resolution: {
    accepted: resolved.accepted,
    combatOutcome: resolved.event.combatResolution?.combatOutcome || "",
    currentState: resolved.snapshot.currentState,
  },
};
fs.mkdirSync(path.join(root, "outputs", "combat"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs", "combat", "combat_chapter_integration_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
