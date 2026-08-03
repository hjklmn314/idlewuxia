import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createCombatSession } from "../src/combatSession.js";

const root = process.cwd();
const content = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));

const session = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 190719 });
session.start();
const ready = session.advanceUntilPlayerInput();
assert.equal(ready.control.requiresPlayerInput, true, "a live encounter must stop at a real player turn");
const beforeInvalid = session.snapshot();
assert.equal(session.submitPlayerAction("unit_old_steward", "skill_steward_test_strike", []).accepted, false, "enemy actions cannot be submitted as player input");
assert.deepEqual(session.snapshot(), beforeInvalid, "wrong-actor command must be zero-mutation");

const controls = session.combatControlState();
const usable = controls.availableActions.skills.find((skill) => skill.available && skill.targetSelection === "player_select");
assert.ok(usable, "player control state must provide a legal explicit-target skill");
const invalidTarget = session.submitPlayerAction(controls.actorId, usable.skillId, [controls.actorId]);
assert.equal(invalidTarget.accepted, false, "an illegal target must reject before the turn is consumed");
assert.equal(invalidTarget.reason, "invalid_target");
assert.deepEqual(session.snapshot(), beforeInvalid, "invalid target must be zero-mutation");

const selectedTarget = usable.targetCandidates[0]?.unitId;
assert.ok(selectedTarget, "explicit-target action must expose a legal target candidate");
const applied = session.submitPlayerAction(controls.actorId, usable.skillId, [selectedTarget]);
assert.equal(applied.accepted, true);
assert.ok(applied.snapshot.events.some((event) => event.skillId === usable.skillId), "accepted command must emit its configured skill event");
assert.ok(applied.snapshot.events.some((event) => event.sourceUnitId === "unit_old_steward"), "enemy turn must be resolved before the next player decision");

const resumed = createCombatSession(content, {
  encounterId: "encounter_first_session_old_steward",
  runtimeSnapshot: applied.snapshot,
});
assert.deepEqual(resumed.snapshot(), applied.snapshot, "runtime snapshot must reproduce the exact resume state");
const resumedControl = resumed.combatControlState();
if (resumedControl.requiresPlayerInput) {
  const next = resumedControl.availableActions.skills.find((skill) => skill.available);
  assert.ok(next, "resumed player turn must retain legal actions");
  const targetIds = next.targetSelection === "player_select" ? [next.targetCandidates[0]?.unitId].filter(Boolean) : [];
  assert.equal(resumed.submitPlayerAction(resumedControl.actorId, next.skillId, targetIds).accepted, true, "resumed action must continue the same fight");
}

const rootedContent = structuredClone(content);
const rootedEnemy = rootedContent.units.find((unit) => unit.unitId === "unit_old_steward");
rootedEnemy.attributes.speed = 999;
rootedEnemy.skillIds = ["skill_trap_root"];
const rootedSession = createCombatSession(rootedContent, { encounterId: "encounter_first_session_old_steward", seed: 42 });
rootedSession.start();
const rootedReady = rootedSession.advanceUntilPlayerInput();
assert.equal(rootedReady.control.requiresPlayerInput, true, "root must not turn a player-owned skill turn into AI control");
assert.equal(rootedReady.control.rooted, true, "configured root must be visible in combat control state");
assert.equal(rootedSession.attemptRunaway(rootedReady.control.actorId).reason, "rooted", "root must block only the configured movement/escape action");
const rootedSkill = rootedReady.control.availableActions.skills.find((skill) => skill.available && skill.targetSelection === "player_select");
assert.ok(rootedSkill, "a rooted player must still have a legal skill action");
assert.equal(rootedSession.submitPlayerAction(rootedReady.control.actorId, rootedSkill.skillId, [rootedSkill.targetCandidates[0].unitId]).accepted, true, "root must not block a legal configured skill action");

console.log("combat player turn tests: PASS (manual input + rejection + deterministic resume + root semantics)");
