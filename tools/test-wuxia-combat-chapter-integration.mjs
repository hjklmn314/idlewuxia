import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const root = process.cwd();
const flow = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_flow.json"), "utf8"));
const screen = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_screen_contract.json"), "utf8"));
const combatContent = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));

let runtime = createFirstSessionRuntime(flow, {
  initialState: "STATE_FS_008_MAP_EXPLORE",
  initialFlags: ["chapter_fb01_entered"],
  combatContent,
});
assert.equal(runtime.selectChapterRoom("fb01_01").accepted, true);
assert.equal(runtime.selectChapterNpc("fb01r01_1").accepted, true);

const started = runtime.interactWithChapterNpc("fb01r01_1", "compete");
assert.equal(started.accepted, true);
assert.equal(started.snapshot.currentState, "STATE_FS_009_EARLY_COMBAT");
assert.equal(started.snapshot.pendingCombat?.runtimeMode, "manual_player_turns");
assert.equal(started.snapshot.pendingCombat?.combatOutcome, "");
assert.equal(started.snapshot.pendingCombat?.combatSnapshot?.status, "active");
assert.equal(started.snapshot.pendingCombat?.combatControl?.requiresPlayerInput, true);
assert.equal(runtime.dispatch("ACTION_FS_009_EARLY_COMBAT").accepted, false, "results cannot resolve before CombatSession has a terminal outcome");

let combatSnapshot = started.snapshot.pendingCombat?.combatSnapshot;
let actionsTaken = 0;
for (; actionsTaken < 32 && combatSnapshot?.status === "active"; actionsTaken += 1) {
  const control = runtime.snapshot().pendingCombat?.combatControl;
  assert.equal(control?.requiresPlayerInput, true, "manual combat must return control to a player turn");
  const skill = control.availableActions.skills.find((item) => item.available && item.skillId === "skill_true_point")
    || control.availableActions.skills.find((item) => item.available && item.skillId === "skill_flame_palm")
    || control.availableActions.skills.find((item) => item.available);
  assert.ok(skill, "the current player turn must expose at least one legal action");
  const targetIds = skill.targetSelection === "player_select"
    ? [skill.targetCandidates[0]?.unitId].filter(Boolean)
    : [];
  const action = runtime.submitCombatAction(control.actorId, skill.skillId, targetIds);
  assert.equal(action.accepted, true, `combat action ${skill.skillId} must apply`);
  combatSnapshot = action.snapshot.pendingCombat?.combatSnapshot;
  if (actionsTaken === 0 && combatSnapshot?.status === "active") {
    const resumed = createFirstSessionRuntime(flow, {
      initialState: "STATE_FS_008_MAP_EXPLORE",
      initialSaveState: runtime.exportSaveState(),
      combatContent,
    });
    assert.equal(resumed.snapshot().pendingCombat?.combatSnapshot?.rngState, combatSnapshot.rngState, "chapter save must preserve combat RNG state");
    assert.equal(resumed.snapshot().pendingCombat?.combatControl?.requiresPlayerInput, true, "chapter restore must preserve the next player decision");
    runtime = resumed;
  }
}
assert.ok(actionsTaken < 32, "first-session combat must terminate inside the configured simulation bound");
assert.equal(combatSnapshot?.status, "finished");
assert.ok(["victory", "defeat", "draw", "runaway"].includes(combatSnapshot?.result?.outcome), "manual play must produce an authoritative terminal outcome");
assert.ok(combatSnapshot?.events.some((event) => event.EventType === "damage"));
assert.ok(runtime.snapshot().pendingCombat?.combatPresentation?.events.length > 0);

const resolved = runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
assert.equal(resolved.accepted, true);
assert.equal(resolved.event.combatResolution?.accepted, true);
assert.equal(resolved.event.combatResolution?.combatOutcome, combatSnapshot?.result?.outcome);
assert.equal(resolved.snapshot.pendingCombat, null);

const runawayContent = JSON.parse(JSON.stringify(combatContent));
runawayContent.encounters.find((encounter) => encounter.encounterId === "encounter_first_session_old_steward").rules.runawayChance = 1;
const runawayRuntime = createFirstSessionRuntime(flow, {
  initialState: "STATE_FS_008_MAP_EXPLORE",
  initialFlags: ["chapter_fb01_entered"],
  combatContent: runawayContent,
});
runawayRuntime.selectChapterRoom("fb01_01");
runawayRuntime.selectChapterNpc("fb01r01_1");
assert.equal(runawayRuntime.interactWithChapterNpc("fb01r01_1", "compete").accepted, true);
const runawayControl = runawayRuntime.snapshot().pendingCombat?.combatControl;
assert.equal(runawayRuntime.attemptCombatRunaway("unit_old_steward").accepted, false, "only the active player unit may attempt escape");
const runaway = runawayRuntime.attemptCombatRunaway(runawayControl.actorId);
assert.equal(runaway.accepted, true);
assert.equal(runaway.snapshot.pendingCombat?.combatSnapshot?.outcome, "runaway");
assert.equal(runawayRuntime.dispatch("ACTION_FS_009_EARLY_COMBAT").accepted, true, "configured escape result must resolve through the same result branch gateway");

const report = {
  generatedAt: new Date().toISOString(),
  status: "pass",
  start: {
    currentState: started.snapshot.currentState,
    encounterId: started.snapshot.pendingCombat?.encounterId || "encounter_first_session_old_steward",
    outcome: combatSnapshot?.result?.outcome || "",
    eventCount: combatSnapshot?.events.length || 0,
    manualActions: actionsTaken,
  },
  resolution: {
    accepted: resolved.accepted,
    combatOutcome: resolved.event.combatResolution?.combatOutcome || "",
    currentState: resolved.snapshot.currentState,
  },
  runaway: {
    accepted: runaway.accepted,
    outcome: runaway.snapshot.pendingCombat?.combatSnapshot?.outcome || "",
  },
};
fs.mkdirSync(path.join(root, "outputs", "combat"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs", "combat", "combat_chapter_integration_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
