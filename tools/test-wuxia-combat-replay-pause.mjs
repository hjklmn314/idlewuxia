import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCombatSession, replayCombatSession } from "../src/combatSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));

function firstLegalAction(session) {
  const control = session.combatControlState();
  const skill = control.availableActions.skills.find((entry) => entry.available);
  assert.ok(skill, "a manual player turn must expose a legal configured skill");
  const target = skill.targetCandidates?.find((entry) => entry.alive && entry.side === "enemy")
    || skill.targetCandidates?.find((entry) => entry.alive)
    || null;
  return { unitId: control.actorId, skillId: skill.skillId, targetIds: target ? [target.unitId] : [] };
}

const session = createCombatSession(content, { encounterId: content.rules.defaultEncounterId, seed: 91427 });
session.start();
session.advanceUntilPlayerInput();
const beforePause = session.snapshot();
const paused = session.pause();
assert.equal(paused.accepted, true, "active combat must pause");
assert.equal(paused.snapshot.paused, true);
assert.equal(paused.snapshot.status, "active");
assert.equal(session.submitPlayerAction("unit_missing", "skill_missing", []).accepted, false, "paused combat must reject input");
assert.equal(session.submitPlayerAction(beforePause.playerUnitIds[0], "skill_basic_strike", [beforePause.enemyUnitIds[0]]).reason, "combat_paused");
const resumed = session.resume();
assert.equal(resumed.accepted, true, "paused combat must resume");
const first = firstLegalAction(session);
const applied = session.submitPlayerAction(first.unitId, first.skillId, first.targetIds);
assert.equal(applied.accepted, true, "resumed combat must accept the next legal configured command");

const savedAtDecision = applied.snapshot;
const restored = createCombatSession(content, { runtimeSnapshot: savedAtDecision });
assert.deepEqual(restored.snapshot(), savedAtDecision, "save/restore must preserve pause, rng, command log and replay id");
const restoredAction = firstLegalAction(restored);
const restoredApplied = restored.submitPlayerAction(restoredAction.unitId, restoredAction.skillId, restoredAction.targetIds);
const originalNext = session.submitPlayerAction(restoredAction.unitId, restoredAction.skillId, restoredAction.targetIds);
assert.equal(restoredApplied.accepted, true);
assert.equal(restoredApplied.snapshot.replayId, originalNext.snapshot.replayId, "restored and original sessions must keep deterministic replay identity");

const finished = createCombatSession(content, { encounterId: content.rules.defaultEncounterId, seed: 1024 });
finished.start();
finished.advanceUntilPlayerInput();
for (let i = 0; i < 64 && finished.snapshot().status === "active"; i += 1) {
  const turn = finished.combatControlState();
  if (!turn.requiresPlayerInput) {
    finished.advanceUntilPlayerInput();
    continue;
  }
  const action = firstLegalAction(finished);
  assert.equal(finished.submitPlayerAction(action.unitId, action.skillId, action.targetIds).accepted, true);
}
assert.equal(finished.snapshot().status, "finished", "configured combat must terminate within the replay bound");
const replayed = replayCombatSession(content, {
  encounterId: finished.snapshot().encounterId,
  seed: finished.snapshot().seed,
  commands: finished.snapshot().commandLog,
});
assert.equal(replayed.result?.outcome, finished.snapshot().result?.outcome, "replay outcome must match runtime outcome");
assert.deepEqual(
  replayed.events.map((event) => [event.EventType, event.sourceUnitId, event.targetUnitId, event.Value, event.RawValue, event.success]),
  finished.snapshot().events.map((event) => [event.EventType, event.sourceUnitId, event.targetUnitId, event.Value, event.RawValue, event.success]),
  "replay event stream must match the authoritative runtime stream",
);
assert.equal(replayed.replayId, finished.snapshot().replayId, "replay id must be deterministic");

const cappedContent = structuredClone(content);
cappedContent.rules.replay.maxCommands = 1;
const capped = createCombatSession(cappedContent, { encounterId: cappedContent.rules.defaultEncounterId, seed: 20260808 });
capped.start();
capped.advanceUntilPlayerInput();
assert.equal(capped.pause().accepted, true, "the first command under the configured cap must be accepted");
const cappedBeforeResume = capped.snapshot();
assert.equal(capped.resume().reason, "combat_replay_command_limit", "command cap must fail closed before mutation");
assert.deepEqual(capped.snapshot(), cappedBeforeResume, "command-cap rejection must not mutate the combat snapshot");

console.log("combat replay/pause tests: PASS (pause gate + save restore + deterministic command replay)");
