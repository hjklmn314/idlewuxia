import fs from "node:fs";
import path from "node:path";

const root = process.env.IDLEWUXIA_REPAIR_ROOT
  ? path.resolve(process.env.IDLEWUXIA_REPAIR_ROOT)
  : process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const screenPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function byId(list, field, id) {
  return list.find((item) => item?.[field] === id);
}

function removeById(list, field, id) {
  const index = list.findIndex((item) => item?.[field] === id);
  if (index >= 0) list.splice(index, 1);
}

function ensureAction(action) {
  if (!byId(flow.actions, "actionId", action.actionId)) flow.actions.push(action);
}

function ensureOrReplaceAction(action) {
  const index = flow.actions.findIndex((item) => item?.actionId === action.actionId);
  if (index >= 0) flow.actions[index] = { ...flow.actions[index], ...action };
  else flow.actions.push(action);
}

function supplementalLuaSources(...sourceFiles) {
  return {
    sourceRole: "supplemental",
    sources: sourceFiles.map((sourceFile) => ({
      sourceFile,
      sourceRecord: "",
      sourceKind: "lua",
    })),
  };
}

const flow = readJson(flowPath);
const screens = readJson(screenPath);

flow.sourceFiles = {
  ...(flow.sourceFiles || {}),
  fb01_map_room_lua:
    "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapRoom/fb01.lua",
  fb01_map_role_lua:
    "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapRole/fb01.lua",
  fb01_map_role_base_lua:
    "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapRoleBase/fb01.lua",
  hangup_task_config_lua:
    "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/HangUpTask/hangUpTaskConfig.lua",
  hangup_task_text_config_lua:
    "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/HangUpTask/hangUpTaskTextConfig.lua",
};

removeById(flow.states, "stateId", "STATE_FS_006_SECT_HOME");
removeById(flow.actions, "actionId", "ACTION_FS_006_SECT_HOME");

const chapterCardState = byId(flow.states, "stateId", "STATE_FS_007_CHAPTER_CARD_ENTRY");
if (chapterCardState) {
  chapterCardState.requiredState = "idle_reward_claimed";
  chapterCardState.evidence = {
    level: "cross_source_confirmed",
    source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_runtime_contract.json",
    record: "NODE_FB01_OUTER_GATE",
    sourceEvidence: supplementalLuaSources(
      "res/script/map/mapRoom/fb01.lua",
      "res/script/map/mapRole/fb01.lua",
      "res/script/map/mapRoleBase/fb01.lua",
    ),
  };
}

for (const actionId of [
  "ACTION_FS_001_ORIGIN_WUXUE",
  "ACTION_FS_001_ORIGIN_MERCHANT",
  "ACTION_FS_001_ORIGIN_ORPHAN",
]) {
  const action = byId(flow.actions, "actionId", actionId);
  const origin = action?.requestPayload?.origin || "";
  if (!action) continue;
  const safeCopy = `你选择了${origin}。\n英雄不问出生，这位无名少女的江湖路开始了。`;
  action.responseModel.profilePatch.originFeedback = safeCopy;
  action.responseModel.feedback = safeCopy;
  action.evidence = {
    level: "recording_observed_label_only",
    source: "fangzhijianghu/outputs/competitor_recording_first_session_package_20260625/first_session_runtime_package.json",
    note: "Only the option label is currently confirmed. Product UI must not expose audit placeholder text.",
  };
}

const originContinue = byId(flow.actions, "actionId", "ACTION_FS_001_ORIGIN_RESULT_CONTINUE");
if (originContinue) {
  originContinue.responseModel.feedback = "";
}

const startIdle = byId(flow.actions, "actionId", "ACTION_FS_004_IDLE_CONFIRM");
if (startIdle) {
  startIdle.responseModel.taskPatch = {
    activeTaskId: "10001",
    completedClicks: 0,
  };
  startIdle.responseModel.feedback = "你懵懵懂懂，来到池塘边打鱼。";
  startIdle.evidence = {
    level: "config_confirmed",
    source:
      "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/HangUpTask/hangUpTaskTextConfig.lua",
    record: "taskId=10001,taskType=1",
  };
}

