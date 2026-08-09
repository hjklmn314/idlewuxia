import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));

flow.chapterSystem ||= {};
flow.chapterSystem.combatActionPolicies ||= {};
flow.chapterSystem.combatActionPolicies.compete = {
  actionType: "compete",
  startActionId: "ACTION_FS_008_MAP_EXPLORE",
  resolveActionId: "ACTION_FS_009_EARLY_COMBAT",
  successConditionToken: "comparewin",
  failureConditionToken: "comparelose",
  runawayConditionToken: "comparerunaway",
  encounterId: "encounter_first_session_old_steward",
  previewId: "first_session_old_steward",
  runtimeMode: "manual_player_turns",
  autoResolveOnFinish: true,
  maxSteps: 256,
  resolutionPolicy: "combat_result_then_condition_dispatch",
  evidence: {
    level: "lua_confirmed",
    source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/src/app/models/map/MapHandle/Modules/CommonModule/FightResult.lua",
    record: "主动切磋:436-517",
    claim: "切磋先进入战斗，胜负或逃跑后再执行对应条件结果。",
  },
};

flow.chapterSystem.combatResultPolicies = {
  compare: {
    resultId: "compare",
    allowedSourceIds: ["fb01r16_3"],
    allowedActionTypes: ["custom_caozuo"],
    startActionId: "ACTION_FS_008_MAP_EXPLORE",
    resolveActionId: "ACTION_FS_009_EARLY_COMBAT",
    encounterId: "encounter_fb01_capture_yin_quanan",
    previewId: "fb01_capture_yin_quanan",
    sceneTheme: "wuxia_courtyard_rain",
    runtimeMode: "manual_player_turns",
    autoResolveOnFinish: true,
    maxSteps: 256,
    successConditionToken: "comparewin",
    failureConditionToken: "comparelose",
    runawayConditionToken: "comparerunaway",
    outcomeResultTokens: { success: [], failure: [], runaway: [] },
    startFeedbackLines: ["你拦住尹全安，准备将其缉拿归案。"],
    resolutionPolicy: "terminal_combat_result_then_configured_outcome_dispatch",
    evidence: {
      level: "lua_confirmed",
      source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapConditionAndResult/fb01.lua",
      record: "fb01r16_3: compare -> comparewin",
      claim: "抓捕先进入真实战斗；仅胜利后执行 comparewin 分支中的任务标记、文本和删除自身。",
    },
  },
  inattack201: {
    resultId: "inattack201",
    allowedSourceIds: ["fb01r41_1"],
    allowedActionTypes: ["custom_caozuo"],
    startActionId: "ACTION_FS_008_MAP_EXPLORE",
    resolveActionId: "ACTION_FS_009_EARLY_COMBAT",
    encounterId: "encounter_fb01_inner_demon",
    previewId: "fb01_inner_demon",
    sceneTheme: "wuxia_inner_demon",
    runtimeMode: "manual_player_turns",
    autoResolveOnFinish: true,
    maxSteps: 256,
    outcomeResultTokens: { success: ["inattack201"], failure: [], runaway: [] },
    startFeedbackLines: ["心魔化形逼近，你必须正面迎战。"],
    resolutionPolicy: "terminal_combat_result_then_configured_outcome_dispatch",
    evidence: {
      level: "lua_confirmed",
      source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapConditionAndResult/fb01.lua",
      record: "fb01r41_1: inattack201 -> autotext202 -> inend",
      claim: "传承战斗胜利后才执行 autotext202 并设置 inend 战斗标记。",
    },
  },
  inattack202: {
    resultId: "inattack202",
    allowedSourceIds: ["fb01r42_1"],
    allowedActionTypes: ["custom_caozuo"],
    startActionId: "ACTION_FS_008_MAP_EXPLORE",
    resolveActionId: "ACTION_FS_009_EARLY_COMBAT",
    encounterId: "encounter_fb01_nightmare",
    previewId: "fb01_nightmare",
    sceneTheme: "wuxia_nightmare",
    runtimeMode: "manual_player_turns",
    autoResolveOnFinish: true,
    maxSteps: 256,
    outcomeResultTokens: { success: ["inattack202"], failure: [], runaway: [] },
    startFeedbackLines: ["梦魇显出仇敌之形，你拔剑迎战。"],
    resolutionPolicy: "terminal_combat_result_then_configured_outcome_dispatch",
    evidence: {
      level: "lua_confirmed",
      source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapConditionAndResult/fb01.lua",
      record: "fb01r42_1: inattack202 -> autotext203 -> inend",
      claim: "梦魇战斗胜利后才执行 autotext203 并设置 inend 战斗标记。",
    },
  },
};

const resolveAction = (flow.actions || []).find((action) => action.actionId === "ACTION_FS_009_EARLY_COMBAT");
if (!resolveAction) throw new Error("ACTION_FS_009_EARLY_COMBAT is missing");
resolveAction.responseModel ||= {};
resolveAction.responseModel.resolvePendingCombat = true;
resolveAction.responseModel.combatOutcome = "success";
resolveAction.responseModel.combatOutcomePolicy = "configured_timeline_result_then_map_refresh";
resolveAction.responseModel.nextState = "STATE_FS_008_MAP_EXPLORE";
resolveAction.toState = "STATE_FS_008_MAP_EXPLORE";
resolveAction.acceptance = "自动战斗时间线结束后执行配置的战斗结果和地图刷新；玩家界面不得出现继续/确认结算按钮。";
resolveAction.evidence = {
  level: "lua_confirmed",
  source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/src/app/models/map/MapHandle/Modules/CommonModule/FightResult.lua",
  record: "主动切磋:436-517",
  claim: "FightResult 回调先结算切磋胜负与条件结果，再刷新当前地图；录屏中的 NPC 菜单不是战斗结算的强制下一屏。",
};

fs.writeFileSync(flowPath, `${JSON.stringify(flow, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  flowPath,
  policies: Object.keys(flow.chapterSystem.combatActionPolicies),
  resultPolicies: Object.keys(flow.chapterSystem.combatResultPolicies),
  resolveActionId: resolveAction.actionId,
  resolvePendingCombat: resolveAction.responseModel.resolvePendingCombat,
}, null, 2));
