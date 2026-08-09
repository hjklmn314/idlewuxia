import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";
import { interpolateRuntimeText } from "../src/runtimeTextInterpolation.js";

const root = process.cwd();
const sourceFlow = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_flow.json"), "utf8"));
const sourceCombat = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));
const fixtureRoomId = "fb01_15";
const textInterpolationPolicy = sourceFlow.chapterSystem.resultEffectPolicies.runtimeMutation.textInterpolation;

assert.equal(interpolateRuntimeText("$IN/$S/$N", {
  policy: textInterpolationPolicy,
  player: { name: "无名少女", inheritance: { name: "阿青", sex: "女" } },
}), "阿青/她/无名少女");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function contractWithNpc(roleId) {
  const contract = clone(sourceFlow);
  const room = contract.chapter1.rooms.find((candidate) => candidate.roomId === fixtureRoomId);
  assert.ok(room, "fixture room must exist");
  room.encounterIds = [...new Set([...(room.encounterIds || []), roleId])];
  return contract;
}

function contentForOutcome(encounterId, desiredOutcome) {
  const content = clone(sourceCombat);
  const encounter = content.encounters.find((candidate) => candidate.encounterId === encounterId);
  assert.ok(encounter, `encounter ${encounterId} must exist`);
  const player = content.units.find((unit) => unit.unitId === encounter.playerUnitIds[0]);
  const enemies = content.units.filter((unit) => encounter.enemyUnitIds.includes(unit.unitId));
  assert.ok(player && enemies.length, `encounter ${encounterId} must bind player and enemy units`);
  if (desiredOutcome === "victory") {
    Object.assign(player.attributes, {
      vitality: 100,
      spirit: 50,
      strength: 90,
      constitution: 40,
      speed: 100,
      skillPower: 80,
      accuracy: 1,
      critRating: 0,
    });
    for (const enemy of enemies) {
      Object.assign(enemy.attributes, {
        vitality: 1,
        spirit: 1,
        strength: 1,
        constitution: 0,
        speed: 1,
        skillPower: 0,
        armor: 0,
        accuracy: 0,
        evasionRating: 0,
      });
    }
  } else if (desiredOutcome === "defeat") {
    Object.assign(player.attributes, {
      vitality: 1,
      spirit: 1,
      strength: 1,
      constitution: 0,
      speed: 1,
      skillPower: 0,
      armor: 0,
      accuracy: 0,
      evasionRating: 0,
    });
    for (const enemy of enemies) {
      Object.assign(enemy.attributes, {
        vitality: 100,
        spirit: 40,
        strength: 100,
        constitution: 40,
        speed: 100,
        skillPower: 60,
        armor: 20,
        accuracy: 1,
        critRating: 0,
      });
    }
  } else if (desiredOutcome === "runaway") {
    encounter.rules.runawayChance = 1;
  }
  return content;
}

function createRuntime({
  roleId,
  encounterId,
  desiredOutcome = "victory",
  flow = null,
  inventory = {},
  inheritance = { name: "阿青", sex: "女" },
}) {
  const contract = flow || contractWithNpc(roleId);
  const combatContent = contentForOutcome(encounterId, desiredOutcome);
  const runtime = createFirstSessionRuntime(contract, {
    initialState: "STATE_FS_008_MAP_EXPLORE",
    initialFlags: ["chapter_fb01_entered"],
    initialPlayer: {
      ...clone(contract.playerSeed),
      inventory: { ...(contract.playerSeed?.inventory || {}), ...inventory },
      inheritance: clone(inheritance),
    },
    combatContent,
  });
  assert.equal(runtime.selectChapterRoom(fixtureRoomId).accepted, true);
  assert.equal(runtime.selectChapterNpc(roleId).accepted, true);
  return { runtime, contract, combatContent };
}

