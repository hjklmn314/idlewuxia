import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

function createContract({ keyCount }) {
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
              actionHints: ["open"],
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

  assert.equal(
    result.accepted,
    false,
    "条件不满足时物件动作必须被拒绝，不能回退到第一个精确分支",
  );
  assert.equal(inventoryCount(after, "guarded_reward"), 0, "拒绝后不得发放分支奖励");
  assert.deepEqual(after.player.inventory, before.player.inventory, "拒绝后背包必须保持不变");
  assert.deepEqual(after.player, before.player, "拒绝后玩家状态必须保持不变");
  assert.deepEqual(after.flags, before.flags, "拒绝后运行时标记必须保持不变");
  assert.deepEqual(after.chapter1.mapMarkers, before.chapter1.mapMarkers, "拒绝后地图标记必须保持不变");
  assert.equal(
    after.chapter1.selectedInteractableId,
    before.chapter1.selectedInteractableId,
    "拒绝后当前选中的物件不得变化",
  );
  assert.equal(result.event.type, "interactableInteractionRejected");
  assert.equal(result.event.reason, "configured action conditions are not met");
  assert.equal(result.event.conditionChecks[0]?.status, "checked_inventory_gt");
  assert.equal(result.event.conditionChecks[0]?.accepted, false);
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

runNegativeCase();
runPositiveCase();

const report = {
  schema: "idlewuxia.interactable_branch_tests.v1",
  suite: "runtime:condition-negative",
  status: "pass",
  cases: 2,
  passed: 2,
  failed: 0,
  negativeMutationCount: 0,
  assertions: {
    unmetConditionRejected: true,
    unmetConditionStateUnchanged: true,
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