const fishClick = byId(flow.actions, "actionId", "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
if (fishClick) {
  fishClick.requestPayload.taskId = "10001";
  fishClick.responseModel.taskPatch = { completedClicks: 1 };
  fishClick.responseModel.feedback =
    "你一竿子下去，正中鱼儿的脑门，今天的晚饭有着落了。\n获得经验 200、潜能 200。";
  fishClick.evidence = {
    level: "config_confirmed",
    sources: [
      {
        sourceFile:
          "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/HangUpTask/hangUpTaskConfig.lua",
        sourceRecord: "hangUpTaskConfig[10001]",
        sourceKind: "lua",
      },
      {
        sourceFile:
          "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/HangUpTask/hangUpTaskTextConfig.lua",
        sourceRecord: "hangUpTaskTextConfig[id=3]",
        sourceKind: "lua",
      },
    ],
  };
}

const continueAction = byId(flow.actions, "actionId", "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE");
if (continueAction) {
  continueAction.toState = "STATE_FS_007_CHAPTER_CARD_ENTRY";
  continueAction.requestPayload = {
    requiredState: "idle_task_started",
    minimumTaskValues: {
      completedClicks: 1,
    },
  };
  continueAction.failureFeedback = "先完成一次池边打鱼。";
  continueAction.responseModel.grantState = "idle_reward_claimed";
  continueAction.responseModel.feedback = "你收起鱼竿，准备前往金牛武馆。";
  continueAction.evidence = {
    level: "cross_source_confirmed",
    sources: [
      {
        sourceFile: "fangzhijianghu/outputs/chapter1_progression_gate_package_20260628/chapter1_hangup_task_runtime.csv",
        sourceRecord: "TaskId=10001",
        sourceKind: "project_generated",
      },
      {
        sourceFile: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_nodes.csv",
        sourceRecord: "NODE_FB01_OUTER_GATE",
        sourceKind: "project_generated",
      },
    ],
  };
}

ensureAction({
    actionId: "ACTION_FS_005_IDLE_TASK_LIST_BACK",
    fromState: "STATE_FS_005_IDLE_TASK_LIST",
    input: "tap_back",
    displayText: {
      zhCN: "返回状态页",
      rawCompetitorText: "返回",
    },
    serverCommand: "idle_task.close_task_list",
    requestPayload: {
      requiredState: "idle_task_started",
    },
    responseModel: {
      feedback: "返回状态页。",
      visualCueIds: ["cue_return_character_status"],
    },
    toState: "STATE_FS_003_CHARACTER_STATUS",
    acceptance: "任务列表顶部返回按钮必须有反馈并回到角色状态页。",
    evidence: {
      level: "design_proposal",
      source: "config/wuxia_first_session_screen_contract.json",
      record: "UI_IdleTaskList.navActions.left",
    },
  });

ensureAction({
    actionId: "ACTION_FS_007_CHAPTER_CARD_ENTRY_BACK",
    fromState: "STATE_FS_007_CHAPTER_CARD_ENTRY",
    input: "tap_back",
    displayText: {
      zhCN: "返回任务列表",
      rawCompetitorText: "返回",
    },
    serverCommand: "chapter_entry.back_to_idle_tasks",
    requestPayload: {
      requiredState: "idle_reward_claimed",
    },
    responseModel: {
      feedback: "返回任务列表。",
      visualCueIds: ["cue_return_task_list"],
    },
    toState: "STATE_FS_005_IDLE_TASK_LIST",
    acceptance: "章节入口顶部返回按钮必须回到上一层任务列表，而不是失效。",
    evidence: {
      level: "design_proposal",
      source: "config/wuxia_first_session_screen_contract.json",
      record: "UI_ChapterCardEntry.navActions.left",
    },
  });

ensureAction({
  actionId: "ACTION_FS_008_MAP_EXPLORE_BACK_TO_CHAPTER",
  fromState: "STATE_FS_008_MAP_EXPLORE",
  input: "tap_status",
  displayText: {
    zhCN: "返回章节入口",
    rawCompetitorText: "状态",
  },
  serverCommand: "chapter_map.back_to_chapter_entry",
  requestPayload: {
    requiredState: "chapter_fb01_entered",
  },
  responseModel: {
    feedback: "返回章节入口。",
    visualCueIds: ["cue_return_chapter_entry"],
  },
  toState: "STATE_FS_007_CHAPTER_CARD_ENTRY",
  acceptance: "地图页顶部状态/返回入口必须走配置 action，不允许无响应。",
  evidence: {
    level: "design_proposal",
    source: "config/wuxia_first_session_screen_contract.json",
    record: "UI_MapExplore.navActions.left",
  },
});

ensureAction({
  actionId: "ACTION_FS_008_MAP_EXPLORE_LEAVE",
  fromState: "STATE_FS_008_MAP_EXPLORE",
  input: "tap_leave",
  displayText: {
    zhCN: "离开地图",
    rawCompetitorText: "离开",
  },
  serverCommand: "chapter_map.leave_to_chapter_entry",
  requestPayload: {
    requiredState: "chapter_fb01_entered",
  },
  responseModel: {
    feedback: "离开当前地图。",
    visualCueIds: ["cue_leave_map"],
  },
  toState: "STATE_FS_007_CHAPTER_CARD_ENTRY",
  acceptance: "地图页右上离开必须走配置 action，不允许只是禁用按钮。",
  evidence: {
    level: "design_proposal",
    source: "config/wuxia_first_session_screen_contract.json",
    record: "UI_MapExplore.navActions.right",
  },
});

ensureAction({
  actionId: "ACTION_FS_010_NPC_INTERACTION_BACK_TO_MAP",
  fromState: "STATE_FS_010_NPC_INTERACTION",
  input: "tap_back",
  displayText: {
    zhCN: "返回地图",
    rawCompetitorText: "返回",
  },
  serverCommand: "npc_interaction.back_to_map",
  requestPayload: {
    requiredState: "combat_result_recorded",
  },
  responseModel: {
    feedback: "返回当前地图。",
    visualCueIds: ["cue_return_map"],
  },
  toState: "STATE_FS_008_MAP_EXPLORE",
  acceptance: "NPC 交互页顶部返回必须回到地图页。",
  evidence: {
    level: "design_proposal",
    source: "config/wuxia_first_session_screen_contract.json",
    record: "UI_NpcInteraction.navActions.left",
  },
});

ensureAction({
  actionId: "ACTION_FS_011_CHAPTER_LOOP_STATUS",
  fromState: "STATE_FS_011_CHAPTER_LOOP_RETURN",
  input: "tap_status",
  displayText: {
    zhCN: "查看状态",
    rawCompetitorText: "状态",
  },
  serverCommand: "chapter_loop.open_status",
  requestPayload: {
    requiredState: "first_session_loop_available",
  },
  responseModel: {
    feedback: "查看状态。",
    visualCueIds: ["cue_open_character_status"],
  },
  toState: "STATE_FS_003_CHARACTER_STATUS",
  acceptance: "章节回环页顶部状态入口必须可点击并回到角色状态。",
  evidence: {
    level: "design_proposal",
    source: "config/wuxia_first_session_screen_contract.json",
    record: "UI_ChapterLoop.navActions.left",
  },
});

ensureAction({
  actionId: "ACTION_FS_011_CHAPTER_LOOP_LEAVE",
  fromState: "STATE_FS_011_CHAPTER_LOOP_RETURN",
  input: "tap_leave",
  displayText: {
    zhCN: "离开章节回环",
    rawCompetitorText: "离开",
  },
  serverCommand: "chapter_loop.leave_to_chapter_entry",
  requestPayload: {
    requiredState: "first_session_loop_available",
  },
  responseModel: {
    feedback: "离开当前章节。",
    visualCueIds: ["cue_leave_chapter_loop"],
  },
  toState: "STATE_FS_007_CHAPTER_CARD_ENTRY",
  acceptance: "章节回环页右上离开必须回到章节入口。",
  evidence: {
    level: "design_proposal",
    source: "config/wuxia_first_session_screen_contract.json",
    record: "UI_ChapterLoop.navActions.right",
  },
});

const chapterCardAction = byId(flow.actions, "actionId", "ACTION_FS_007_CHAPTER_CARD_ENTRY");
if (chapterCardAction) {
  chapterCardAction.requestPayload.requiredState = "idle_reward_claimed";
  chapterCardAction.evidence = {
    level: "cross_source_confirmed",
    source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_runtime_contract.json",
    record: "NODE_FB01_OUTER_GATE",
    sourceEvidence: supplementalLuaSources(
      "res/script/map/mapRoom/fb01.lua",
      "res/script/map/mapRole/fb01.lua",
      "res/script/map/mapRoleBase/fb01.lua",
    ),
  };
}

const chapterNodeRoutes = {
  NODE_FB01_OUTER_GATE: {
    actionId: "ACT_CH1_SELECT_OUTER_GATE",
    toState: "STATE_FS_009_EARLY_COMBAT",
    label: "进入武馆外门",
    feedback: "你进入武馆外门，按房间、人物与门槛配置处理当前节点。",
    grantState: "chapter_node_outer_gate_selected",
  },
  NODE_FB01_FRONT_YARD: {
    actionId: "ACT_CH1_SELECT_FRONT_YARD",
    toState: "STATE_FS_009_EARLY_COMBAT",
    label: "进入武馆大院",
    feedback: "你进入武馆大院，按 fb01 房间链路继续推进。",
    grantState: "chapter_node_front_yard_selected",
  },
  NODE_FB01_MAIN_HALL: {
    actionId: "ACT_CH1_SELECT_MAIN_HALL",
    toState: "STATE_FS_009_EARLY_COMBAT",
    label: "挑战大厅",
    feedback: "你进入大厅挑战节点，按 fb01 张风与通关奖励配置判定。",
    grantState: "chapter_node_main_hall_selected",
  },
  NODE_FB01_OWNER_WING: {
    actionId: "ACT_CH1_SELECT_OWNER_WING",
    toState: "STATE_FS_010_NPC_INTERACTION",
    label: "查看馆主长廊",
    feedback: "你进入馆主长廊，按 NPC 与房间配置展示可交互内容。",
    grantState: "chapter_node_owner_wing_selected",
  },
  NODE_FB01_TRAINING_FIELDS: {
    actionId: "ACT_CH1_SELECT_TRAINING_FIELDS",
    toState: "STATE_FS_010_NPC_INTERACTION",
    label: "前往习武场",
    feedback: "你来到习武场，按训练支线与 NPC 配置展示交互。",
    grantState: "chapter_node_training_fields_selected",
  },
  NODE_FB01_BACKYARD_WORK: {
    actionId: "ACT_CH1_SELECT_BACKYARD_WORK",
    toState: "STATE_FS_005_IDLE_TASK_LIST",
    label: "处理后院杂务",
    feedback: "你前往后院杂务节点，按挂机任务配置进入可执行任务。",
    grantState: "chapter_node_backyard_work_selected",
  },
  NODE_FB01_SETTLEMENT_LOOP: {
    actionId: "ACT_CH1_SELECT_SETTLEMENT_LOOP",
    toState: "STATE_FS_011_CHAPTER_LOOP_RETURN",
    label: "查看结算回环",
    feedback: "你进入结算回环节点，按第一章回环与奖励配置收束当前流程。",
    grantState: "chapter_node_settlement_loop_selected",
  },
};

for (const node of flow.chapter1?.nodes || []) {
  const route = chapterNodeRoutes[node.nodeId];
  if (!route) continue;
  node.primaryAction = {
    label: {
      zhCN: route.label,
    },
    actionId: route.actionId,
    evidence: {
      level: "cross_source_confirmed",
      source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_action_routes.csv",
      record: node.nodeId,
    },
  };
  ensureOrReplaceAction({
    actionId: route.actionId,
    fromState: "STATE_FS_008_MAP_EXPLORE",
    input: "tap_chapter_node",
    displayText: {
      zhCN: route.label,
      rawCompetitorText: node.displayText?.zhCN || route.label,
    },
    serverCommand: "chapter_map.select_fb01_node",
    requestPayload: {
      requiredState: "chapter_fb01_entered",
      nodeId: node.nodeId,
    },
    responseModel: {
      grantState: "map_node_selected",
      grantStates: [route.grantState],
      feedback: route.feedback,
      visualCueIds: ["cue_chapter_node_selected"],
    },
    toState: route.toState,
    acceptance: "第一章节点进入动作必须由 fb01 房间/路由配置驱动，不能复用泛化探索按钮。",
    evidence: {
      level: "cross_source_confirmed",
      sources: [
        {
          sourceFile: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_action_routes.csv",
          sourceRecord: node.nodeId,
          sourceKind: "project_generated",
        },
        {
          sourceFile: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_nodes.csv",
          sourceRecord: node.nodeId,
          sourceKind: "project_generated",
        },
      ],
      sourceEvidence: supplementalLuaSources(
        "res/script/map/mapRoom/fb01.lua",
        "res/script/map/mapRole/fb01.lua",
        "res/script/map/mapConditionAndResult/fb01.lua",
      ),
    },
  });
}

screens.policy = {
  ...(screens.policy || {}),
  flowOrder: "lua_config_confirmed_with_recording_layout_reference",
};

const titleScreen = screens.screens?.UI_TitleStart;
if (titleScreen) {
  titleScreen.body = (titleScreen.body || []).filter((block) => block.type !== "log");
}

const idleConfirmScreen = screens.screens?.UI_IdleConfirm;
if (idleConfirmScreen) {
  idleConfirmScreen.navActions = {
    left: "ACTION_FS_004_IDLE_CANCEL",
  };
}

const idleTaskScreen = screens.screens?.UI_IdleTaskList;
if (idleTaskScreen) {
  idleTaskScreen.navActions = {
    left: "ACTION_FS_005_IDLE_TASK_LIST_BACK",
  };
  const taskRows = idleTaskScreen.body?.find((block) => block.type === "taskRows");
  if (taskRows) {
    const rows = taskRows.rows || [];
    if (!rows.some((row) => row.name === "需通关章节金牛武馆")) {
      rows.push({
        name: "需通关章节金牛武馆",
        status: "经验值 > 5000",
        reward: "未解锁",
        state: "locked",
      });
    }
    taskRows.rows = rows;
  }
}

delete screens.screens.UI_SectHome;

const chapterScreen = screens.screens?.UI_ChapterCardEntry;
if (chapterScreen) {
  chapterScreen.navActions = {
    left: "ACTION_FS_007_CHAPTER_CARD_ENTRY_BACK",
  };
  chapterScreen.nav = {
    left: "返回",
    center: "我的江湖",
    right: "",
  };
}

const mapScreen = screens.screens?.UI_MapExplore;
if (mapScreen) {
  mapScreen.primaryText = "";
  mapScreen.primaryActionId = "";
  mapScreen.navActions = {
    ...(mapScreen.navActions || {}),
    left: "ACTION_FS_008_MAP_EXPLORE_BACK_TO_CHAPTER",
    right: "ACTION_FS_008_MAP_EXPLORE_LEAVE",
  };
}

const npcScreen = screens.screens?.UI_NpcInteraction;
if (npcScreen) {
  npcScreen.navActions = {
    ...(npcScreen.navActions || {}),
    left: "ACTION_FS_010_NPC_INTERACTION_BACK_TO_MAP",
  };
}

const chapterLoopScreen = screens.screens?.UI_ChapterLoop;
if (chapterLoopScreen) {
  chapterLoopScreen.navActions = {
    ...(chapterLoopScreen.navActions || {}),
    left: "ACTION_FS_011_CHAPTER_LOOP_STATUS",
    right: "ACTION_FS_011_CHAPTER_LOOP_LEAVE",
  };
}

writeJson(flowPath, flow);
writeJson(screenPath, screens);

console.log(
  JSON.stringify(
    {
      repaired: true,
      removedState: "STATE_FS_006_SECT_HOME",
      taskId: "10001",
      continueTo: "STATE_FS_007_CHAPTER_CARD_ENTRY",
      screenRemoved: "UI_SectHome",
    },
    null,
    2,
  ),
);
