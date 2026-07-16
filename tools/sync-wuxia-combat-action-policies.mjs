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
  resolutionPolicy: "combat_result_then_condition_dispatch",
  evidence: {
    level: "lua_confirmed",
    source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/src/app/models/map/MapHandle/Modules/CommonModule/FightResult.lua",
    record: "主动切磋:436-517",
    claim: "切磋先进入战斗，胜负或逃跑后再执行对应条件结果。",
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
  resolveActionId: resolveAction.actionId,
  resolvePendingCombat: resolveAction.responseModel.resolvePendingCombat,
}, null, 2));