function finishVictory(runtime, { restore = null, resolve = true } = {}) {
  let activeRuntime = runtime;
  if (restore) {
    activeRuntime = createFirstSessionRuntime(restore.contract, {
      initialSaveState: runtime.exportSaveState(),
      combatContent: restore.combatContent,
    });
    assert.equal(activeRuntime.snapshot().pendingCombat?.triggerResultId, runtime.snapshot().pendingCombat?.triggerResultId);
    assert.deepEqual(activeRuntime.snapshot().pendingCombat?.outcomeResultTokens, runtime.snapshot().pendingCombat?.outcomeResultTokens);
  }
  let pending = activeRuntime.snapshot().pendingCombat;
  let playerCommands = 0;
  while (pending?.combatSnapshot?.status === "active" && playerCommands < 16) {
    const control = pending.combatControl;
    assert.equal(control?.requiresPlayerInput, true, "combat must stop at a real player decision");
    const skill = control.availableActions.skills.find((candidate) => candidate.available && candidate.skillId === "skill_true_point")
      || control.availableActions.skills.find((candidate) => candidate.available);
    assert.ok(skill, "player must have a legal configured combat action");
    const targetIds = skill.targetSelection === "player_select"
      ? [skill.targetCandidates[0]?.unitId].filter(Boolean)
      : [];
    const command = activeRuntime.submitCombatAction(control.actorId, skill.skillId, targetIds);
    assert.equal(command.accepted, true);
    pending = command.snapshot.pendingCombat;
    playerCommands += 1;
  }
  assert.ok(playerCommands < 16, "configured result combat must terminate inside its regression bound");
  assert.equal(pending?.combatSnapshot?.result?.outcome, "victory");
  if (!resolve) return { runtime: activeRuntime, pending, playerCommands, resolved: null };
  const resolved = activeRuntime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.event.combatResolution?.combatOutcome, "victory");
  assert.equal(resolved.snapshot.pendingCombat, null);
  return { runtime: activeRuntime, resolved, playerCommands };
}

const cases = [
  {
    resultId: "compare",
    roleId: "fb01r16_3",
    encounterId: "encounter_fb01_capture_yin_quanan",
    inventory: { xuan1: 1 },
    expectedFeedback: "成功将尹全安缉拿",
  },
  {
    resultId: "inattack201",
    roleId: "fb01r41_1",
    encounterId: "encounter_fb01_inner_demon",
    expectedFeedback: "阿青战胜了自己的心魔",
  },
  {
    resultId: "inattack202",
    roleId: "fb01r42_1",
    encounterId: "encounter_fb01_nightmare",
    expectedFeedback: "阿青终于从梦魇中醒来",
  },
];

const positive = [];
for (const [index, testCase] of cases.entries()) {
  const fixture = createRuntime({ ...testCase, desiredOutcome: "victory" });
  const started = fixture.runtime.interactWithChapterNpc(testCase.roleId, "custom_caozuo");
  assert.equal(started.accepted, true, `${testCase.resultId} must enter a real combat session`);
  assert.equal(started.snapshot.pendingCombat?.triggerResultId, testCase.resultId);
  assert.equal(started.snapshot.pendingCombat?.encounterId, testCase.encounterId);
  assert.equal(started.snapshot.pendingCombat?.combatSnapshot?.status, "active");
  assert.equal(started.event.executionStatus, "deferred");
  assert.equal(started.event.sideEffects.some((effect) => effect.resultId), false, "combat follow-up must not execute at acceptance time");
  const premature = fixture.runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(premature.accepted, false, "non-terminal combat must not resolve its result chain");
  const finished = finishVictory(fixture.runtime, index === 1 ? fixture : {});
  const feedback = finished.resolved.event.combatResolution.feedbackLines.join("\n");
  assert.ok(feedback.includes(testCase.expectedFeedback), `${testCase.resultId} must expose configured post-victory feedback`);
  assert.equal(/\$(?:IN|S|N)/.test(feedback), false, `${testCase.resultId} must not leak configured runtime text tokens`);
  if (testCase.resultId === "compare") {
    assert.equal(finished.resolved.snapshot.player.markers["缉拿任务"], "2");
    assert.ok(finished.resolved.snapshot.chapter.hiddenEntityIds.includes(testCase.roleId));
    assert.equal(finished.resolved.event.combatResolution.matchedOutcomeBranch, true);
  } else {
    assert.ok(finished.resolved.snapshot.flags.includes("combat_marker:inend=1"));
    assert.equal(finished.resolved.event.combatResolution.configuredOutcomeResult, true);
    if (testCase.resultId === "inattack202") {
      assert.ok(feedback.includes("而你在她走火入魔期间一直用自己的真气助她脱离梦魇的侵蚀"));
    }
  }
  positive.push({ resultId: testCase.resultId, encounterId: testCase.encounterId, playerCommands: finished.playerCommands });
}

