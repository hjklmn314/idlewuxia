import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCombatSession, validateCombatContent } from "../src/combatSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));
const validation = validateCombatContent(content);
assert.equal(validation.accepted, true, JSON.stringify(validation.findings));

function run(encounterId, seed = 1) {
  const session = createCombatSession(content, { encounterId, seed });
  const snapshot = session.runToEnd({ maxSteps: 256 });
  assert.equal(snapshot.status, "finished");
  assert.ok(["victory", "defeat", "draw"].includes(snapshot.outcome));
  assert.ok(snapshot.events.some((event) => event.EventType === "damage"));
  assert.ok(snapshot.events.every((event) => typeof event.TimeSeconds === "number" && typeof event.EventType === "string"));
  return { session, snapshot };
}

const first = run("encounter_first_session_old_steward", 190719);
assert.equal(first.snapshot.outcome, "victory");
assert.ok(first.snapshot.events.some((event) => event.kind === "skill"));
assert.ok(first.snapshot.events.some((event) => event.kind === "defeat"));
assert.ok(first.snapshot.events.some((event) => event.kind === "damage" && event.AudioCueId === "sfx_hit"));

const ambush = run("encounter_bandit_ambush", 190720);
assert.ok(ambush.snapshot.events.some((event) => ["buff", "debuff", "heal", "shield", "miss", "block"].includes(event.kind)), "combat must expose non-damage feedback when the encounter uses it");

const forced = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 7 });
assert.equal(forced.queueAction("unit_unnamed_girl", "skill_flame_palm").accepted, true);
assert.equal(forced.queueAction("unit_unnamed_girl", "skill_healing_breath").accepted, true);
assert.equal(forced.queueAction("unit_unnamed_girl", "skill_pressure_point").accepted, true);
assert.equal(forced.queueAction("unit_unnamed_girl", "skill_iron_wall").accepted, true);
assert.equal(forced.queueAction("unit_unnamed_girl", "skill_guard").accepted, true);
for (let index = 0; index < 12 && forced.snapshot().status !== "finished"; index += 1) forced.step();
const forcedEvents = forced.snapshot().events;
assert.ok(forcedEvents.some((event) => event.kind === "debuff" || event.kind === "buff"));
assert.ok(forcedEvents.some((event) => event.kind === "shield" || event.kind === "heal"));

const mirror = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 1 });
mirror.queueAction("unit_unnamed_girl", "skill_basic_strike");
mirror.queueAction("unit_old_steward", "skill_reflecting_mirror");
mirror.queueAction("unit_unnamed_girl", "skill_basic_strike");
for (let index = 0; index < 6 && mirror.snapshot().status !== "finished"; index += 1) mirror.step();
assert.ok(mirror.snapshot().events.some((event) => event.buffId === "buff_mirror"));
assert.ok(mirror.snapshot().events.some((event) => event.kind === "damage" && event.sourceUnitId === "unit_old_steward" && event.targetUnitId === "unit_unnamed_girl"), "reflect must create a damage event back to the attacker");

const control = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 1 });
control.queueAction("unit_unnamed_girl", "skill_flame_palm");
control.queueAction("unit_unnamed_girl", "skill_guard");
control.queueAction("unit_old_steward", "skill_silencing_needle");
for (let index = 0; index < 8 && control.snapshot().status !== "finished"; index += 1) control.step();
assert.ok(control.snapshot().events.some((event) => event.buffId === "buff_silenced"));
assert.ok(control.snapshot().events.some((event) => event.kind === "actionRejected" && event.warningCode === "silenced"));

