import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const flow = JSON.parse(
  readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"),
);
const clone = (value) => JSON.parse(JSON.stringify(value));
const cases = [];

function runCase(id, test) {
  test();
  cases.push({ id, status: "pass" });
}

function openTangmenChoice(options = {}) {
  const runtime = createFirstSessionRuntime(clone(flow), options);
  assert.equal(runtime.selectChapterNpc("tmnpc01d").accepted, true);
  const opened = runtime.interactWithChapterNpc("tmnpc01d", "custom_caozuo1");
  assert.equal(opened.accepted, true);
  assert.equal(opened.snapshot.pendingChoice.choiceId, "tmchoice01");
  return runtime;
}

runCase("choice_definition_comes_from_result_args", () => {
  const runtime = openTangmenChoice();
  const choice = runtime.snapshot().pendingChoice;
  assert.equal(choice.title.includes("手心劫"), true);
  assert.deepEqual(
    choice.options.map(({ optionId, label, resultTokens }) => ({ optionId, label, resultTokens })),
    [
      { optionId: "option_1", label: "是", resultTokens: ["tmneigongchange"] },
      { optionId: "option_2", label: "否", resultTokens: ["tmtext02"] },
    ],
  );
});

runCase("official_choice_executes_each_configured_continuation", () => {
  const expectations = [
    { optionId: "option_1", replacementId: "bf2r06_1a", feedback: /开设粥场/ },
    { optionId: "option_2", replacementId: "bf2r06_1b", feedback: /镇压刁民/ },
  ];
  for (const expectation of expectations) {
    const runtime = createFirstSessionRuntime(clone(flow), {
      initialPlayer: { ...flow.playerSeed, officialType: 1 },
    });
    assert.equal(runtime.selectChapterNpc("bf2r06_1").accepted, true);
    const opened = runtime.interactWithChapterNpc("bf2r06_1", "talk");
    assert.equal(opened.accepted, true);
    assert.equal(opened.snapshot.pendingChoice.choiceId, "bf2tankuang1");
    const resolved = runtime.resolvePendingChoice(expectation.optionId);
    assert.equal(resolved.accepted, true);
    assert.match(resolved.event.feedback, expectation.feedback);
    assert.equal(resolved.snapshot.player.experience, 4001);
    assert.equal(resolved.snapshot.player.weiwang, 1);
    assert.equal(resolved.snapshot.player.officialAchievement, 20);
    assert.equal(resolved.snapshot.chapter.replacementEntityById.bf2r06_1, expectation.replacementId);
    assert.equal(resolved.snapshot.player.timedMarkers["拜访任务104"].value, "0");
  }
});

runCase("unknown_option_is_atomic_and_choice_stays_open", () => {
  const runtime = openTangmenChoice();
  const before = runtime.exportSaveState();
  const rejected = runtime.resolvePendingChoice("not_an_option");
  const after = runtime.exportSaveState();
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "unknown choice option");
  assert.deepEqual(
    { ...after, events: [] },
    { ...before, events: [] },
    "invalid choice input must not mutate gameplay state or close the choice",
  );
});

runCase("missing_choice_continuation_fails_closed_before_open", () => {
  const contract = clone(flow);
  contract.chapter1.resultLookup.tmchoice01.args.Arg6 = "missing_choice_result";
  const choiceBranch = contract.chapter1.npcs
    .find((npc) => npc.roleId === "tmnpc01d")
    .branches
    .find((branch) => (branch.resultTokens || []).includes("tmchoice01"));
  choiceBranch.resolvedResults
    .find((result) => result.resultId === "tmchoice01")
    .args.Arg6 = "missing_choice_result";
  const runtime = createFirstSessionRuntime(contract, { initialChapter: contract.chapter1 });
  const selected = runtime.selectChapterNpc("tmnpc01d");
  const availability = selected.snapshot.chapter.selectedNpcActionAvailability
    .find((item) => item.actionType === "custom_caozuo1");
  assert.equal(availability.available, false);
  assert.equal(availability.reason, "choice option references an unknown result");
  const before = runtime.exportSaveState();
  const rejected = runtime.interactWithChapterNpc("tmnpc01d", "custom_caozuo1");
  const after = runtime.exportSaveState();
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "choice option references an unknown result");
  assert.deepEqual(
    { ...after, events: [] },
    { ...before, events: [] },
    "a missing continuation must not open a choice or mutate gameplay state",
  );
});