{
  const testCase = cases[2];
  const fixture = createRuntime({ ...testCase, desiredOutcome: "victory", inheritance: null });
  assert.equal(fixture.runtime.interactWithChapterNpc(testCase.roleId, "custom_caozuo").accepted, true);
  const finished = finishVictory(fixture.runtime);
  const feedback = finished.resolved.event.combatResolution.feedbackLines.join("\n");
  assert.ok(feedback.includes("传人终于从梦魇中醒来"));
  assert.ok(feedback.includes("而你在其走火入魔期间一直用自己的真气助其脱离梦魇的侵蚀"));
  assert.equal(/\$(?:IN|S|N)/.test(feedback), false);
  positive.push({ resultId: "inattack202-fallback-text", encounterId: testCase.encounterId, playerCommands: finished.playerCommands });
}

const negative = [];
{
  const testCase = cases[0];
  const fixture = createRuntime({ ...testCase, desiredOutcome: "defeat" });
  const started = fixture.runtime.interactWithChapterNpc(testCase.roleId, "custom_caozuo");
  assert.equal(started.accepted, true);
  let pending = started.snapshot.pendingCombat;
  let commands = 0;
  while (pending?.combatSnapshot?.status === "active" && commands < 8) {
    const control = pending.combatControl;
    const skill = control.availableActions.skills.find((candidate) => candidate.available && candidate.skillId === "skill_basic_strike")
      || control.availableActions.skills.find((candidate) => candidate.available);
    assert.ok(skill, "defeat fixture must still expose a legal player command");
    const targetIds = skill.targetSelection === "player_select"
      ? [skill.targetCandidates[0]?.unitId].filter(Boolean)
      : [];
    const command = fixture.runtime.submitCombatAction(control.actorId, skill.skillId, targetIds);
    assert.equal(command.accepted, true);
    pending = command.snapshot.pendingCombat;
    commands += 1;
  }
  assert.ok(commands < 8, "defeat fixture must terminate inside its regression bound");
  assert.equal(pending?.combatSnapshot?.result?.outcome, "defeat");
  const resolved = fixture.runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.event.combatResolution.outcome, "failure");
  assert.equal(resolved.snapshot.player.markers["缉拿任务"], undefined);
  assert.equal(resolved.snapshot.chapter.hiddenEntityIds.includes(testCase.roleId), false);
  negative.push({ id: "defeat-does-not-apply-victory-results", assertionsPassed: true });
}

{
  const testCase = cases[2];
  const fixture = createRuntime({ ...testCase, desiredOutcome: "runaway" });
  const started = fixture.runtime.interactWithChapterNpc(testCase.roleId, "custom_caozuo");
  assert.equal(started.accepted, true);
  const control = started.snapshot.pendingCombat.combatControl;
  const escaped = fixture.runtime.attemptCombatRunaway(control.actorId);
  assert.equal(escaped.accepted, true);
  assert.equal(escaped.snapshot.pendingCombat?.combatSnapshot?.result?.outcome, "runaway");
  const resolved = fixture.runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.snapshot.flags.includes("combat_marker:inend=1"), false);
  negative.push({ id: "runaway-does-not-apply-victory-results", assertionsPassed: true });
}

{
  const contract = contractWithNpc("fb01r16_3");
  const source = contract.chapter1.npcs.find((npc) => npc.roleId === "fb01r16_3");
  const cloneNpc = clone(source);
  cloneNpc.roleId = "fb01r16_3_unlisted";
  contract.chapter1.npcs.push(cloneNpc);
  contract.chapter1.rooms.find((room) => room.roomId === fixtureRoomId).encounterIds.push(cloneNpc.roleId);
  const runtime = createFirstSessionRuntime(contract, {
    initialState: "STATE_FS_008_MAP_EXPLORE",
    initialFlags: ["chapter_fb01_entered"],
    initialPlayer: { ...clone(contract.playerSeed), inventory: { xuan1: 1 } },
    combatContent: sourceCombat,
  });
  runtime.selectChapterRoom(fixtureRoomId);
  runtime.selectChapterNpc(cloneNpc.roleId);
  const rejected = runtime.interactWithChapterNpc(cloneNpc.roleId, "custom_caozuo");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "combat result policy disallows source");
  negative.push({ id: "source-allowlist-fails-closed", assertionsPassed: true });
}

