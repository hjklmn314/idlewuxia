import fs from "node:fs";
import path from "node:path";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const root = process.cwd();
const flow = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_flow.json"), "utf8"));
const screen = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_screen_contract.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dispatch(runtime, actionId) {
  const result = runtime.dispatch(actionId);
  assert(result.accepted, `${actionId} should be accepted, got ${JSON.stringify(result.event)}`);
  return result.snapshot;
}

function reject(runtime, actionId, text) {
  const result = runtime.dispatch(actionId);
  assert(!result.accepted, `${actionId} should be rejected`);
  assert(String(result.event.feedback || "").includes(text), `${actionId} feedback should include ${text}`);
  return result.snapshot;
}

function completeConfiguredCompete(runtime, roleId) {
  const started = runtime.interactWithChapterNpc(roleId, "compete");
  assert(started.accepted, `${roleId} compete should start`);
  assert(started.snapshot.currentState === "STATE_FS_009_EARLY_COMBAT", `${roleId} compete should enter combat before success results`);
  assert(started.snapshot.pendingCombat?.sourceId === roleId, `${roleId} should be recorded as pending combat source`);
  assert(!started.event.sideEffects.some((effect) => effect.resultId), `${roleId} must not execute comparewin results before combat resolution`);
  const resolved = runtime.dispatch("ACTION_FS_009_EARLY_COMBAT");
  assert(resolved.accepted, `${roleId} configured combat result should resolve`);
  assert(resolved.event.combatResolution?.accepted, `${roleId} should resolve through a configured outcome branch`);
  assert(resolved.event.combatResolution?.outcomeToken === "comparewin", `${roleId} should use comparewin only after combat success`);
  assert(resolved.snapshot.currentState === "STATE_FS_008_MAP_EXPLORE", `${roleId} combat result should return to the current map without an intermediate NPC menu`);
  return { started, resolved };
}

const runtime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});

let snapshot = runtime.snapshot();
assert(snapshot.currentState === "STATE_FS_001_OPENING_STORY", "first session must start at opening story");
assert(snapshot.availableActions.some((action) => action.actionId === "ACTION_FS_001_ORIGIN_SCHOLAR"), "origin choices must be available");

const repeatTaskRuntime = createFirstSessionRuntime(flow, {
  initialState: "STATE_FS_005_IDLE_TASK_LIST",
  initialFlags: ["idle_task_started"],
});