const rooted = createCombatSession(content, { encounterId: "encounter_bandit_ambush", seed: 1 });
rooted.queueAction("unit_bandit_blade", "skill_trap_root");
rooted.queueAction("unit_unnamed_girl", "skill_basic_strike");
for (let index = 0; index < 10 && rooted.snapshot().status !== "finished"; index += 1) rooted.step();
assert.ok(rooted.snapshot().events.some((event) => event.buffId === "buff_rooted"));
assert.equal(rooted.snapshot().events.some((event) => event.kind === "stunned" && event.targetUnitId === "unit_unnamed_girl"), false, "root is movement control and must not skip a configured skill turn");
assert.ok(rooted.snapshot().events.some((event) => event.kind === "skill" && event.sourceUnitId === "unit_unnamed_girl"), "a rooted actor must still execute a queued skill");

const statModifier = createCombatSession(content, { encounterId: "encounter_bandit_ambush", seed: 1 });
statModifier.queueAction("unit_bandit_blade", "skill_blood_fury");
for (let index = 0; index < 5 && statModifier.snapshot().status !== "finished"; index += 1) statModifier.step();
assert.ok(statModifier.snapshot().events.some((event) => event.kind === "statModifier" && event.cueId === "cue_blood_fury"));

const truePoint = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 11 });
assert.equal(truePoint.availableActions("unit_unnamed_girl").skills.some((skill) => skill.skillId === "skill_true_point"), true);
assert.equal(truePoint.queueAction("unit_unnamed_girl", "skill_true_point").accepted, true);
truePoint.step();
const trueDamage = truePoint.snapshot().events.find((event) => event.kind === "damage" && event.skillId === "skill_true_point");
assert.ok(trueDamage, "true damage skill must resolve");
assert.equal(trueDamage.damageType, "true");
assert.equal(trueDamage.resistance, 0, "true damage bypasses resistance");
assert.equal(trueDamage.defenseMultiplier, 1, "true damage bypasses defense");

const area = createCombatSession(content, { encounterId: "encounter_bandit_ambush", seed: 11 });
assert.equal(area.queueAction("unit_unnamed_girl", "skill_sweeping_blade").accepted, true);
for (let index = 0; index < 4 && !area.snapshot().events.some((event) => event.skillId === "skill_sweeping_blade"); index += 1) area.step();
const areaDamage = area.snapshot().events.filter((event) => event.kind === "damage" && event.skillId === "skill_sweeping_blade");
assert.equal(areaDamage.length, 2, "all_enemies must resolve once per living enemy");

const shared = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 11 });
assert.equal(shared.queueAction("unit_unnamed_girl", "skill_shared_breath").accepted, true);
for (let index = 0; index < 4 && !shared.snapshot().events.some((event) => event.skillId === "skill_shared_breath"); index += 1) shared.step();
assert.ok(shared.snapshot().events.some((event) => event.kind === "heal" && event.skillId === "skill_shared_breath"), "all_allies must resolve for the actor's faction");

const lowestAlly = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 11 });
const beforeLowestMp = lowestAlly.snapshot().units.find((unit) => unit.unitId === "unit_unnamed_girl").mp;
assert.equal(lowestAlly.queueAction("unit_unnamed_girl", "skill_meridian_transfer").accepted, true);
for (let index = 0; index < 4 && !lowestAlly.snapshot().events.some((event) => event.skillId === "skill_meridian_transfer"); index += 1) lowestAlly.step();
assert.ok(lowestAlly.snapshot().events.some((event) => event.kind === "heal" && event.skillId === "skill_meridian_transfer"), "lowest_hp_ally must resolve through the configured target selector");
assert.ok(lowestAlly.snapshot().events.some((event) => event.kind === "resource" && event.skillId === "skill_meridian_transfer"), "compound heal/resource skill must resolve every configured effect");
assert.ok(lowestAlly.snapshot().units.find((unit) => unit.unitId === "unit_unnamed_girl").mp < beforeLowestMp, "configured skill cost must be consumed");

