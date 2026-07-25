import assert from "node:assert/strict";
import fs from "node:fs";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";
import { runAudit } from "./audit-wuxia-t02-02-interaction-semantics.mjs";

const contract = JSON.parse(fs.readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"));
const chapter = contract.chapter1;
const clone = (value) => JSON.parse(JSON.stringify(value));
const snapshot = (runtime) => {
  const value = runtime.snapshot();
  return JSON.stringify({
    currentState: value.currentState,
    flags: value.flags,
    player: value.player,
    taskState: value.taskState,
    hiddenEntityIds: value.chapter?.hiddenEntityIds || [],
    dynamicEntityIdsByRoom: value.chapter?.dynamicEntityIdsByRoom || {},
    replacementEntityById: value.chapter?.replacementEntityById || {},
    mapMarkers: value.chapter?.mapMarkers || {},
    pendingCombat: value.pendingCombat,
  });
};

function runInteractable(interactableId, actionType, initialPlayer = {}) {
  const item = chapter.interactables.find((candidate) => candidate.interactableId === interactableId);
  const room = chapter.rooms.find((candidate) => candidate.interactableIds?.includes(interactableId));
  assert.ok(item && room, `fixture ${interactableId} must exist in a configured room`);
  const runtime = createFirstSessionRuntime(clone(contract), {
    initialState: "STATE_FS_008_MAP_EXPLORE",
    initialFlags: ["new_install_or_new_save", "chapter_fb01_entered", "map_node_selected"],
    initialPlayer,
  });
  runtime.selectChapterRoom(room.roomId);
  runtime.selectChapterInteractable(interactableId);
  const before = snapshot(runtime);
  const result = runtime.interactWithChapterInteractable(interactableId, actionType);
  return { result, before, after: snapshot(runtime) };
}

const positiveCases = [
  ["fb01item_14", "use", "text18"],
  ["fb01item_20", "use", "text40"],
];
for (const [interactableId, actionType, resultToken] of positiveCases) {
  const { result, before, after } = runInteractable(interactableId, actionType);
  assert.equal(result.accepted, true, `${interactableId}/${actionType} should execute narrative observation`);
  assert.equal(result.executionStatus, "executed");
  assert.equal(result.outcomeKind, "narrative_only");
  assert.equal(result.stateChanged, false);
  assert.equal(before, after, `${interactableId}/${actionType} must not mutate semantic state`);
  assert.ok(result.event.resultTokens.includes(resultToken));
  assert.deepEqual(result.event.sideEffects.map((effect) => effect.status), ["applied_text_feedback"]);
}

const negativeCases = [
  ["fb01item_13", "use", "qixiaoyu1"],
  ["fb01item_15", "use", "qixiaoyu1"],
  ["fb01item_21", "use", "qixiaoyu1"],
  ["fb01item_7", "give", "itemxiaoyu4"],
  ["fb01item_9", "use", "qixiaoyu1"],
];
for (const [interactableId, actionType, conditionToken] of negativeCases) {
  const item = chapter.interactables.find((candidate) => candidate.interactableId === interactableId);
  const branch = item.branches.find((candidate) => candidate.conditionTokens.includes(conditionToken));
  const condition = chapter.conditionLookup[conditionToken];
  const initialPlayer = { qi: 1, hp: 1, inventory: { [condition?.arg2 || "item01_07"]: 0 } };
  if (String(condition?.arg1 || "").includes("物品")) initialPlayer.inventory[condition.arg2] = 0;
  const { result, before, after } = runInteractable(interactableId, actionType, initialPlayer);
  assert.equal(result.accepted, false, `${interactableId}/${actionType} feedback rejection must not be accepted`);
  assert.equal(result.executionStatus, "rejected");
  assert.equal(result.outcomeKind, "rejected_feedback");
  assert.equal(result.stateChanged, false);
  assert.equal(before, after, `${interactableId}/${actionType} rejection must be mutation-free`);
  assert.ok(result.event.conditionTokens.includes(conditionToken));
  assert.ok(result.event.feedbackLines.length > 0);
}

const unsupportedItem = chapter.interactables.find((candidate) => candidate.interactableId === "fb01item_1");
const unsupportedRoom = chapter.rooms.find((candidate) => candidate.interactableIds?.includes("fb01item_1"));
assert.ok(unsupportedItem && unsupportedRoom);
const unsupportedRuntime = createFirstSessionRuntime(clone(contract), {
  initialState: "STATE_FS_008_MAP_EXPLORE",
  initialFlags: ["new_install_or_new_save", "chapter_fb01_entered", "map_node_selected"],
});
unsupportedRuntime.selectChapterRoom(unsupportedRoom.roomId);
unsupportedRuntime.selectChapterInteractable("fb01item_1");
const unsupportedBefore = snapshot(unsupportedRuntime);
const unsupported = unsupportedRuntime.interactWithChapterInteractable("fb01item_1", "pickup");
assert.equal(unsupported.accepted, false);
assert.equal(unsupported.executionStatus, "unsupported");
assert.equal(unsupported.stateChanged, false);
assert.equal(unsupportedBefore, snapshot(unsupportedRuntime));

const report = runAudit({ writeOutputs: false });
assert.equal(report.summary.verdict, "pass");
assert.equal(report.summary.acceptedNoStateCount, 2);
assert.equal(report.summary.rejectedFeedbackNoStateCount, 1);
assert.equal(report.summary.branchAcceptedNoStateCount, 2);
assert.equal(report.summary.branchRejectedFeedbackNoStateCount, 18);
assert.equal(report.summary.unsupportedAcceptedCount, 0);
assert.deepEqual(
  report.findings.configuredFeedbackOnlyCandidates.map((row) => `${row.interactableId}/${row.actionType}`).sort(),
  ["fb01item_13/use", "fb01item_14/use", "fb01item_15/use", "fb01item_20/use", "fb01item_21/use", "fb01item_23/use", "fb01item_6/use", "fb01item_7/give", "fb01item_9/use"].sort(),
);
assert.equal(report.relatedFirstSessionSimulation.scope, "unrelated_to_T02-02");
assert.equal(report.relatedFirstSessionSimulation.excludedFromVerdict, true);
console.log(JSON.stringify({
  pass: true,
  positiveCases: positiveCases.length,
  negativeCases: negativeCases.length,
  acceptedNoState: report.summary.acceptedNoStateCount,
  rejectedFeedbackNoState: report.summary.rejectedFeedbackNoStateCount,
}, null, 2));
