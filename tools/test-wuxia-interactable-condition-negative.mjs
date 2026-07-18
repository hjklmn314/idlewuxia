import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";
import { lastNpcLog, renderItemPanel } from "../src/wuxia-main.js";

function createContract({ keyCount, actionHints = ["open"] }) {
  return {
    schema: "idlewuxia.first_session_flow.test.v1",
    schemaVersion: "1.0.0",
    entryStateId: "STATE_TEST",
    states: [
      {
        stateId: "STATE_TEST",
        screenId: "map",
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

  const repeatBefore = runtime.snapshot();
  const repeated = runtime.interactWithChapterInteractable("guarded_chest", "open");
  const repeatAfter = runtime.snapshot();
  negativeMutationCount += isDeepStrictEqual(observableState(repeatAfter), observableState(repeatBefore)) ? 0 : 1;
  assert.equal(repeated.accepted, false, "重复点击仍必须拒绝");
  assert.deepEqual(
    observableState(repeatAfter),
    observableState(repeatBefore),
    "重复拒绝不得改变事件日志之外的运行时状态",
  );

  const restored = createFirstSessionRuntime(createContract({ keyCount: 0 }), {
    initialSaveState: runtime.exportSaveState(),
  });
  const restoredBefore = restored.snapshot();
  const restoredAvailability = restoredBefore.chapter1.selectedInteractableActionAvailability.find(
    (entry) => entry.actionType === "open",
  );
  assert.equal(restoredAvailability?.available, false, "存档重载后条件不足动作仍必须不可用");
  const restoredResult = restored.interactWithChapterInteractable("guarded_chest", "open");
  const restoredAfter = restored.snapshot();
  negativeMutationCount += isDeepStrictEqual(observableState(restoredAfter), observableState(restoredBefore)) ? 0 : 1;
  assert.equal(restoredResult.accepted, false, "存档重载后条件不足动作仍必须拒绝");
  assert.deepEqual(
    observableState(restoredAfter),
    observableState(restoredBefore),
    "存档重载后的拒绝不得改变事件日志之外的运行时状态",
  );
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

function runExactBranchPreventsUnhintedFallbackCase() {
  const contract = createContract({ keyCount: 0 });
  contract.activeChapter.conditionLookup["玩家物品小于;branch_key;1"] = {
    arg1: "玩家物品小于",
    arg2: "branch_key",
    arg3: "1",
  };
  contract.activeChapter.interactables[0].branches.push({
    id: "unhinted_fallback",
    actionHints: [],
    conditionTokens: ["玩家物品小于;branch_key;1"],
    narrativeLines: ["通用分支虽然满足，也不能替换已配置的精确动作分支。"],
    resolvedResults: [
      {
        category: "item_reward_or_cost",
        action: "玩家物品变化",
        args: {
          Arg2: "fallback_reward",
          Arg3: "1",
        },
      },
    ],
  });

  const runtime = createFirstSessionRuntime(contract);
  assert.equal(runtime.selectChapterInteractable("guarded_chest").accepted, true);
  const before = runtime.snapshot();
  const result = runtime.interactWithChapterInteractable("guarded_chest", "open");
  const after = runtime.snapshot();

  assert.equal(result.accepted, false, "精确动作分支存在但条件失败时不得回退到通用分支");
  assert.equal(inventoryCount(after, "fallback_reward"), 0, "被排除的通用分支不得发放奖励");
  assert.deepEqual(observableState(after), observableState(before), "精确分支拒绝后不得改变运行时状态");
}

function runMultiBranchDecisionConsistencyCase() {
  const contract = createContract({ keyCount: 1 });
  contract.activeChapter.conditionLookup["玩家物品大于;branch_key;-1"] = {
    arg1: "玩家物品大于",
    arg2: "branch_key",
    arg3: "-1",
  };
  contract.activeChapter.interactables[0].branches = [
    {
      id: "first_result_only",
      actionHints: ["open"],
      conditionTokens: ["玩家物品大于;branch_key;0"],
      narrativeLines: [],
      evidenceLevel: "lua_confirmed_first",
      resolvedResults: [
        {
          category: "item_reward_or_cost",
          action: "玩家物品变化",
          args: {
            Arg2: "reward_a",
            Arg3: "1",
          },
        },
      ],
    },
    {
      id: "second_narrative",
      actionHints: ["open"],
      conditionTokens: ["玩家物品大于;branch_key;-1"],
      narrativeLines: ["第二条分支也满足，但不应替换先匹配分支。"],
      evidenceLevel: "lua_confirmed_second",
      resolvedResults: [
        {
          category: "item_reward_or_cost",
          action: "玩家物品变化",
          args: {
            Arg2: "reward_b",
            Arg3: "1",
          },
        },
      ],
    },
  ];

  const runtime = createFirstSessionRuntime(contract);
  assert.equal(runtime.selectChapterInteractable("guarded_chest").accepted, true);
  const availability = runtime.snapshot().chapter1.selectedInteractableActionAvailability.find(
    (entry) => entry.actionType === "open",
  );
  const result = runtime.interactWithChapterInteractable("guarded_chest", "open");
  const after = runtime.snapshot();

  assert.equal(result.accepted, true);
  assert.deepEqual(
    result.event.conditionTokens,
    availability.conditionTokens,
    "可用性判定与执行必须选择同一条已满足分支",
  );
  assert.equal(inventoryCount(after, "reward_a"), 1, "配置顺序中的首个满足分支必须执行");
  assert.equal(inventoryCount(after, "reward_b"), 0, "后续同样满足的分支不得替换首个满足分支");
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

function runUiAvailabilityContractCase() {
  const contract = createContract({ keyCount: 0 });
  const runtime = createFirstSessionRuntime(contract);
  assert.equal(runtime.selectChapterInteractable("guarded_chest").accepted, true);
  const before = runtime.snapshot();
  const item = before.chapter1.selectedInteractable;
  const html = renderItemPanel(item, before);

  assert.match(html, /class="wuxia-item-action is-locked"/, "条件不足的物件按钮必须显示锁定样式");
  assert.match(html, /aria-disabled="true"/, "条件不足的物件按钮必须暴露无障碍禁用状态");
  assert.match(html, / disabled(?:>| )/, "条件不足的物件按钮必须真正禁用");
  assert.match(html, /当前条件不足/, "条件不足的物件按钮必须显示可见原因");

  const result = runtime.interactWithChapterInteractable("guarded_chest", "open");
  assert.equal(result.accepted, false);
  const logLines = lastNpcLog(runtime.snapshot(), contract.activeChapter.rooms[0], {});
  assert(
    logLines.some((line) => line.includes("configured action conditions are not met")),
    "物件拒绝事件必须进入房间日志，不能静默丢弃",
  );
}

const cases = [
  { name: "unmet exact branch", run: runNegativeCase },
  { name: "unmet unhinted branch", run: runUnhintedNegativeCase },
  { name: "exact branch blocks unhinted fallback", run: runExactBranchPreventsUnhintedFallbackCase },
  { name: "multi-branch decision consistency", run: runMultiBranchDecisionConsistencyCase },
  { name: "met branch", run: runPositiveCase },
  { name: "UI availability and rejection feedback", run: runUiAvailabilityContractCase },
];

for (const testCase of cases) testCase.run();

assert.equal(negativeMutationCount, 0, "所有负路径都必须保持零状态变化");

const report = {
  schema: "idlewuxia.interactable_branch_tests.v1",
  suite: "runtime:condition-negative",
  status: "pass",
  cases: cases.length,
  passed: cases.length,
  failed: 0,
  negativeMutationCount,
  assertions: {
    unmetConditionRejected: true,
    unmetConditionStateUnchanged: true,
    unhintedConditionRejected: true,
    missingEvidenceRemainsUnknown: true,
    repeatedRejectionStateUnchanged: true,
    restoredRejectionStateUnchanged: true,
    exactBranchBlocksUnhintedFallback: true,
    availabilityExecutionBranchConsistent: true,
    uiAvailabilityAndRejectionFeedback: true,
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