const transactional = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 11 });
const beforeRejected = transactional.snapshot().units.find((unit) => unit.unitId === "unit_unnamed_girl");
const rejectedTarget = transactional.queueAction("unit_unnamed_girl", "skill_flame_palm", ["unit_unnamed_girl"]);
assert.equal(rejectedTarget.accepted, false, "an enemy-target skill must reject an ally target before queuing");
assert.equal(transactional.queueAction("unit_unnamed_girl", "skill_iron_wall", ["unit_old_steward"]).accepted, false, "a self-target skill must reject an enemy target");
assert.equal(transactional.queueAction("unit_old_steward", "skill_flame_palm").accepted, false, "a skill not equipped by a unit must not be accepted");
assert.equal(transactional.snapshot().units.find((unit) => unit.unitId === "unit_unnamed_girl").mp, beforeRejected.mp, "rejected queued actions must not spend resources");

const taunt = createCombatSession(content, { encounterId: "encounter_first_session_old_steward", seed: 11 });
assert.equal(taunt.queueAction("unit_old_steward", "skill_taunt").accepted, true);
for (let index = 0; index < 4 && taunt.snapshot().status !== "finished"; index += 1) taunt.step();
assert.ok(taunt.snapshot().events.some((event) => event.buffId === "buff_taunt"), "taunt buff must apply");

const runawayContent = JSON.parse(JSON.stringify(content));
runawayContent.encounters.find((encounter) => encounter.encounterId === "encounter_first_session_old_steward").rules.runawayChance = 1;
const runaway = createCombatSession(runawayContent, { encounterId: "encounter_first_session_old_steward", seed: 11 });
const runawayResult = runaway.attemptRunaway("unit_unnamed_girl");
assert.equal(runawayResult.accepted, true);
assert.equal(runawayResult.outcome, "runaway");

const contentCoverage = {
  skills: [...new Set(content.skills.map((skill) => skill.kind))],
  effects: [...new Set(content.skills.flatMap((skill) => skill.effects.flatMap((effect) => [effect.kind, ...(effect.effects || []).map((nested) => nested.kind)])))],
  targets: [...new Set(content.skills.map((skill) => skill.target))],
  buffPolicies: [...new Set(content.buffs.map((buff) => buff.stackPolicy))],
  buffControls: [...new Set(content.buffs.map((buff) => buff.control).filter(Boolean))],
  damageTypes: [...new Set(content.skills.flatMap((skill) => skill.effects.flatMap((effect) => [effect.damageType, ...(effect.effects || []).map((nested) => nested.damageType)]).filter(Boolean)))],
};
assert.ok(contentCoverage.targets.includes("all_enemies"));
assert.ok(contentCoverage.targets.includes("all_allies"));
assert.ok(contentCoverage.damageTypes.includes("true"));
assert.ok(contentCoverage.damageTypes.includes("ice"));
assert.ok(contentCoverage.buffControls.includes("taunt"));

const presentation = first.session.presentation({ previewId: "test_combat" });
assert.equal(presentation.previewId, "test_combat");
assert.ok(presentation.units.left && presentation.units.right);
assert.ok(presentation.events.length >= 1);
assert.ok(presentation.events.some((event) => event.audioCueId === "sfx_hit"));

const report = {
  generatedAt: new Date().toISOString(),
  validation,
  scenarios: {
    firstSession: { outcome: first.snapshot.outcome, rounds: first.snapshot.round, events: first.snapshot.events.length },
    ambush: { outcome: ambush.snapshot.outcome, rounds: ambush.snapshot.round, events: ambush.snapshot.events.length },
    forcedEffects: { events: forcedEvents.length, hasBuffOrDebuff: forcedEvents.some((event) => ["buff", "debuff"].includes(event.kind)), hasHealOrShield: forcedEvents.some((event) => ["heal", "shield"].includes(event.kind)) },
    advancedMechanics: {
      reflect: true,
      silence: true,
      root: true,
      statModifier: true,
      trueDamage: true,
      areaTargeting: true,
      allyTargeting: true,
      taunt: true,
      runaway: true,
    },
  },
  presentation: { events: presentation.events.length, left: presentation.units.left.name, right: presentation.units.right.name },
  contentCoverage,
};
fs.mkdirSync(path.join(root, "outputs", "combat"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs", "combat", "combat_session_test_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
