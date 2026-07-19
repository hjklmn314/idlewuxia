import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createResultPreparation } from "../src/resultPreparation.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const policies = {
  resultSetPolicy: { actionName: "结果集", resultListArg: "Arg2", resultDelimiter: ";", maxDepth: 4 },
  choiceResultPolicy: {
    actionName: "弹出选项框",
    titleArg: "Arg2",
    options: [
      { optionId: "yes", labelArg: "Arg3", resultListArg: "Arg4" },
      { optionId: "no", labelArg: "Arg5", resultListArg: "Arg6" },
    ],
  },
  inventoryMutationPolicy: {
    categoryName: "item_reward_or_cost",
    deltaActionName: "玩家物品变化",
    craftActionName: "物品合成",
    itemIdArg: "Arg2",
    deltaArg: "Arg3",
    craftIngredientsArg: "Arg2",
    craftProductArg: "Arg3",
    stackDelimiter: ";",
    stackFieldDelimiters: [",", ":"],
    defaultDelta: 1,
  },
};
const lookup = {
  root: { resultId: "root", action: "结果集", args: { Arg2: "cost;reward" } },
  cost: { resultId: "cost", category: "item_reward_or_cost", action: "玩家物品变化", args: { Arg2: "key", Arg3: "-2" } },
  reward: { resultId: "reward", category: "item_reward_or_cost", action: "玩家物品变化", args: { Arg2: "reward", Arg3: "1" } },
  cycle: { resultId: "cycle", action: "结果集", args: { Arg2: "cycle" } },
};
const preparation = createResultPreparation({ resultLookup: lookup, ...policies });
const player = { inventory: { key: 2 }, skillExp: {}, skillMoveExp: {} };
const before = clone(player);
const prepared = preparation.prepare({ resolvedResults: [lookup.root] }, player);

assert.equal(preparation.contractVersion, "idlewuxia.result_preparation.v1");
assert.equal(prepared.accepted, true);
assert.deepEqual(prepared.preparedBranch.resolvedResults.map((result) => result.resultId), ["cost", "reward"]);
assert.deepEqual(prepared.projectedInventory, { key: 0, reward: 1 });
assert.deepEqual(player, before, "preparation must not mutate the caller's player state");

const insufficient = preparation.prepare({ resolvedResults: [lookup.cost] }, { ...player, inventory: { key: 1 } });
assert.equal(insufficient.accepted, false);
assert.equal(insufficient.reason, "insufficient inventory");

const invalidPolicy = createResultPreparation({ resultLookup: lookup, ...policies, inventoryMutationPolicy: {} });
const rejectedPolicy = invalidPolicy.prepare({ resolvedResults: [lookup.cost] }, player);
assert.equal(rejectedPolicy.accepted, false);
assert.equal(rejectedPolicy.reason, "invalid inventory mutation policy");

const cyclic = preparation.prepare({ resolvedResults: [lookup.cycle] }, player);
assert.equal(cyclic.accepted, false);
assert.equal(cyclic.reason, "result chain cycle detected");

const source = readFileSync(new URL("../src/resultPreparation.js", import.meta.url), "utf8");
for (const forbiddenId of ["fb01", "tmnpc", "NODE_", "ACTION_FS_"]) {
  assert.equal(source.includes(forbiddenId), false, `generic result preparation must not contain ${forbiddenId}`);
}

console.log("result preparation contract tests: PASS");
