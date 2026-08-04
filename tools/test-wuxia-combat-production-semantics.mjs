import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createCombatSession, validateCombatContent } from "../src/combatSession.js";

const root = process.cwd();
const base = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));
const clone = (value) => structuredClone(value);

function playerFirstSession(content = base, encounterId = "encounter_first_session_old_steward", seed = 41) {
  const prepared = clone(content);
  prepared.units.find((unit) => unit.unitId === "unit_unnamed_girl").attributes.speed = 999;
  for (const unit of prepared.units.filter((unit) => unit.unitId !== "unit_unnamed_girl")) unit.attributes.speed = 0;
  const session = createCombatSession(prepared, { encounterId, seed });
  session.start();
  session.advanceUntilPlayerInput();
  assert.equal(session.currentTurn().actorId, "unit_unnamed_girl");
  return session;
}

// Derived formulas must consume modified base attributes. Otherwise a haste
// buff is visibly present while initiative remains unchanged.
const hasteContent = clone(base);
hasteContent.units.find((unit) => unit.unitId === "unit_unnamed_girl").skillIds.push("skill_smoke_step");
const haste = playerFirstSession(hasteContent);
const beforeHaste = haste.snapshot().units.find((unit) => unit.unitId === "unit_unnamed_girl").effectiveAttributes.initiative;
const hasteResult = haste.submitPlayerAction("unit_unnamed_girl", "skill_smoke_step", []);
assert.equal(hasteResult.accepted, true);
const hastedUnit = hasteResult.snapshot.units.find((unit) => unit.unitId === "unit_unnamed_girl");
assert.ok(hastedUnit.effectiveAttributes.initiative > beforeHaste, "haste must flow through the configured initiative formula");
assert.equal(hastedUnit.buffs.find((buff) => buff.buffId === "buff_haste")?.duration, 2, "a self-applied duration-2 buff must not lose a turn on the cast frame");

// Authored cooldown is the number of future owner turns that remain blocked.
const cooldown = playerFirstSession();
const guardResult = cooldown.submitPlayerAction("unit_unnamed_girl", "skill_guard", []);
assert.equal(guardResult.accepted, true);
const guarded = guardResult.snapshot.units.find((unit) => unit.unitId === "unit_unnamed_girl");
assert.equal(guarded.cooldowns.skill_guard, 2, "cooldown 2 must expose two remaining owner turns after resolution");
assert.equal(guarded.buffs.find((buff) => buff.buffId === "buff_guarded")?.duration, 2, "guard must retain its full configured duration after its cast turn");

// Positive self-control semantics such as taunt must not be rejected by a
// generic control-immunity buff.
const immunitySeed = playerFirstSession();
const immunitySnapshot = immunitySeed.snapshot();
const immunityPlayer = immunitySnapshot.units.find((unit) => unit.unitId === "unit_unnamed_girl");
immunityPlayer.buffs.push({ buffId: "buff_control_immunity", name: "定神", iconLabel: "定", stacks: 1, duration: 2, tags: ["positive", "immunity"], sourceUnitId: immunityPlayer.unitId });
const immunity = createCombatSession(clone(base), { encounterId: immunitySnapshot.encounterId, runtimeSnapshot: immunitySnapshot });
const tauntSelf = immunity.submitPlayerAction("unit_unnamed_girl", "skill_taunt", []);
assert.equal(tauntSelf.accepted, true);
assert.ok(tauntSelf.snapshot.units.find((unit) => unit.unitId === "unit_unnamed_girl").buffs.some((buff) => buff.buffId === "buff_taunt"), "positive taunt must coexist with control immunity");
assert.equal(tauntSelf.snapshot.events.some((event) => event.kind === "buffImmune" && event.buffId === "buff_taunt"), false);

