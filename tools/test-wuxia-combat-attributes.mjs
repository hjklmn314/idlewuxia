import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCombatSession } from "../src/combatSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unit(content, unitId) { return content.units.find((item) => item.unitId === unitId); }
function skill(content, skillId) { return content.skills.find((item) => item.skillId === skillId); }
function oneAction(content, skillId = "skill_basic_strike", seed = 11, encounterId = "encounter_first_session_old_steward") {
  const session = createCombatSession(content, { encounterId, seed });
  assert.equal(session.queueAction("unit_unnamed_girl", skillId).accepted, true);
  session.step();
  return session.snapshot();
}
function combatFixture() {
  const content = clone(base);
  const player = unit(content, "unit_unnamed_girl");
  const steward = unit(content, "unit_old_steward");
  player.skillIds = ["skill_basic_strike"];
  steward.skillIds = ["skill_basic_strike"];
  steward.aiPolicyId = "ai_player_safe";
  player.attributes = { ...player.attributes, speed: 100, accuracy: 1, critRating: 0, luck: 0, evasionRating: 0, blockChance: 0, penetration: 0, defensePenetration: 0, lifesteal: 0 };
  steward.attributes = { ...steward.attributes, speed: 1, evasionRating: 0, blockChance: 0, blockPower: 0, physicalResistance: 0, armor: 0, constitution: 0 };
  skill(content, "skill_basic_strike").effects[0].canGlance = false;
  return content;
}

// Derived attributes are configuration formulas, not runtime constants.
const derived = createCombatSession(combatFixture(), { encounterId: "encounter_first_session_old_steward", seed: 11 }).snapshot().units.find((item) => item.unitId === "unit_unnamed_girl");
assert.equal(derived.effectiveAttributes.maxHp, 265);
assert.equal(derived.effectiveAttributes.maxMp, 49);
assert.ok(derived.effectiveAttributes.attackPower > derived.effectiveAttributes.strength);
assert.ok(derived.effectiveAttributes.defensePower > 0);
assert.ok(derived.effectiveAttributes.initiative > 0);

// Critical hit and lifesteal are separate configured mechanics.
const critical = combatFixture();
unit(critical, "unit_unnamed_girl").attributes = { ...unit(critical, "unit_unnamed_girl").attributes, critRating: 1, lifesteal: 1 };
unit(critical, "unit_unnamed_girl").hp = 100;
const criticalSnapshot = oneAction(critical);
const criticalDamage = criticalSnapshot.events.find((event) => event.kind === "damage" && event.skillId === "skill_basic_strike");
assert.equal(criticalDamage.critical, true);
assert.ok(criticalSnapshot.events.some((event) => event.kind === "heal" && event.sourceUnitId === "unit_unnamed_girl"), "lifesteal must emit a heal event");

// Accuracy/evasion, block and resistance/penetration are resolved before HP mutation.
const miss = combatFixture();
unit(miss, "unit_unnamed_girl").attributes = { ...unit(miss, "unit_unnamed_girl").attributes, accuracy: 0.05 };
unit(miss, "unit_old_steward").attributes = { ...unit(miss, "unit_old_steward").attributes, evasionRating: 0.8 };
let missSnapshot;
for (let seed = 1; seed < 10000 && !missSnapshot?.events.some((event) => event.kind === "miss"); seed += 1) missSnapshot = oneAction(miss, "skill_basic_strike", seed);
assert.ok(missSnapshot.events.some((event) => event.kind === "miss"), "low accuracy against high evasion must be able to miss");

const blocked = combatFixture();
unit(blocked, "unit_old_steward").attributes = { ...unit(blocked, "unit_old_steward").attributes, blockChance: 1, blockPower: 0.5 };
const blockedSnapshot = oneAction(blocked);
const blockedDamage = blockedSnapshot.events.find((event) => event.kind === "damage" && event.skillId === "skill_basic_strike");
assert.equal(blockedDamage.blocked, true);
assert.ok(blockedDamage.blockedAmount > 0);
assert.ok(blockedSnapshot.events.some((event) => event.kind === "block"));

function damageWith(attributePatch) {
  const content = combatFixture();
  Object.assign(unit(content, "unit_old_steward").attributes, attributePatch);
  const snapshot = oneAction(content);
  return snapshot.events.find((event) => event.kind === "damage" && event.skillId === "skill_basic_strike").value;
}
const baselineDamage = damageWith({});
const resistantDamage = damageWith({ physicalResistance: 0.8 });
const penetrationContent = combatFixture();
unit(penetrationContent, "unit_old_steward").attributes.physicalResistance = 0.8;
unit(penetrationContent, "unit_unnamed_girl").attributes.penetration = 0.8;
const penetrationSnapshot = oneAction(penetrationContent);
const penetrationDamage = penetrationSnapshot.events.find((event) => event.kind === "damage" && event.skillId === "skill_basic_strike").value;
assert.ok(resistantDamage < baselineDamage, "resistance must reduce final damage");
assert.ok(penetrationDamage > resistantDamage, "penetration must reduce configured resistance");

const takenMultiplierContent = combatFixture();
unit(takenMultiplierContent, "unit_old_steward").attributes.damageTakenMultiplier = 0.5;
const takenDamage = oneAction(takenMultiplierContent).events.find((event) => event.kind === "damage" && event.skillId === "skill_basic_strike").value;
assert.ok(takenDamage < baselineDamage, "damageTakenMultiplier must reduce final damage");

// True damage bypasses both defense and resistance, while dead targets do not receive later effects.
const trueContent = combatFixture();
unit(trueContent, "unit_unnamed_girl").skillIds = ["skill_true_point", "skill_basic_strike"];
unit(trueContent, "unit_old_steward").hp = 1;
const trueSkill = skill(trueContent, "skill_true_point");
trueSkill.effects[0].power = { const: 9999 };
trueSkill.effects.push({ kind: "applyBuff", buffId: "buff_burning" });
const trueSnapshot = oneAction(trueContent, "skill_true_point");
const trueDamage = trueSnapshot.events.find((event) => event.kind === "damage" && event.skillId === "skill_true_point");
assert.equal(trueDamage.damageType, "true");
assert.equal(trueDamage.resistance, 0);
assert.equal(trueDamage.defenseMultiplier, 1);
assert.equal(trueSnapshot.units.find((item) => item.unitId === "unit_old_steward").alive, false);
assert.equal(trueSnapshot.units.find((item) => item.unitId === "unit_old_steward").buffs.length, 0, "dead targets must not receive later skill effects");

// Multi-target actions are atomic with respect to their declared target set.
const area = clone(base);
assert.equal(createCombatSession(area, { encounterId: "encounter_bandit_ambush", seed: 11 }).queueAction("unit_unnamed_girl", "skill_sweeping_blade", ["unit_bandit_blade"]).accepted, false);

// Result metadata must include the terminal outcome event.
const finished = createCombatSession(clone(base), { encounterId: "encounter_first_session_old_steward", seed: 190719 }).runToEnd({ maxSteps: 256 });
assert.equal(finished.result.eventCount, finished.events.length);

const report = {
  generatedAt: new Date().toISOString(),
  status: "pass",
  assertions: [
    "derived_attributes", "critical", "lifesteal", "accuracy_evasion", "block", "resistance_penetration",
    "damage_taken_multiplier", "true_damage_bypass", "dead_target_guard", "all_target_set_validation", "terminal_event_count",
  ],
};
fs.mkdirSync(path.join(root, "outputs", "combat"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs", "combat", "combat_attribute_test_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