{
  const contract = contractWithNpc("fb01r41_1");
  delete contract.chapterSystem.combatResultPolicies.inattack201;
  const fixture = createRuntime({ roleId: "fb01r41_1", encounterId: "encounter_fb01_inner_demon", flow: contract });
  const rejected = fixture.runtime.interactWithChapterNpc("fb01r41_1", "custom_caozuo");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "combat result policy is not configured");
  negative.push({ id: "missing-policy-fails-closed", assertionsPassed: true });
}

{
  const contract = contractWithNpc("fb01r41_1");
  delete contract.chapter1.resultLookup.inattack201;
  const fixture = createRuntime({ roleId: "fb01r41_1", encounterId: "encounter_fb01_inner_demon", flow: contract });
  const started = fixture.runtime.interactWithChapterNpc("fb01r41_1", "custom_caozuo");
  assert.equal(started.accepted, true);
  const finished = finishVictory(fixture.runtime, { resolve: false });
  const rejected = finished.runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.event.reason.includes("unknown configured combat outcome result inattack201"));
  assert.ok(rejected.snapshot.pendingCombat, "rejected outcome transaction must retain pending combat for recovery");
  assert.equal(rejected.snapshot.flags.includes("combat_marker:inend=1"), false);
  negative.push({ id: "missing-outcome-result-fails-closed", assertionsPassed: true });
}

{
  const testCase = cases[0];
  const contract = contractWithNpc(testCase.roleId);
  contract.chapterSystem.combatResultPolicies.compare.successConditionToken = "missing_comparewin";
  const fixture = createRuntime({ ...testCase, desiredOutcome: "victory", flow: contract });
  assert.equal(fixture.runtime.interactWithChapterNpc(testCase.roleId, "custom_caozuo").accepted, true);
  const finished = finishVictory(fixture.runtime, { resolve: false });
  const rejected = finished.runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "configured combat outcome branch not found missing_comparewin");
  assert.ok(rejected.snapshot.pendingCombat, "missing configured condition branch must retain pending combat");
  assert.equal(rejected.snapshot.player.markers["缉拿任务"], undefined);
  negative.push({ id: "missing-outcome-condition-branch-fails-closed", assertionsPassed: true });
}

{
  const testCase = cases[0];
  const contract = contractWithNpc(testCase.roleId);
  contract.chapterSystem.combatResultPolicies.compare.outcomeResultTokens.success = ["text48"];
  const fixture = createRuntime({ ...testCase, desiredOutcome: "victory", flow: contract });
  assert.equal(fixture.runtime.interactWithChapterNpc(testCase.roleId, "custom_caozuo").accepted, true);
  const finished = finishVictory(fixture.runtime, { resolve: false });
  const rejected = finished.runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "ambiguous configured combat outcome dispatch for success");
  assert.ok(rejected.snapshot.pendingCombat, "ambiguous outcome dispatch must retain pending combat");
  assert.equal(rejected.snapshot.player.markers["缉拿任务"], undefined);
  negative.push({ id: "ambiguous-outcome-dispatch-fails-closed", assertionsPassed: true });
}

{
  const contract = contractWithNpc("fb01r41_1");
  const runtime = createFirstSessionRuntime(contract, {
    initialState: "STATE_FS_008_MAP_EXPLORE",
    initialFlags: ["chapter_fb01_entered"],
  });
  assert.equal(runtime.selectChapterRoom(fixtureRoomId).accepted, true);
  assert.equal(runtime.selectChapterNpc("fb01r41_1").accepted, true);
  const rejected = runtime.interactWithChapterNpc("fb01r41_1", "custom_caozuo");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "combat runtime content is unavailable");
  assert.deepEqual(rejected.event.sideEffects, []);
  assert.equal(rejected.snapshot.pendingCombat, null);
  negative.push({ id: "missing-combat-content-fails-closed", assertionsPassed: true });
}

const report = {
  generatedAt: new Date().toISOString(),
  status: "pass",
  positive,
  negative,
  knownUnrelatedMismatch: {
    id: "FIRST_SESSION_SIMULATION_MISMATCH",
    scope: "separate",
    statement: "This focused combat-result routing suite does not classify or conceal the known unrelated first-session simulation mismatch.",
  },
};

fs.mkdirSync(path.join(root, "outputs", "combat"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs", "combat", "combat_result_routing_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