// Taunt must constrain both runtime-selected and explicit player targets.
const tauntSeed = createCombatSession(clone(base), { encounterId: "encounter_bandit_ambush", seed: 41 });
tauntSeed.start();
const tauntSnapshot = tauntSeed.snapshot();
tauntSnapshot.turnOrder = ["unit_unnamed_girl", "unit_bandit_blade", "unit_old_steward"];
tauntSnapshot.turnIndex = 0;
tauntSnapshot.units.find((unit) => unit.unitId === "unit_bandit_blade").buffs.push({ buffId: "buff_taunt", name: "挑衅", iconLabel: "挑", stacks: 1, duration: 2, tags: ["positive", "control"], sourceUnitId: "unit_bandit_blade" });
const taunted = createCombatSession(clone(base), { encounterId: "encounter_bandit_ambush", runtimeSnapshot: tauntSnapshot });
const basic = taunted.availableActions("unit_unnamed_girl").skills.find((skill) => skill.skillId === "skill_basic_strike");
assert.deepEqual(basic.targetCandidates.map((target) => target.unitId), ["unit_bandit_blade"], "explicit target UI must expose only active taunters");
const bypass = taunted.submitPlayerAction("unit_unnamed_girl", "skill_basic_strike", ["unit_old_steward"]);
assert.equal(bypass.accepted, false);
assert.equal(bypass.reason, "taunt_target_required");

// Stack-policy semantics are authored. A two-stack poison tick must be twice
// the one-stack tick under `stackScaling: multiply`.
function poisonTick(stacks) {
  const seed = createCombatSession(clone(base), { encounterId: "encounter_first_session_old_steward", seed: 77 });
  seed.start();
  const snapshot = seed.snapshot();
  snapshot.turnOrder = ["unit_unnamed_girl", "unit_old_steward"];
  snapshot.turnIndex = 0;
  snapshot.units.find((unit) => unit.unitId === "unit_unnamed_girl").buffs.push({ buffId: "buff_poisoned", name: "中毒", iconLabel: "毒", stacks, duration: 3, tags: ["negative", "damageOverTime"], sourceUnitId: "unit_old_steward" });
  const session = createCombatSession(clone(base), { encounterId: snapshot.encounterId, runtimeSnapshot: snapshot });
  session.step({ skillId: "skill_basic_strike", targetIds: ["unit_old_steward"] });
  return session.snapshot().events.find((event) => event.kind === "damage" && event.damageType === "poison")?.value || 0;
}
const oneStack = poisonTick(1);
const twoStacks = poisonTick(2);
assert.ok(oneStack > 0);
assert.equal(twoStacks, oneStack * 2, "periodic stack multiplier must affect actual HP damage");

// Missing formula authorities and invalid AI references must fail before a
// runtime session can silently degrade them to zero/fallback behavior.
const badFormula = clone(base);
badFormula.skills.find((skill) => skill.skillId === "skill_basic_strike").effects[0].power = { ref: "missingProductionAttribute" };
assert.equal(validateCombatContent(badFormula).accepted, false);
assert.throws(() => createCombatSession(badFormula), /Invalid combat content/);
const badAi = clone(base);
badAi.units.find((unit) => unit.unitId === "unit_old_steward").aiPolicyId = "missing_ai_policy";
assert.equal(validateCombatContent(badAi).accepted, false);

const snapshotAuthority = playerFirstSession().snapshot();
const duplicateUnitSnapshot = clone(snapshotAuthority);
duplicateUnitSnapshot.units.push(clone(duplicateUnitSnapshot.units[0]));
assert.throws(() => createCombatSession(clone(base), { encounterId: snapshotAuthority.encounterId, runtimeSnapshot: duplicateUnitSnapshot }), /unit count or identity mismatch/);
const invalidBuffSnapshot = clone(snapshotAuthority);
invalidBuffSnapshot.units[0].buffs.push({ buffId: "missing_buff", stacks: 1, duration: 1, sourceUnitId: invalidBuffSnapshot.units[0].unitId });
assert.throws(() => createCombatSession(clone(base), { encounterId: snapshotAuthority.encounterId, runtimeSnapshot: invalidBuffSnapshot }), /buff invalid/);
const invalidQueueSnapshot = clone(snapshotAuthority);
invalidQueueSnapshot.actionQueue.unit_unnamed_girl = [{ skillId: "skill_not_equipped", targetIds: [] }];
assert.throws(() => createCombatSession(clone(base), { encounterId: snapshotAuthority.encounterId, runtimeSnapshot: invalidQueueSnapshot }), /queued action invalid/);

console.log("combat production semantics tests: PASS (derived modifiers + duration + cooldown + immunity + taunt + periodic stacks + fail-closed config/snapshot validation)");
