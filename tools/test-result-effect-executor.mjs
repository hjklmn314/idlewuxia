import assert from "node:assert/strict";

import { cloneData } from "../src/dataClone.js";
import { createResultEffectExecutor } from "../src/resultEffectExecutor.js";

const inventoryMutationPolicy = {
  categoryName: "inventory",
  deltaActionName: "inventory_delta",
  craftActionName: "inventory_craft",
  itemIdArg: "item",
  deltaArg: "delta",
  craftIngredientsArg: "ingredients",
  craftProductArg: "product",
  stackDelimiter: ";",
  stackFieldDelimiters: [",", ":"],
  defaultDelta: 1,
};

const executor = createResultEffectExecutor({
  resultEffectPolicies: {
    inventoryMutation: inventoryMutationPolicy,
    runtimeMutation: {
      categoryNames: {
        narrativeFeedback: "narrative",
        attributeReward: "attribute",
        skillProgression: "skill_progression",
        roleState: "role_state",
      },
      actionNames: {
        entitySwap: "entity_swap",
        skillExperienceChange: "skill_delta",
        playerMarkerSet: "marker_set",
        playerTimedMarkerSet: "timed_marker_set",
      },
      argKeys: { primary: "a", secondary: "b", duration: "duration" },
      defaultValue: "1",
      listDelimiter: ";",
    },
  },
  npcLookup: new Map([["replacement", {}]]),
});
const state = {
  player: { inventory: { key: 1 } },
  flags: new Set(),
  hiddenEntityIds: new Set(),
  addedEntityIdsByRoom: new Map(),
  replacementEntityById: new Map(),
  mapMarkers: {},
  pendingChoice: null,
  selectedChapterNpcId: "",
  selectedChapterInteractableId: "",
};
const before = cloneData(state);
const result = executor.commit({
  sourceId: "source",
  preparedBranch: {
    resolvedResults: [
      {
        resultId: "first",
        category: "inventory",
        action: "inventory_delta",
        args: { item: "reward", delta: "1" },
      },
      {
        resultId: "second",
        category: "inventory",
        action: "inventory_delta",
        args: { item: "key", delta: "not-a-number" },
      },
    ],
  },
  state,
  eventIndex: 0,
});

assert.equal(result.accepted, false);
assert.equal(result.reason, "invalid inventory delta");
assert.deepEqual(result.sideEffects, [], "a rejected transaction must not publish rolled-back side effects");
assert.deepEqual(state, before, "a rejected effect transaction must not mutate caller state");
assert.equal(state.player.inventory.reward, undefined, "earlier effects must roll back when a later effect is invalid");

for (const [label, invalidEffect, expectedReason] of [
  ["attribute", { resultId: "missing_attribute_delta", category: "attribute", action: "attribute_delta", args: { a: "power" } }, "missing attribute delta args"],
  ["skill", { resultId: "missing_skill_delta", category: "skill_progression", action: "skill_delta", args: { a: "skill" } }, "missing skill experience args"],
]) {
  const rejected = executor.commit({
    sourceId: "source",
    preparedBranch: { resolvedResults: [invalidEffect] },
    state,
  });
  assert.equal(rejected.accepted, false, `${label} effect without a delta must be rejected`);
  assert.equal(rejected.reason, expectedReason);
  assert.deepEqual(rejected.sideEffects, []);
}

const successState = {
  ...cloneData(state),
  player: {
    ...cloneData(state.player),
    markers: {},
    timedMarkers: {},
    attributes: {},
  },
  selectedChapterNpcId: "source",
};
const committed = executor.commit({
  sourceId: "source",
  currentRoomId: "room",
  preparedBranch: {
    resolvedResults: [
      { resultId: "attribute", category: "attribute", action: "attribute_delta", args: { a: "power", b: "2" } },
      { resultId: "marker", category: "role_state", action: "marker_set", args: { a: "quest", b: "ready" } },
      { resultId: "timed", category: "other", action: "timed_marker_set", args: { a: "visit", b: "0", duration: "3600" } },
      { resultId: "swap", category: "other", action: "entity_swap", args: { a: "source", b: "replacement" } },
      { resultId: "text", category: "narrative", action: "text", narrativeLines: ["done"], args: {} },
    ],
  },
  state: successState,
  eventIndex: 7,
});

assert.equal(committed.accepted, true);
assert.equal(committed.state.player.power, 2);
assert.equal(committed.state.player.markers.quest, "ready");
assert.deepEqual(committed.state.player.timedMarkers.visit, { value: "0", duration: "3600", setAtEventIndex: 7 });
assert.equal(committed.state.replacementEntityById.get("source"), "replacement");
assert.equal(committed.state.hiddenEntityIds.has("source"), true);
assert.equal(committed.state.addedEntityIdsByRoom.get("room").has("replacement"), true);
assert.deepEqual(committed.sideEffects.map((effect) => effect.status), [
  "applied_attribute_delta",
  "applied_player_marker",
  "applied_player_timed_marker",
  "applied_entity_swap",
  "applied_text_feedback",
]);
assert.deepEqual(successState.player.markers, {}, "successful commit must still leave caller state untouched");

console.log("result effect executor contract tests: PASS");