const combatScreen = screen.screens?.UI_EarlyCombat || {};
const combatRuntimeBlock = (combatScreen.body || []).find((block) => block.type === "combatRuntime");
assert(!combatScreen.primaryText && !combatScreen.primaryActionId, "player combat screen must not expose a manual continue action");
assert(combatRuntimeBlock?.autoResolve === true, "player combat screen must declare timeline autoResolve");
dispatch(repeatTaskRuntime, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
dispatch(repeatTaskRuntime, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
assert(repeatTaskRuntime.snapshot().taskState.completedClicks === 2, "repeatable hangup work must accumulate completed clicks instead of resetting to one");
assert(repeatTaskRuntime.snapshot().player.experience === 401, "two hangup reward claims must accumulate competitor reward-class experience");

snapshot = dispatch(runtime, "ACTION_FS_001_ORIGIN_SCHOLAR");
assert(snapshot.currentState === "STATE_FS_001_ORIGIN_RESULT", "scholar origin should enter origin result");
assert(snapshot.player.origin === "\u4e66\u9999\u95e8\u7b2c", "origin profile should be scholar family");
assert(snapshot.player.originFeedback.includes("\u4e66\u9999\u95e8\u7b2c"), "origin feedback should use observed competitor text");

snapshot = dispatch(runtime, "ACTION_FS_001_ORIGIN_RESULT_CONTINUE");
assert(snapshot.currentState === "STATE_FS_002_TITLE_START", "origin result should continue to title");

snapshot = dispatch(runtime, "ACTION_FS_002_TITLE_START");
assert(snapshot.currentState === "STATE_FS_003_CHARACTER_STATUS", "title should enter character status");

snapshot = dispatch(runtime, "ACTION_FS_003_CHARACTER_STATUS");
assert(snapshot.currentState === "STATE_FS_004_IDLE_CONFIRM", "task entry should open idle confirm");

snapshot = dispatch(runtime, "ACTION_FS_004_IDLE_CONFIRM");
assert(snapshot.currentState === "STATE_FS_005_IDLE_TASK_LIST", "start task should open task list");
assert(snapshot.taskState.activeTaskId === "10001", "idle task state should record competitor pool fishing task id");

snapshot = reject(runtime, "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE", "\u5148\u5b8c\u6210\u4e00\u6b21\u6c60\u8fb9\u6253\u9c7c");
assert(snapshot.currentState === "STATE_FS_005_IDLE_TASK_LIST", "return to jianghu should require at least one pool-fishing click");

snapshot = dispatch(runtime, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
assert(snapshot.currentState === "STATE_FS_005_IDLE_TASK_LIST", "pool fishing click should remain on task list");
assert(snapshot.player.experience === 201, `experience should become 201, got ${snapshot.player.experience}`);
assert(snapshot.player.potential === 201, `potential should become 201, got ${snapshot.player.potential}`);
assert(snapshot.events[snapshot.events.length - 1].feedback.includes("\u9c7c"), "task click should use competitor hangup event text");
assert(snapshot.events[snapshot.events.length - 1].rewardClassId === "100012", "task reward should be applied through rewardClass 100012");
assert(snapshot.events[snapshot.events.length - 1].rewardRows.length === 2, "rewardClass 100012 should expand to exp and pot rows");

snapshot = reject(runtime, "ACTION_FS_005_LOCKED_EXP_1000", "\u7ecf\u9a8c\u4e0d\u8db3");
assert(snapshot.currentState === "STATE_FS_005_IDLE_TASK_LIST", "locked task feedback should keep list visible");

snapshot = dispatch(runtime, "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE");
assert(snapshot.currentState === "STATE_FS_007_CHAPTER_CARD_ENTRY", "return should enter chapter card entry without sect-home detour");
assert(!snapshot.flags.includes("growth_hub_seen"), "flow must not grant sect/growth hub before sect selection");

snapshot = dispatch(runtime, "ACTION_FS_007_CHAPTER_CARD_ENTRY");
assert(snapshot.currentState === "STATE_FS_008_MAP_EXPLORE", "chapter card should enter first chapter map explore");

const selectedGateRoom = runtime.selectChapterRoom("fb01_01");
assert(selectedGateRoom.accepted, "fb01_01 gate room should be selectable");
assert(selectedGateRoom.event.encounterNames.includes("\u6b66\u9986\u8001\u7ba1\u5bb6"), "fb01_01 should expose old steward from NPC evidence");
const selectedSteward = runtime.selectChapterNpc("fb01r01_1");
assert(selectedSteward.accepted, "old steward should be selectable as an NPC in fb01_01");
assert(selectedSteward.event.actions.some((action) => action.actionType === "talk"), "old steward should expose talk action");
assert(selectedSteward.event.actions.some((action) => action.actionType === "compete"), "old steward should expose compete action");
assert(selectedSteward.event.actions.some((action) => action.actionType === "present"), "old steward should expose present action");
const stewardTalk = runtime.interactWithChapterNpc("fb01r01_1", "talk");
assert(stewardTalk.accepted, "old steward talk action should be accepted");
assert(stewardTalk.event.feedback.includes("\u91d1\u725b\u6b66\u9986\u6bd4\u6b66\u62db\u8d24"), "old steward talk should resolve rlt_text27 narrative text");
assert(!stewardTalk.event.feedback.includes("text27"), "npc interaction feedback must not leak result ids");
assert(stewardTalk.event.sideEffects.some((effect) => effect.resultId === "change1" && effect.status === "applied_entity_swap"), "old steward talk should execute change1 entity swap");
assert(runtime.snapshot().chapter1.hiddenEntityIds.includes("fb01r01_1"), "change1 should hide original old steward role");
assert(runtime.snapshot().chapter1.dynamicEntityIdsByRoom.fb01_01.includes("fb01r01_1a"), "change1 should add old steward next state to fb01_01");
const originalStewardCompete = runtime.interactWithChapterNpc("fb01r01_1", "compete");
assert(!originalStewardCompete.accepted, "original old steward should no longer be clickable after change1 swap");
const prematureStewardTalk = runtime.interactWithChapterNpc("fb01r01_1a", "talk");
assert(!prematureStewardTalk.accepted, "fightable old steward must not expose comparewin dialogue before combat resolves");
const stewardCompete = completeConfiguredCompete(runtime, "fb01r01_1a");
assert(stewardCompete.started.event.feedback.includes("\u63d0\u51fa\u5207\u78cb"), "changed old steward compete should show the pre-combat action feedback");
assert(stewardCompete.resolved.event.combatResolution.feedbackLines.some((line) => line.includes("\u5389\u5bb3\u5389\u5bb3")), "changed old steward comparewin text should appear only after combat resolution");
assert(stewardCompete.resolved.event.combatResolution.sideEffects.some((effect) => effect.resultId === "mapbj2" && effect.status === "applied_map_marker"), "changed old steward combat success should set mapbj2 marker");
const hiddenGateTrigger = runtime.selectChapterInteractable("bfitem2");
assert(!hiddenGateTrigger.accepted, "hidden gate task trigger bfitem2 must not be selectable as a visible room object");
assert(hiddenGateTrigger.event.reason === "interactable is hidden by canSee=0", "hidden gate trigger should be rejected by canSee=0");

const selectedFrontYard = runtime.selectChapterRoom("fb01_02");
assert(selectedFrontYard.accepted, "fb01_02 front yard should be selectable from gate route");
const zhaoIntro = runtime.interactWithChapterNpc("fb01r02_1b", "talk");
assert(zhaoIntro.accepted, "front-yard Zhao instructor intro should be accepted");
assert(zhaoIntro.event.sideEffects.some((effect) => effect.resultId === "change16" && effect.status === "applied_entity_swap"), "Zhao intro should execute change16 into fightable state");
const blockedByZhao = runtime.selectChapterRoom("fb01_03");
assert(!blockedByZhao.accepted, "fb01_03 should be blocked by Zhao before his comparewin result");
assert(blockedByZhao.event.feedback.includes("\u8d75\u6559\u5934\u62e6\u4f4f\u4e86\u4f60"), "blocked room transition should show Zhao stop text");
const zhaoCompete = completeConfiguredCompete(runtime, "fb01r02_1");
assert(zhaoCompete.resolved.event.combatResolution.sideEffects.some((effect) => effect.resultId === "mapbj4" && effect.status === "applied_map_marker"), "Zhao combat success should set guard marker mapbj4");
const blockedByZhou = runtime.selectChapterRoom("fb01_03");
assert(!blockedByZhou.accepted, "fb01_03 should still be blocked by Zhou before his comparewin result");
assert(blockedByZhou.event.feedback.includes("\u5468\u6559\u5934\u62e6\u4f4f\u4e86\u4f60"), "blocked room transition should show Zhou stop text");
const zhouCompete = completeConfiguredCompete(runtime, "fb01r02_2");
assert(zhouCompete.resolved.event.combatResolution.sideEffects.some((effect) => effect.resultId === "mapbj5" && effect.status === "applied_map_marker"), "Zhou combat success should set guard marker mapbj5");
const unblockedFrontYardExit = runtime.selectChapterRoom("fb01_03");
assert(unblockedFrontYardExit.accepted, "fb01_03 should be reachable after both instructor comparewin results");

const selectedMainHall = runtime.selectChapterNode("NODE_FB01_MAIN_HALL");
assert(selectedMainHall.accepted, "main hall node should be selectable from map explore");
assert(selectedMainHall.event.primaryAction?.actionId === "ACT_CH1_SELECT_MAIN_HALL", "main hall node should expose its fb01 route action");
assert(selectedMainHall.event.encounters.length === 1, "main hall node should expose its combat encounter count");
assert(selectedMainHall.event.sourceRooms.includes("fb01_04"), "main hall node should expose source room fb01_04");
assert(selectedMainHall.event.rooms.some((room) => room.roomId === "fb01_04"), "main hall node should expand to source room fb01_04");
assert(selectedMainHall.event.interactableNames.includes("\u5f20\u98ce"), "main hall node should expose Zhang Feng from mapRole/mapRoleBase evidence");
assert(selectedMainHall.event.rewards.some((reward) => reward.rewardId === "REWARD_FB01_CHAPTER_CLEAR"), "main hall node should expose chapter clear reward object");

const selectedMainHallRoom = runtime.selectChapterRoom("fb01_04");
assert(selectedMainHallRoom.accepted, "fb01_04 room should be selectable after room-chain sync");
assert(selectedMainHallRoom.event.parentNodeId === "NODE_FB01_MAIN_HALL", "fb01_04 should belong to the main hall compressed node");
assert(selectedMainHallRoom.event.connections.some((connection) => connection.roomId === "fb01_05"), "fb01_04 should preserve room exit to fb01_05");
assert(selectedMainHallRoom.event.encounterNames.includes("\u5f20\u98ce"), "fb01_04 should expose Zhang Feng as room encounter");
assert(selectedMainHallRoom.event.fightBackground === "\u57ce\u9547\u5ba4\u5916", "fb01_04 should preserve fight background from mapRoom evidence");
assert(selectedMainHallRoom.event.roomBgm === "huo", "fb01_04 should preserve room BGM from mapRoom evidence");
const selectedZhangFeng = runtime.selectChapterNpc("fb01r04_1");
assert(selectedZhangFeng.accepted, "Zhang Feng should be selectable in fb01_04");
const zhangFengTalk = runtime.interactWithChapterNpc("fb01r04_1", "talk");
assert(zhangFengTalk.accepted, "Zhang Feng talk action should be accepted");
assert(zhangFengTalk.event.feedback.includes("\u5c11\u4fa0\u5e74\u8f7b\u6709\u4e3a"), "Zhang Feng talk should resolve rlt_text8 narrative text");
const selectedFightableZhangFeng = runtime.selectChapterNpc("fb01r04_1a");
assert(selectedFightableZhangFeng.accepted, "Zhang Feng fightable state should be selectable after talk/change5");
const zhangFengCompete = completeConfiguredCompete(runtime, "fb01r04_1a");
assert(zhangFengCompete.resolved.event.combatResolution.sideEffects.some((effect) => effect.resultId === "mapbj1" && effect.status === "applied_map_marker"), "Zhang Feng combat success should set mapbj1 marker");
assert(zhangFengCompete.resolved.event.combatResolution.sideEffects.some((effect) => effect.resultId === "mapbj1" && effect.status === "applied_chapter_clear_reward"), "mapbj1 should trigger fb01 chapter clear reward through chapterClearPolicy");
assert(runtime.snapshot().flags.includes("fb01_complete"), "fb01 clear policy should grant fb01_complete flag");
assert(runtime.snapshot().flags.includes("STATE_FS_012_CHAPTER_CLEAR"), "fb01 clear policy should grant chapter clear state signal");
assert(runtime.snapshot().player.experience === 3201, `chapter clear should add 3000 exp after pool fishing, got ${runtime.snapshot().player.experience}`);
assert(runtime.snapshot().player.potential === 3201, `chapter clear should add 3000 potential after pool fishing, got ${runtime.snapshot().player.potential}`);
assert(runtime.snapshot().player.yueli === 20, `chapter clear should add 20 yueli, got ${runtime.snapshot().player.yueli}`);
assert(runtime.snapshot().player.chapterClearLedger.some((entry) => entry.chapterId === "fb01" && entry.rewardId === "REWARD_FB01_CHAPTER_CLEAR"), "chapter clear ledger should preserve reward evidence");
const selectedOwnerWingRoom = runtime.selectChapterRoom("fb01_05");
assert(selectedOwnerWingRoom.accepted, "fb01_05 should be selectable through fb01_04 room exit");
assert(selectedOwnerWingRoom.event.parentNodeId === "NODE_FB01_OWNER_WING", "fb01_05 should switch selected parent node to owner wing");
assert(selectedOwnerWingRoom.event.connections.some((connection) => connection.roomId === "fb01_04"), "fb01_05 should preserve return exit to fb01_04");
assert(runtime.snapshot().chapter1.selectedNodeId === "NODE_FB01_OWNER_WING", "room navigation should update selected compressed node");
assert(runtime.snapshot().chapter1.selectedRoomId === "fb01_05", "room navigation should update selected room");
const selectedStudyRoom = runtime.selectChapterRoom("fb01_06");
assert(selectedStudyRoom.accepted, "fb01_06 study room should be selectable through owner-wing room exit");
assert(selectedStudyRoom.event.interactableIds.includes("fb01item_20"), "fb01_06 should include visible bookcase fb01item_20 from mapItem evidence");
assert(selectedStudyRoom.event.interactableIds.includes("fb01item_16"), "fb01_06 should include visible bookcase fb01item_16 from mapItem evidence");
const hiddenStudyTrigger = runtime.selectChapterInteractable("bfitem3");
assert(!hiddenStudyTrigger.accepted, "hidden study task trigger bfitem3 must not be selectable as a visible room object");
assert(hiddenStudyTrigger.event.reason === "interactable is hidden by canSee=0", "hidden study trigger should be rejected by canSee=0");
const selectedStudyBookcase = runtime.selectChapterInteractable("fb01item_20");
assert(selectedStudyBookcase.accepted, "fb01item_20 bookcase should be selectable");
assert(selectedStudyBookcase.event.actions.some((action) => action.actionType === "use" && action.label === "\u7ffb\u52a8"), "fb01item_20 should expose use action label from useName");
const studyBookcaseUse = runtime.interactWithChapterInteractable("fb01item_20", "use");
assert(studyBookcaseUse.accepted, "fb01item_20 use action should be accepted");
assert(studyBookcaseUse.event.feedback.includes("\u4f60\u5728\u4e66\u67dc\u91cc\u56db\u5904\u7ffb\u627e"), "fb01item_20 should resolve text40 narrative text");
assert(!studyBookcaseUse.event.feedback.includes("text40"), "interactable feedback must not leak result ids");
const letterBookcaseUse = runtime.interactWithChapterInteractable("fb01item_16", "use");
assert(letterBookcaseUse.accepted, "fb01item_16 use action should be accepted");
assert(letterBookcaseUse.event.feedback.includes("\u4f3c\u4e4e\u5939\u7740\u4e00\u5c01\u4e66\u4fe1"), "fb01item_16 should resolve text13 narrative text");

snapshot = dispatch(runtime, "ACT_CH1_SELECT_MAIN_HALL");
assert(snapshot.currentState === "STATE_FS_009_EARLY_COMBAT", "map explore should enter early combat");
assert(snapshot.flags.includes("chapter_node_main_hall_selected"), "main hall route should grant a node-specific flag");

snapshot = dispatch(runtime, "ACTION_FS_009_EARLY_COMBAT");
assert(snapshot.currentState === "STATE_FS_008_MAP_EXPLORE", "early combat should resolve directly back to map exploration");

const backRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
dispatch(backRuntime, "ACTION_FS_001_ORIGIN_SCHOLAR");
dispatch(backRuntime, "ACTION_FS_001_ORIGIN_RESULT_CONTINUE");
dispatch(backRuntime, "ACTION_FS_002_TITLE_START");
dispatch(backRuntime, "ACTION_FS_003_CHARACTER_STATUS");
dispatch(backRuntime, "ACTION_FS_004_IDLE_CONFIRM");
const backSnapshot = dispatch(backRuntime, "ACTION_FS_005_IDLE_TASK_LIST_BACK");
assert(backSnapshot.currentState === "STATE_FS_003_CHARACTER_STATUS", "task-list top back should return to character status");

const mapBackRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
dispatch(mapBackRuntime, "ACTION_FS_001_ORIGIN_SCHOLAR");
dispatch(mapBackRuntime, "ACTION_FS_001_ORIGIN_RESULT_CONTINUE");
dispatch(mapBackRuntime, "ACTION_FS_002_TITLE_START");
dispatch(mapBackRuntime, "ACTION_FS_003_CHARACTER_STATUS");
dispatch(mapBackRuntime, "ACTION_FS_004_IDLE_CONFIRM");
dispatch(mapBackRuntime, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
dispatch(mapBackRuntime, "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE");
dispatch(mapBackRuntime, "ACTION_FS_007_CHAPTER_CARD_ENTRY");
const mapBackSnapshot = dispatch(mapBackRuntime, "ACTION_FS_008_MAP_EXPLORE_BACK_TO_CHAPTER");
assert(mapBackSnapshot.currentState === "STATE_FS_007_CHAPTER_CARD_ENTRY", "map top nav should return to chapter entry");

const npcBackRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
dispatch(npcBackRuntime, "ACTION_FS_001_ORIGIN_SCHOLAR");
dispatch(npcBackRuntime, "ACTION_FS_001_ORIGIN_RESULT_CONTINUE");
dispatch(npcBackRuntime, "ACTION_FS_002_TITLE_START");
dispatch(npcBackRuntime, "ACTION_FS_003_CHARACTER_STATUS");
dispatch(npcBackRuntime, "ACTION_FS_004_IDLE_CONFIRM");
dispatch(npcBackRuntime, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
dispatch(npcBackRuntime, "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE");
dispatch(npcBackRuntime, "ACTION_FS_007_CHAPTER_CARD_ENTRY");
dispatch(npcBackRuntime, "ACT_CH1_SELECT_MAIN_HALL");
const npcBackSnapshot = dispatch(npcBackRuntime, "ACTION_FS_009_EARLY_COMBAT");
assert(npcBackSnapshot.currentState === "STATE_FS_008_MAP_EXPLORE", "combat completion should return to map explore without an intermediate NPC menu");

const nodeRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
dispatch(nodeRuntime, "ACTION_FS_001_ORIGIN_SCHOLAR");
dispatch(nodeRuntime, "ACTION_FS_001_ORIGIN_RESULT_CONTINUE");
dispatch(nodeRuntime, "ACTION_FS_002_TITLE_START");
dispatch(nodeRuntime, "ACTION_FS_003_CHARACTER_STATUS");
dispatch(nodeRuntime, "ACTION_FS_004_IDLE_CONFIRM");
dispatch(nodeRuntime, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
dispatch(nodeRuntime, "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE");
dispatch(nodeRuntime, "ACTION_FS_007_CHAPTER_CARD_ENTRY");
const routeExpectations = [
  ["NODE_FB01_OUTER_GATE", "ACT_CH1_SELECT_OUTER_GATE"],
  ["NODE_FB01_FRONT_YARD", "ACT_CH1_SELECT_FRONT_YARD"],
  ["NODE_FB01_MAIN_HALL", "ACT_CH1_SELECT_MAIN_HALL"],
  ["NODE_FB01_OWNER_WING", "ACT_CH1_SELECT_OWNER_WING"],
  ["NODE_FB01_TRAINING_FIELDS", "ACT_CH1_SELECT_TRAINING_FIELDS"],
  ["NODE_FB01_BACKYARD_WORK", "ACT_CH1_SELECT_BACKYARD_WORK"],
];
for (const [nodeId, actionId] of routeExpectations) {
  const selected = nodeRuntime.selectChapterNode(nodeId);
  assert(selected.accepted, `${nodeId} should be selectable`);
  assert(selected.event.primaryAction?.actionId === actionId, `${nodeId} should expose ${actionId}`);
}
const settlementBridge = (flow.chapter1?.nodes || []).find((node) => node.nodeId === "NODE_FB01_SETTLEMENT_LOOP");
assert(settlementBridge?.isProjectBridge === true, "settlement loop must be marked as a project bridge, not a competitor map node");
assert(settlementBridge?.hideFromMap === true, "settlement loop must be hidden from player-facing chapter map route list");

const trainingNode = nodeRuntime.selectChapterNode("NODE_FB01_TRAINING_FIELDS");
assert(trainingNode.accepted, "training compressed node should be selectable");
assert(trainingNode.event.rooms.length >= 15, "training compressed node should expand to its original room list");
const trainingRoom = nodeRuntime.selectChapterRoom("fb01_15");
assert(trainingRoom.accepted, "fb01_15 training room should be selectable");
assert(trainingRoom.event.encounterNames.includes("\u674e\u6559\u5934"), "fb01_15 should expose Li instructor from NPC evidence");

const craftingRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
  initialPlayer: {
    ...flow.playerSeed,
    inventory: {
      chunjie5: 1,
      chunjie7: 1,
    },
  },
});
const chefCraft = craftingRuntime.interactWithChapterNpc("fb01r18_1", "custom_caozuo");
assert(chefCraft.accepted, "chef custom operation should be accepted for hecheng114");
assert(chefCraft.event.sideEffects.some((effect) => effect.resultId === "hecheng114" && effect.status === "applied_item_crafting_recipe"), "hecheng114 should apply recipe side effect");
assert(craftingRuntime.snapshot().player.inventory.chunjie5 === 0, "hecheng114 should consume chunjie5");
assert(craftingRuntime.snapshot().player.inventory.chunjie7 === 0, "hecheng114 should consume chunjie7");
assert(craftingRuntime.snapshot().player.inventory.chunjie20celue === 1, "hecheng114 should grant chunjie20celue");

const combatTriggerRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
const captureRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
  initialPlayer: {
    ...flow.playerSeed,
    inventory: {
      xuan1: 1,
    },
  },
});
const captureYin = captureRuntime.interactWithChapterNpc("fb01r16_3", "custom_caozuo");
assert(captureYin.accepted, "Yin Quanan capture operation should be accepted");
const captureEffect = captureYin.event.sideEffects.find((effect) => effect.resultId === "compare");
assert(captureEffect?.status === "resolved_compare_via_comparewin_branch", "compare should resolve through same NPC comparewin branch when itemdayu3 is satisfied");
assert(captureEffect.followupSideEffects.some((effect) => effect.resultId === "npcset1" && effect.status === "applied_player_marker"), "comparewin followup should apply npcset1 marker");
assert(captureEffect.followupSideEffects.some((effect) => effect.resultId === "delete" && effect.status === "applied_hide_self"), "comparewin followup should delete Yin after capture");
assert(captureYin.event.feedback.includes("\u6210\u529f"), "comparewin followup narrative should be visible after capture");

const inheritedCombat = combatTriggerRuntime.interactWithChapterNpc("fb01r41_1", "custom_caozuo");
assert(inheritedCombat.accepted, "inheritance combat trigger should be accepted");
assert(inheritedCombat.event.sideEffects.some((effect) => effect.resultId === "inattack201" && effect.status === "resolved_inheritance_combat_via_autotext"), "inattack201 should resolve to restored autotext202 narrative result");
assert(inheritedCombat.event.feedbackLines.length > 0, "inattack201 autotext narrative should be visible in interaction feedback");
const revengeCombat = combatTriggerRuntime.interactWithChapterNpc("fb01r42_1", "custom_caozuo");
assert(revengeCombat.accepted, "second inheritance combat trigger should be accepted");
assert(revengeCombat.event.sideEffects.some((effect) => effect.resultId === "inattack202" && effect.status === "resolved_inheritance_combat_via_autotext"), "inattack202 should resolve to restored autotext203 narrative result");

const skillRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
  initialPlayer: {
    ...flow.playerSeed,
    potential: 20,
    skillLevels: { yiqigong: 0 },
    skillExp: {},
  },
});
const zhuYuPractice = skillRuntime.interactWithChapterNpc("fb01r05_1", "custom_caozuo");
assert(zhuYuPractice.accepted, "Zhu Yu custom operation should be accepted");
assert(zhuYuPractice.event.sideEffects.some((effect) => effect.resultId === "skillexp11" && effect.status === "applied_skill_exp_delta"), "skillexp11 should apply skill exp delta");
assert(skillRuntime.snapshot().player.skillExp.yiqigong === 15, "skillexp11 should add 15 exp to yiqigong");

const markerRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
const letterQuest = markerRuntime.interactWithChapterNpc("fb01r16_2", "present");
assert(letterQuest.accepted, "Li teacher present branch should be accepted");
assert(letterQuest.event.sideEffects.some((effect) => effect.resultId === "quest1000" && effect.status === "applied_player_time_marker"), "quest1000 should apply player time marker");
assert(markerRuntime.snapshot().player.timeMarkers["送信任务"] === "1", "quest1000 should set 送信任务=1");
const timedVisit = markerRuntime.interactWithChapterNpc("bfr25_1a", "talk");
assert(timedVisit.accepted, "Wang Xiao talk branch should be accepted");
assert(timedVisit.event.sideEffects.some((effect) => effect.resultId === "bftimebj1" && effect.status === "applied_player_timed_marker"), "bftimebj1 should apply player timed marker");
assert(markerRuntime.snapshot().player.timedMarkers["拜访任务102"]?.value === "0", "bftimebj1 should set 拜访任务102 timed value to 0");
assert(timedVisit.event.sideEffects.some((effect) => effect.resultId === "bfzhengji1" && effect.status === "skipped_official_merit_official_type_gate"), "bfzhengji1 should record a merit ledger attempt but respect officialType=0");
assert(markerRuntime.snapshot().player.meritLedger.some((entry) => entry.resultId === "bfzhengji1" && entry.delta === 20 && entry.usedDefaultDelta === true), "bfzhengji1 should use CommonResults default merit delta 20 in ledger");

const meritRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
  initialPlayer: {
    ...flow.playerSeed,
    officialType: 1,
    officialAchievement: 100,
    meritLedger: [],
  },
});
const meritVisit = meritRuntime.interactWithChapterNpc("bfr25_1a", "talk");
assert(meritVisit.accepted, "official Wang Xiao talk branch should be accepted");
assert(meritVisit.event.sideEffects.some((effect) => effect.resultId === "bfzhengji1" && effect.status === "applied_official_merit_delta"), "bfzhengji1 should apply official merit when officialType is enabled");
assert(meritRuntime.snapshot().player.officialAchievement === 120, "official merit should add dispatcher default delta 20");
assert(meritRuntime.snapshot().player.meritLedger.some((entry) => entry.resultId === "bfzhengji1" && entry.total === 120 && entry.sourceFile.includes("CommonResults.lua")), "merit ledger must preserve dispatcher evidence source");

const seasonalRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
const seasonalTalk = seasonalRuntime.interactWithChapterNpc("fb01r01_1b", "talk");
assert(seasonalTalk.accepted, "seasonal-only old steward talk action should fall back to non-seasonal feedback instead of a dead branch");
assert(!seasonalTalk.event.resultTokens.includes("bainianweituo"), "bainianweituo must be hidden from normal first-session branch execution");
assert(!seasonalTalk.event.sideEffects.some((effect) => effect.resultId === "bainianweituo"), "disabled seasonal module must not execute a bainianweituo side effect");

const storyRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
  initialPlayer: {
    ...flow.playerSeed,
    sectId: "tangmen",
    inheritableMarkers: {
      "唐门内功进修": 0,
    },
  },
});
const tangStory = storyRuntime.interactWithChapterNpc("tmnpc01b", "custom_caozuo");
assert(tangStory.accepted, "Tang Zhu story operation should be accepted");
assert(tangStory.event.sideEffects.some((effect) => effect.resultId === "tmstory01" && effect.status === "applied_story_dialogue_feedback"), "tmstory01 should enter story dialogue feedback pipeline");
assert(tangStory.event.feedbackLines.some((line) => line.includes("唐竹")), "tmstory01 feedback should expose restored Tang Zhu story text");
const tangRepeatGate = storyRuntime.interactWithChapterNpc("tmnpc01c", "custom_caozuo");
assert(tangRepeatGate.accepted, "Tang Zhu follow-up operation should resolve from marker-driven config");
assert(tangRepeatGate.event.sideEffects.some((effect) => effect.resultId === "tmstory02" && effect.status === "applied_story_dialogue_feedback"), "Tang Zhu follow-up must continue into the configured second story result while the marker is below one");
const tangCompletedRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
  initialPlayer: {
    ...flow.playerSeed,
    sectId: "tangmen",
    inheritableMarkers: {
      "唐门内功进修": 1,
    },
  },
});
const tangCompletedGate = tangCompletedRuntime.interactWithChapterNpc("tmnpc01c", "custom_caozuo");
assert(tangCompletedGate.accepted, "Tang Zhu completed-marker branch should remain interactable");
assert(tangCompletedGate.event.feedbackLines.some((line) => line.includes("已经找我进修过")), "Tang Zhu completed marker must select the configured restriction text");
const tangNonMemberRuntime = createFirstSessionRuntime(flow, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
const tangNonMemberGate = tangNonMemberRuntime.interactWithChapterNpc("tmnpc01b", "custom_caozuo");
assert(tangNonMemberGate.accepted, "Tang Zhu non-member branch should remain interactable");
assert(tangNonMemberGate.event.feedbackLines.some((line) => line.includes("不是唐门弟子")), "Tang Zhu non-member branch must select the configured sect restriction dialogue");

const output = {
  generatedAt: new Date().toISOString(),
  passed: true,
  finalState: snapshot.currentState,
  finalExperience: snapshot.player.experience,
  finalPotential: snapshot.player.potential,
  events: snapshot.events.map((event) => ({
    type: event.type,
    actionId: event.actionId,
    feedback: event.feedback || "",
  })),
};

const outputDir = path.join(root, "outputs", "idlewuxia_migration");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "wuxia_first_session_interaction_test.json"), JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify({
  passed: output.passed,
  finalState: output.finalState,
  finalExperience: output.finalExperience,
  finalPotential: output.finalPotential,
  events: output.events.length,
}, null, 2));