runCase("other_commands_are_blocked_until_choice_resolution", () => {
  const runtime = openTangmenChoice();
  const blocked = runtime.selectChapterNpc("tmnpc01e");
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.event.reason, "pending choice must be resolved first");
  assert.equal(runtime.snapshot().pendingChoice.choiceId, "tmchoice01");
});

runCase("negative_option_executes_configured_text_and_clears_choice", () => {
  const runtime = openTangmenChoice();
  const resolved = runtime.resolvePendingChoice("option_2");
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.event.feedback, "你决定暂时不进修手心劫内功。");
  assert.equal(resolved.snapshot.pendingChoice, null);
  const duplicate = runtime.resolvePendingChoice("option_2");
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.event.reason, "no pending choice");
});

runCase("pending_choice_round_trips_through_runtime_save", () => {
  const runtime = openTangmenChoice();
  const restored = createFirstSessionRuntime(clone(flow), {
    initialSaveState: runtime.exportSaveState(),
  });
  assert.equal(restored.snapshot().pendingChoice.choiceId, "tmchoice01");
  const resolved = restored.resolvePendingChoice("option_2");
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.snapshot.pendingChoice, null);
});

runCase("missing_source_skill_uses_configured_failure_result", () => {
  const runtime = openTangmenChoice();
  const resolved = runtime.resolvePendingChoice("option_1");
  assert.equal(resolved.accepted, true);
  assert.match(resolved.event.feedback, /进修失败/);
  assert.equal(resolved.snapshot.player.inheritableMarkers["唐门内功进修"], undefined);
  assert.equal(resolved.snapshot.chapter.replacementEntityById.tmnpc01d, undefined);
});

runCase("skill_conversion_respects_level_cap_and_transfers_configured_data", () => {
  const runtime = openTangmenChoice({
    initialPlayer: {
      ...flow.playerSeed,
      level: 10,
      skillExp: { biyunxinfa: 100, shouxinjie: 2 },
      skillMoveExp: { biluohuangquan: 12, yunqilongxiang: 8 },
      inventory: { biluohuangquancanye: 3, yunqilongxiangcanye: 2 },
    },
  });
  const resolved = runtime.resolvePendingChoice("option_1");
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.snapshot.player.skillExp.shouxinjie, 16);
  assert.equal(resolved.snapshot.player.skillExp.biyunxinfa, 100);
  assert.equal(resolved.snapshot.player.skillMoveExp.xinzhongci, 12);
  assert.equal(resolved.snapshot.player.skillMoveExp.zhijiansha, 8);
  assert.equal(resolved.snapshot.player.inventory.xinzhongcicanye, 3);
  assert.equal(resolved.snapshot.player.inventory.zhijianshacanye, 2);
  assert.equal(resolved.snapshot.player.inventory.biluohuangquancanye, 3);
  assert.equal(resolved.snapshot.player.inheritableMarkers["唐门内功进修"], "1");
  assert.equal(resolved.snapshot.chapter.replacementEntityById.tmnpc01d, "tmnpc01e");
  assert.match(resolved.event.feedback, /融会贯通/);
});

runCase("result_set_cycle_fails_closed", () => {
  const contract = clone(flow);
  contract.chapter1.resultLookup.changesuccess.args.Arg2 = "changesuccess";
  const runtime = openTangmenChoice({
    initialChapter: contract.chapter1,
    initialPlayer: {
      ...contract.playerSeed,
      level: 10,
      skillExp: { biyunxinfa: 10 },
    },
  });
  const before = runtime.exportSaveState();
  const rejected = runtime.resolvePendingChoice("option_1");
  const after = runtime.exportSaveState();
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.event.reason, "result chain cycle detected");
  assert.deepEqual(
    { ...after, events: [] },
    { ...before, events: [] },
    "cyclic result sets must not partially apply conversion or close the choice",
  );
});

process.stdout.write(`${JSON.stringify({
  schema: "idlewuxia.choice_result_runtime_test.v1",
  status: "pass",
  cases,
}, null, 2)}\n`);
