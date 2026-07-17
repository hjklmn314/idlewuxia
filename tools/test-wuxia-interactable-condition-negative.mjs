import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

function createContract({ keyCount, actionHints = ["open"] }) {
  return {
    schemaVersion: "1.0.0",
    entryStateId: "STATE_TEST",
    states: [
      {
        id: "STATE_TEST",
        screen: "map",
        actions: [],
      },
    ],
    transitions: [],
    playerSeed: {
      name: "条件测试角色",
      inventory: {
        branch_key: keyCount,
        guarded_reward: 0,
      },
      attributes: {},
      flags: {},
      markers: {},
    },
    activeChapter: {
      chapterId: "chapter_condition_test",
      rooms: [
        {
          roomId: "room_condition_test",
          interactableIds: ["guarded_chest"],
        },
      ],
      interactables: [
        {
          interactableId: "guarded_chest",
          name: "上锁木箱",
          roomId: "room_condition_test",
          canSee: true,
          actions: [{ actionType: "open" }],
          branches: [
            {
              id: "guarded_chest_open",
              actionHints,
              conditionTokens: ["玩家物品大于;branch_key;0"],
              narrativeLines: ["你用钥匙打开木箱。"],
              resolvedResults: [
                {
                  category: "item_reward_or_cost",
                  action: "玩家物品变化",
                  args: {
                    Arg2: "guarded_reward",
                    Arg3: "1",
                  },
                },
              ],
            },
          ],
        },
      ],
      conditionLookup: {
        "玩家物品大于;branch_key;0": {
          arg1: "玩家物品大于",
          arg2: "branch_key",
          arg3: "0",
        },
      },
    },
  };
}

function inventoryCount(snapshot, itemId) {
  return Number(snapshot?.player?.inventory?.[itemId] || 0);
}

function observableState(snapshot) {
  const { events: _events, ...state } = snapshot;
  return state;
}

let negativeMutationCount = 0;

function runNegativeCase() {
  const runtime = createFirstSessionRuntime(createContract({ keyCount: 0 }));
  assert.equal(runtime.selectChapterInteractable("guarded_chest").accepted, true);
  const before = runtime.snapshot();
  const availability = before.chapter1.selectedInteractableActionAvailability.find(
    (entry) => entry.actionType === "open",
  );
  assert.equal(availability?.available, false, "条件不满足的物件动作必须在快照中标为不可用");
  assert.equal(availability?.reason, "configured action conditions are not met");
  const result = runtime.interactWithChapterInteractable("guarded_chest", "open");
  const after = runtime.snapshot();
  negativeMutationCount += isDeepStrictEqual(observableState(after), observableState(before)) ? 0 : 1;

  assert.equal(
    result.accepted,
    false,
    "条件不满足时物件动作必须被拒绝，不能回退到第一个精确分支",
  );
  assert.equal(inventoryCount(after, "guarded_reward"), 0, "拒绝后不得发放分支奖励");
  assert.deepEqual(observableState(after), observableState(before), "拒绝事件之外的完整运行时状态必须保持不变");
  assert.equal(result.event.type, "interactableInteractionRejected");
  assert.equal(result.event.reason, "configured action conditions are not met");
  assert.equal(result.event.evidenceLevel, "unknown", "缺失来源证据不得自动提升为 config_confirmed");
  assert.equal(result.event.conditionChecks[0]?.status, "checked_inventory_gt");
  assert.equal(result.event.conditionChecks[0]?.accepted, false);
}

function runUnhintedNegativeCase() {
  const runtime = createFirstSessionRuntime(createContract({ keyCount: 0, actionHints: [] }));
  assert.equal(runtime.selectChapterInteractable("guarded_chest").accepted, true);
  const before = runtime.snapshot();
  const availability = before.chapter1.selectedInteractableActionAvailability.find(
    (entry) => entry.actionType === "open",
  );
  assert.equal(availability?.available, false, "无 actionHints 的条件后备分支也必须参与可用性判定");
  const result = runtime.interactWithChapterInteractable("guarded_chest", "open");
  const after = runtime.snapshot();
  negativeMutationCount += isDeepStrictEqual(observableState(after), observableState(before)) ? 0 : 1;

  assert.equal(result.accepted, false, "无 actionHints 的条件后备分支不得绕过失败条件");
  assert.deepEqual(observableState(after), observableState(before), "后备分支拒绝后完整运行时状态必须保持不变");
}

function runPositiveCase() {
  const runtime = createFirstSessionRuntime(createContract({ keyCount: 1 }));
  assert.equal(runtime.selectChapterInteractable("guarded_chest").accepted, true);
  const availability = runtime.snapshot().chapter1.selectedInteractableActionAvailability.find(
    (entry) => entry.actionType === "open",
  );
  assert.equal(availability?.available, true, "条件满足的物件动作必须在快照中标为可用");
  const result = runtime.interactWithChapterInteractable("guarded_chest", "open");
  const after = runtime.snapshot();

  assert.equal(result.accepted, true, "条件满足时物件动作应正常执行");
  assert.equal(inventoryCount(after, "guarded_reward"), 1, "条件满足时应执行配置结果");
}

runUnhintedNegativeCase();
runNegativeCase();
runPositiveCase();

assert.equal(negativeMutationCount, 0, "所有负路径都必须保持零状态变化");

const report = {
  schema: "idlewuxia.interactable_branch_tests.v1",
  suite: "runtime:condition-negative",
  status: "pass",
  cases: 3,
  passed: 3,
  failed: 0,
  negativeMutationCount,
  assertions: {
    unmetConditionRejected: true,
    unmetConditionStateUnchanged: true,
    unhintedConditionRejected: true,
    missingEvidenceRemainsUnknown: true,
    metConditionAccepted: true,
    metConditionResultApplied: true,
  },
};

const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0) {
  const outputPath = path.resolve(process.argv[outIndex + 1] || "");
  assert(process.argv[outIndex + 1], "--out requires a report path");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report));
