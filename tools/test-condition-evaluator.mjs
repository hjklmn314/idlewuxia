import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createConditionEvaluator } from "../src/conditionEvaluator.js";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const conditionLookup = new Map([
  ["inventory", { arg1: "玩家物品大于", arg2: "key", arg3: "0" }],
  ["marker", { arg1: "玩家标记等于", arg2: "quest", arg3: "2" }],
  ["map", { arg1: "地图标记等于", arg2: "gate", arg3: "open" }],
  ["skill", { arg1: "玩家武功等级大于玩家等级", arg2: "sword", arg3: "" }],
  ["unsupported", { arg1: "尚未支持的条件", arg2: "", arg3: "" }],
]);
const evaluator = createConditionEvaluator({ conditionLookup });
const context = {
  player: {
    level: 2,
    inventory: { key: 1 },
    markers: { quest: 2 },
    skillLevels: { sword: 3 },
  },
  mapMarkers: { gate: "open" },
};

assert.equal(evaluator.contractVersion, "idlewuxia.condition_evaluator.v1");
for (const token of ["inventory", "marker", "map", "skill"]) {
  assert.equal(evaluator.evaluateToken(token, context).accepted, true, `${token} should pass`);
}
assert.equal(evaluator.evaluateToken("missing", context).status, "unknown_condition_token");
assert.equal(evaluator.evaluateToken("unsupported", context).status, "unsupported_condition_semantics");
assert.equal(
  evaluator.evaluateBranch(
    { conditionTokens: ["talk", "gorome2", "inventory", "ignored"] },
    { ...context, actionType: "talk", ignoreConditionTokens: ["ignored"] },
  ).accepted,
  true,
);

const flow = JSON.parse(
  readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"),
);
const runtime = createFirstSessionRuntime(flow, {
  initialPlayer: {
    ...flow.playerSeed,
    inventory: { branch_key: 0 },
  },
});
const before = runtime.exportSaveState();
const rejected = runtime.interactWithChapterNpc("fb01r16_3", "custom_caozuo");
const after = runtime.exportSaveState();
assert.equal(rejected.accepted, false);
assert.deepEqual(
  { ...after, events: [] },
  { ...before, events: [] },
  "condition extraction must preserve rejected-command atomicity",
);

const source = readFileSync(new URL("../src/conditionEvaluator.js", import.meta.url), "utf8");
for (const forbiddenId of ["fb01", "tmnpc", "NODE_", "ACTION_FS_"]) {
  assert.equal(source.includes(forbiddenId), false, `generic evaluator must not contain ${forbiddenId}`);
}

console.log("condition evaluator contract tests: PASS");
