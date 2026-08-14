import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createCombatSession, validateCombatContent } from "../src/combatSession.js";

const root = process.cwd();
const base = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));
const clone = (value) => structuredClone(value);

function playerFirst(content = base, encounterId = "encounter_first_session_old_steward", seed = 20260814) {
  const prepared = clone(content);
  const encounter = prepared.encounters.find((item) => item.encounterId === encounterId);
  for (const unitId of encounter.playerUnitIds) prepared.units.find((unit) => unit.unitId === unitId).attributes.speed = 999;
  for (const unitId of encounter.enemyUnitIds) prepared.units.find((unit) => unit.unitId === unitId).attributes.speed = 0;
  const session = createCombatSession(prepared, { encounterId, seed });
  session.start();
  session.advanceUntilPlayerInput();
  assert.equal(session.currentTurn().requiresPlayerInput, true);
  return { prepared, session };
}

// Player-selected selectors require exactly one explicit legal target. Runtime-
// selected selectors must not accept a caller-supplied override.
const explicitTarget = playerFirst();
const beforeMissingTarget = explicitTarget.session.snapshot();
const missingTarget = explicitTarget.session.submitPlayerAction("unit_unnamed_girl", "skill_basic_strike", []);
assert.equal(missingTarget.accepted, false);
assert.equal(missingTarget.reason, "target_required");
assert.deepEqual(explicitTarget.session.snapshot(), beforeMissingTarget, "missing player target must be zero-mutation");

const runtimeTarget = playerFirst(base, "encounter_bandit_ambush");
const beforeOverride = runtimeTarget.session.snapshot();
const randomOverride = runtimeTarget.session.submitPlayerAction("unit_unnamed_girl", "skill_random_needle", ["unit_old_steward"]);
assert.equal(randomOverride.accepted, false);
assert.equal(randomOverride.reason, "runtime_target_override_forbidden");
assert.deepEqual(runtimeTarget.session.snapshot(), beforeOverride, "random target override must be zero-mutation");
const lowestOverride = runtimeTarget.session.submitPlayerAction("unit_unnamed_girl", "skill_meridian_transfer", ["unit_unnamed_girl"]);
assert.equal(lowestOverride.accepted, false);
assert.equal(lowestOverride.reason, "runtime_target_override_forbidden");
assert.deepEqual(runtimeTarget.session.snapshot(), beforeOverride, "lowest-HP target override must be zero-mutation");

// Taunt constrains runtime-owned random targeting as well as explicit targeting.
const tauntSeed = runtimeTarget.session.snapshot();
tauntSeed.units.find((unit) => unit.unitId === "unit_bandit_blade").buffs.push({
  buffId: "buff_taunt",
  name: "挑衅",
  iconLabel: "挑",
  stacks: 1,
  duration: 2,
  tags: ["positive", "control"],
  sourceUnitId: "unit_bandit_blade",
});
const taunted = createCombatSession(runtimeTarget.prepared, { encounterId: tauntSeed.encounterId, runtimeSnapshot: tauntSeed });
const randomAction = taunted.submitPlayerAction("unit_unnamed_girl", "skill_random_needle", []);
assert.equal(randomAction.accepted, true);
const randomTargets = randomAction.snapshot.events
  .filter((event) => event.skillId === "skill_random_needle" && event.targetUnitId)
  .map((event) => event.targetUnitId);
assert.ok(randomTargets.length > 0);
assert.deepEqual([...new Set(randomTargets)], ["unit_bandit_blade"], "taunt must constrain configured random targeting");

// A seeded initiative tie break must consume a fixed random sequence and be
// reproducible without relying on engine-specific Array.sort comparator calls.
const tieContent = clone(base);
for (const unit of tieContent.units) unit.attributes.speed = 10;
const tieA = createCombatSession(tieContent, { encounterId: "encounter_bandit_ambush", seed: 314159 });
const tieB = createCombatSession(tieContent, { encounterId: "encounter_bandit_ambush", seed: 314159 });
tieA.start();
tieB.start();
assert.deepEqual(tieA.snapshot().turnOrder, tieB.snapshot().turnOrder);
assert.equal(tieA.snapshot().rngState, tieB.snapshot().rngState);

// AI weights are numeric configuration. Explicit zero means zero probability;
// omitted skills use the policy's declared defaultWeight without array expansion.
const aiContent = clone(base);
const steward = aiContent.units.find((unit) => unit.unitId === "unit_old_steward");
steward.attributes.speed = 999;
aiContent.units.find((unit) => unit.unitId === "unit_unnamed_girl").attributes.speed = 0;
const balanced = aiContent.aiPolicies.find((policy) => policy.aiPolicyId === "ai_balanced");
balanced.defaultWeight = 0;
balanced.weights = Object.fromEntries(steward.skillIds.map((skillId) => [skillId, skillId === "skill_guard" ? 1 : 0]));
const ai = createCombatSession(aiContent, { encounterId: "encounter_first_session_old_steward", seed: 99 });
ai.start();
const aiStep = ai.step();
assert.equal(aiStep.actorId, "unit_old_steward");
assert.equal(aiStep.action.skillId, "skill_guard", "zero-weight AI skills must never be selected");

// Runtime semantic validation is an authority boundary even when a caller does
// not run the standalone JSON Schema tool first.
for (const mutate of [
  (content) => { delete content.rules.turnOrder; },
  (content) => { content.rules.turnOrder = "host_sort_order"; },
  (content) => { delete content.aiPolicies[0].defaultWeight; },
  (content) => { content.skills[0].effects = []; },
  (content) => { delete content.skills[0].effects[0].kind; },
  (content) => { delete content.skills[0].effects[0].power; },
]) {
  const invalid = clone(base);
  mutate(invalid);
  assert.equal(validateCombatContent(invalid).accepted, false);
  assert.throws(() => createCombatSession(invalid), /Invalid combat content/);
}

// Persisted snapshots fail closed instead of normalizing corrupt HP/alive/order
// or oversized event/command collections into a different battle.
const authority = playerFirst().session.snapshot();
const corruptSnapshots = [
  (() => { const value = clone(authority); value.units[0].hp = value.units[0].hpMax + 1; return value; })(),
  (() => { const value = clone(authority); value.units[0].alive = false; return value; })(),
  (() => { const value = clone(authority); value.turnOrder = value.turnOrder.filter((unitId) => unitId !== "unit_old_steward"); return value; })(),
  (() => { const value = clone(authority); value.events = Array.from({ length: base.rules.maxEvents + 1 }, (_, seq) => ({ seq, timeMs: seq, kind: "probe" })); return value; })(),
  (() => { const value = clone(authority); value.commandLog = Array.from({ length: base.rules.replay.maxCommands + 1 }, (_, seq) => ({ seq, kind: "pause" })); return value; })(),
];
for (const snapshot of corruptSnapshots) {
  assert.throws(() => createCombatSession(clone(base), { encounterId: snapshot.encounterId, runtimeSnapshot: snapshot }), /combat snapshot/);
}

console.log("combat authority hardening tests: PASS (target ownership + seeded order + zero weights + runtime validation + strict snapshots)");
