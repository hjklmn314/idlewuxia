import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRuntimePersistence } from "../src/runtimePersistence.js";
import { lastNpcLog } from "../src/wuxia-main.js";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const flow = JSON.parse(
  readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"),
);
const persistenceContract = JSON.parse(
  readFileSync(new URL("../config/runtime_persistence_contract.json", import.meta.url), "utf8"),
);
const clone = (value) => JSON.parse(JSON.stringify(value));
const cases = [];

function runCase(id, test) {
  test();
  cases.push({ id, status: "pass" });
}

runCase("dispatch_rejection_is_atomic", () => {
  const contract = clone(flow);
  const action = contract.actions.find((item) => item.actionId === "ACTION_FS_001_ORIGIN_WUXUE");
  action.responseModel.rewardClassId = "__MISSING_REWARD_CLASS__";
  const runtime = createFirstSessionRuntime(contract);
  const before = runtime.exportSaveState();
  const result = runtime.dispatch(action.actionId);
  const after = runtime.exportSaveState();
  assert.equal(result.accepted, false);
  assert.deepEqual(
    { ...after, events: [] },
    { ...before, events: [] },
    "a rejected command must not mutate persisted gameplay state",
  );
});

runCase("invalid_numeric_condition_fails_closed", () => {
  const contract = clone(flow);
  const action = contract.actions.find((item) => item.actionId === "ACTION_FS_001_ORIGIN_WUXUE");
  action.requestPayload = {
    ...(action.requestPayload || {}),
    minimumPlayerValues: { money: "not-a-number" },
  };
  const result = createFirstSessionRuntime(contract).dispatch(action.actionId);
  assert.equal(result.accepted, false);
  assert.match(result.event.reason, /invalid numeric condition/i);
});

runCase("snapshot_is_a_deep_copy", () => {
  const runtime = createFirstSessionRuntime(clone(flow));
  const exposed = runtime.snapshot();
  const actionId = exposed.availableActions[0].actionId;
  exposed.availableActions[0].fromState = "__EXTERNAL_MUTATION__";
  exposed.events.push({ type: "__EXTERNAL_EVENT__" });
  const result = runtime.dispatch(actionId);
  assert.equal(result.accepted, true);
  assert.equal(runtime.exportSaveState().events.some((event) => event.type === "__EXTERNAL_EVENT__"), false);
});

runCase("event_snapshot_is_a_deep_copy", () => {
  const runtime = createFirstSessionRuntime(clone(flow));
  runtime.dispatch(runtime.snapshot().availableActions[0].actionId);
  const exposed = runtime.snapshot();
  exposed.events[0].type = "__EXTERNAL_MUTATION__";
  assert.notEqual(runtime.exportSaveState().events[0].type, "__EXTERNAL_MUTATION__");
});

runCase("crafting_requires_all_ingredients", () => {
  const runtime = createFirstSessionRuntime(clone(flow));
  const before = runtime.exportSaveState();
  const result = runtime.interactWithChapterNpc("fb01r18_1", "custom_caozuo");
  const after = runtime.exportSaveState();
  assert.equal(result.accepted, false);
  assert.equal(result.event.reason, "insufficient crafting ingredients");
  assert.deepEqual(after.player.inventory, before.player.inventory);
});

runCase("player_marker_conditions_and_deltas_follow_reference_semantics", () => {
  const runtime = createFirstSessionRuntime(clone(flow), {
    initialPlayer: {
      ...flow.playerSeed,
      markers: { quest01: 0 },
    },
  });
  const result = runtime.interactWithChapterNpc("fb01r07_1a", "talk");
  assert.equal(result.accepted, true);
  assert.equal(runtime.snapshot().player.markers.quest01, 1);
  assert.equal(runtime.snapshot().player.inventory.item01_08, 1);
});

runCase("global_feedback_only_action_is_rejected", () => {
  const runtime = createFirstSessionRuntime(clone(flow));
  const selected = runtime.selectChapterNpc("fb01r01_1");
  const availability = selected.snapshot.chapter.selectedNpcActionAvailability
    .find((item) => item.actionType === "present");
  assert.equal(availability.visible, false);
  assert.equal(availability.available, false);
  const result = runtime.interactWithChapterNpc("fb01r01_1", "present");
  assert.equal(result.accepted, false);
  assert.equal(result.event.reason, "no configured runtime execution branch");
});

runCase("combat_result_without_policy_is_hidden", () => {
  const runtime = createFirstSessionRuntime(clone(flow), {
    initialPlayer: {
      ...flow.playerSeed,
      inventory: { xuan1: 1 },
    },
  });
  const selected = runtime.selectChapterNpc("fb01r16_3");
  const availability = selected.snapshot.chapter.selectedNpcActionAvailability
    .find((item) => item.actionType === "custom_caozuo");
  assert.equal(availability.visible, false);
  const result = runtime.interactWithChapterNpc("fb01r16_3", "custom_caozuo");
  assert.equal(result.accepted, false);
  assert.equal(result.event.reason, "combat runtime module is postponed");
});

runCase("choice_result_without_choice_ui_is_hidden", () => {
  const runtime = createFirstSessionRuntime(clone(flow));
  const selected = runtime.selectChapterNpc("tmnpc01d");
  const availability = selected.snapshot.chapter.selectedNpcActionAvailability
    .find((item) => item.actionType === "custom_caozuo1");
  assert.equal(availability.visible, false);
  const result = runtime.interactWithChapterNpc("tmnpc01d", "custom_caozuo1");
  assert.equal(result.accepted, false);
  assert.equal(result.event.reason, "choice UI runtime module is postponed");
});

runCase("malformed_compatible_save_is_ignored", () => {
  const invalidState = createFirstSessionRuntime(clone(flow)).exportSaveState();
  invalidState.hiddenEntityIds = {};
  const envelope = {
    $schema: persistenceContract.envelopeSchema,
    schemaVersion: persistenceContract.schemaVersion,
    runtimeSchema: invalidState.runtimeSchema,
    savedAt: new Date().toISOString(),
    state: invalidState,
  };
  const persistence = createRuntimePersistence({
    contract: persistenceContract,
    storage: {
      getItem: () => JSON.stringify(envelope),
      setItem: () => {},
      removeItem: () => {},
    },
  });
  const restored = persistence.restore(flow.schema);
  assert.equal(restored.status, "ignored_invalid");
  assert.equal(restored.state, null);
});

runCase("room_blocked_feedback_is_visible", () => {
  const lines = lastNpcLog({
    events: [{
      type: "roomBlocked",
      feedback: "前路被拦住了。",
      feedbackLines: ["前路被拦住了。"],
    }],
  }, { displayName: { zhCN: "前院" } });
  assert.deepEqual(lines, ["前路被拦住了。"]);
});

runCase("task_heading_text_is_not_mojibake", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.equal(css.includes("褰撳墠鍙"), false);
  assert.equal(css.includes("当前可进行的任务"), true);
});

process.stdout.write(`${JSON.stringify({
  schema: "idlewuxia.runtime_integrity_test.v1",
  status: "pass",
  cases,
}, null, 2)}\n`);
