import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const screenPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function upsertById(list, key, item, afterId = "") {
  const existing = list.findIndex((row) => row[key] === item[key]);
  if (existing >= 0) {
    list[existing] = item;
    return;
  }
  if (afterId) {
    const afterIndex = list.findIndex((row) => row[key] === afterId);
    if (afterIndex >= 0) {
      list.splice(afterIndex + 1, 0, item);
      return;
    }
  }
  list.push(item);
}

function recordingEvidence(record, frameSecond) {
  return {
    level: "recording_observed",
    source: "fangzhijianghu/outputs/competitor_recording_first_session_package_20260625/first_session_runtime_package.json",
    record,
    frameSecond,
  };
}

const flow = readJson(flowPath);
const screen = readJson(screenPath);

flow.playerSeed = {
  profileId: "local_new_player",
  characterId: "unnamed_girl",
  identity: "普通百姓",
  displayName: "无名少女",
  name: "无名少女",
  portraitLabel: "少侠",
  spirit: 100,
  spiritMax: 100,
  hp: 290,
  hpMax: 290,
  mp: 50,
  mpMax: 50,
  experience: 1,
  level: 1,
  money: 0,
  potential: 1,
  origin: "",
  originFeedback: "",
  source: "recording_observed",
};

screen.defaultStartState = "STATE_FS_001_OPENING_STORY";
screen.defaultStartFlags = ["new_install_or_new_save"];
screen.player = {
  identity: "普通百姓",
  name: "无名少女",
  displayName: "无名少女",
  portraitLabel: "少侠",
  stats: [
    { label: "精力", field: "spirit", maxField: "spiritMax" },
    { label: "气血", field: "hp", maxField: "hpMax", showPercent: true },
    { label: "内力", field: "mp", maxField: "mpMax" },
    { label: "经验", field: "experience" },
    { label: "等级", field: "level" },
    { label: "金钱", field: "money" },
    { label: "潜能", field: "potential" },
  ],
  bottomHint: "初来乍到，你决定先打些零工维生。",
};

const states = flow.states || [];
const openingState = states.find((state) => state.stateId === "STATE_FS_001_OPENING_STORY");
if (openingState) {
  openingState.screenId = "UI_OpeningStory";
  openingState.displayText = {
    zhCN: "开场叙事与出身选择",
    sourceQuality: "recording_observed_text",
    rawCompetitorText: "某年某日，一个宁静的小镇，有一位无名少女诞生了。",
  };
  openingState.requiredState = "new_install_or_new_save";
  openingState.grantsState = "";
}

upsertById(states, "stateId", {
  stateId: "STATE_FS_001_ORIGIN_RESULT",
  sourceStepId: "FS_001_ORIGIN_RESULT",
  screenId: "UI_OpeningOriginResult",
  stepType: "NarrativeResult",
  displayText: {
    zhCN: "出身结果",
    sourceQuality: "recording_observed_text",
    rawCompetitorText: "你出生在书香门第，家族的熏陶使得你才思敏捷，聪明伶俐。",
  },
  requiredState: "origin_selected",
  grantsState: "opening_story_seen",
  evidence: recordingEvidence("FS_001_ORIGIN_RESULT", 11),
}, "STATE_FS_001_OPENING_STORY");

if (screen.screens) {
  screen.screens.UI_OpeningStory = {
    mode: "narrative",
    title: "",
    nav: { left: "", center: "", right: "" },
    body: [
      {
        type: "story",
        lines: [
          "某年某日，",
          "一个宁静的小镇，",
          "有一位无名少女诞生了。",
          "江湖的风雨从未刮到这里。",
          "但为这个人的未来铺下了一条布满荆棘的未知道路。",
          "这位无名少女出生在：",
        ],
      },
      {
        type: "choiceList",
        choices: [
          { label: "武学世家", actionId: "ACTION_FS_001_ORIGIN_WUXUE" },
          { label: "书香门第", actionId: "ACTION_FS_001_ORIGIN_SCHOLAR" },
          { label: "商贾之家", actionId: "ACTION_FS_001_ORIGIN_MERCHANT" },
          { label: "孤儿", actionId: "ACTION_FS_001_ORIGIN_ORPHAN" },
        ],
      },
    ],
  };

  screen.screens.UI_OpeningOriginResult = {
    mode: "narrative",
    title: "",
    nav: { left: "", center: "", right: "" },
    body: [
      {
        type: "storyDynamic",
        field: "originFeedback",
        fallback: "英雄不问出生，这位无名少女的江湖路开始了。",
      },
    ],
    primaryText: "继续",
    primaryActionId: "ACTION_FS_001_ORIGIN_RESULT_CONTINUE",
  };

  screen.screens.UI_TitleStart = {
    mode: "title",
    title: "放置江湖",
    nav: { left: "", center: "", right: "设置" },
    body: [
      { type: "titleStart", subtitle: "点击开始游戏" },
      {
        type: "log",
        lines: [
          "我已阅读并同意 隐私政策 和 用户协议",
          "APP备案号：粤ICP备16064241号-4A",
        ],
      },
    ],
    primaryText: "点击开始游戏",
    primaryActionId: "ACTION_FS_002_TITLE_START",
  };

  screen.screens.UI_CharacterStatus = {
    mode: "status",
    title: "状态",
    nav: { left: "活动", center: "", right: "设置" },
    body: [
      { type: "characterStatus" },
      {
        type: "taskBanner",
        left: "任务",
        right: "啥事没有",
        actionId: "ACTION_FS_003_CHARACTER_STATUS",
      },
    ],
    primaryText: "任务",
    primaryActionId: "ACTION_FS_003_CHARACTER_STATUS",
  };

  screen.screens.UI_IdleConfirm = {
    mode: "modal",
    title: "任务",
    nav: { left: "返回", center: "任务", right: "" },
    body: [
      {
        type: "idleConfirm",
        rows: [
          ["当前任务", "池边打鱼"],
          ["任务奖励", "经验 200 / 潜能 200"],
          ["状态", "点击开始后进入当前可进行的任务列表"],
        ],
      },
    ],
    primaryText: "开始任务",
    primaryActionId: "ACTION_FS_004_IDLE_CONFIRM",
    secondaryText: "取消",
    secondaryActionId: "ACTION_FS_004_IDLE_CANCEL",
  };

  screen.screens.UI_IdleTaskList = {
    mode: "taskList",
    title: "任务",
    nav: { left: "返回", center: "任务", right: "" },
    body: [
      {
        type: "taskRows",
        rows: [
          {
            name: "池边打鱼",
            status: "当前可进行的任务",
            reward: "经验 200 / 潜能 200",
            state: "available",
            actionId: "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
          },
          {
            name: "经验值 > 1000",
            status: "未解锁",
            reward: "未解锁",
            state: "locked",
            actionId: "ACTION_FS_005_LOCKED_EXP_1000",
          },
          {
            name: "经验值 > 2000",
            status: "未解锁",
            reward: "未解锁",
            state: "locked",
            actionId: "ACTION_FS_005_LOCKED_EXP_2000",
          },
        ],
      },
    ],
    primaryText: "返回状态",
    primaryActionId: "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE",
  };
}

function originAction(actionId, origin, feedback, evidenceLevel = "recording_observed") {
  return {
    actionId,
    fromState: "STATE_FS_001_OPENING_STORY",
    toState: "STATE_FS_001_ORIGIN_RESULT",
    serverCommand: "first_session.select_origin",
    requestPayload: { origin },
    responseModel: {
      grantState: "origin_selected",
      profilePatch: {
        origin,
        originFeedback: feedback,
      },
      feedback,
      visualCueIds: ["cue_origin_selected"],
    },
    evidence: {
      level: evidenceLevel,
      source: "fangzhijianghu/outputs/competitor_recording_first_session_package_20260625/first_session_runtime_package.json",
    },
  };
}

const actions = (flow.actions || []).filter((action) => ![
  "ACTION_FS_001_OPENING_STORY",
  "ACTION_FS_005_IDLE_TASK_LIST",
  "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
  "ACTION_FS_005_LOCKED_EXP_1000",
  "ACTION_FS_005_LOCKED_EXP_2000",
  "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE",
  "ACTION_FS_004_IDLE_CANCEL",
  "ACTION_FS_001_ORIGIN_WUXUE",
  "ACTION_FS_001_ORIGIN_SCHOLAR",
  "ACTION_FS_001_ORIGIN_MERCHANT",
  "ACTION_FS_001_ORIGIN_ORPHAN",
  "ACTION_FS_001_ORIGIN_RESULT_CONTINUE",
].includes(action.actionId));

flow.actions = actions;
upsertById(flow.actions, "actionId", originAction("ACTION_FS_001_ORIGIN_WUXUE", "武学世家", "你选择了武学世家。该分支结果文本在当前录屏中未完整出现，暂按待验证处理。", "recording_observed_label_only"));
upsertById(flow.actions, "actionId", originAction("ACTION_FS_001_ORIGIN_SCHOLAR", "书香门第", "你出生在书香门第，家族的熏陶使得\n你才思敏捷，聪明伶俐。\n英雄不问出生，这位无名少女的江湖\n路开始了。"));
upsertById(flow.actions, "actionId", originAction("ACTION_FS_001_ORIGIN_MERCHANT", "商贾之家", "你选择了商贾之家。该分支结果文本在当前录屏中未完整出现，暂按待验证处理。", "recording_observed_label_only"));
upsertById(flow.actions, "actionId", originAction("ACTION_FS_001_ORIGIN_ORPHAN", "孤儿", "你选择了孤儿。该分支结果文本在当前录屏中未完整出现，暂按待验证处理。", "recording_observed_label_only"));

upsertById(flow.actions, "actionId", {
  actionId: "ACTION_FS_001_ORIGIN_RESULT_CONTINUE",
  fromState: "STATE_FS_001_ORIGIN_RESULT",
  toState: "STATE_FS_002_TITLE_START",
  serverCommand: "first_session.confirm_origin_result",
  requestPayload: { requiredState: "origin_selected" },
  responseModel: {
    grantState: "opening_story_seen",
    feedback: "请稍后...",
    visualCueIds: ["cue_loading_to_title"],
  },
  evidence: recordingEvidence("FS_001_ORIGIN_RESULT", 17),
});

const titleAction = flow.actions.find((action) => action.actionId === "ACTION_FS_002_TITLE_START");
if (titleAction) {
  titleAction.fromState = "STATE_FS_002_TITLE_START";
  titleAction.toState = "STATE_FS_003_CHARACTER_STATUS";
  titleAction.requestPayload = { requiredState: "opening_story_seen" };
  titleAction.responseModel = {
    grantState: "player_profile_created",
    feedback: "初来乍到，你决定先打些零工维生。",
    visualCueIds: ["cue_enter_character_status"],
  };
}

const statusAction = flow.actions.find((action) => action.actionId === "ACTION_FS_003_CHARACTER_STATUS");
if (statusAction) {
  statusAction.toState = "STATE_FS_004_IDLE_CONFIRM";
  statusAction.requestPayload = { requiredState: "player_profile_created" };
  statusAction.responseModel = {
    grantState: "task_entry_seen",
    feedback: "打开任务面板。",
    visualCueIds: ["cue_open_task_panel"],
  };
}

upsertById(flow.actions, "actionId", {
  actionId: "ACTION_FS_004_IDLE_CANCEL",
  fromState: "STATE_FS_004_IDLE_CONFIRM",
  toState: "STATE_FS_003_CHARACTER_STATUS",
  serverCommand: "idle_task.cancel",
  requestPayload: { requiredState: "task_entry_seen" },
  responseModel: {
    feedback: "你暂时取消了任务。",
    visualCueIds: ["cue_close_task_panel"],
  },
  evidence: recordingEvidence("FS_004_IDLE_CONFIRM", 120),
});

const idleConfirmAction = flow.actions.find((action) => action.actionId === "ACTION_FS_004_IDLE_CONFIRM");
if (idleConfirmAction) {
  idleConfirmAction.toState = "STATE_FS_005_IDLE_TASK_LIST";
  idleConfirmAction.responseModel = {
    grantState: "idle_task_started",
    taskPatch: { activeTaskId: "HANGUP_10001", completedClicks: 0 },
    feedback: "你开始了池边打鱼。",
    visualCueIds: ["cue_idle_task_started"],
  };
}

upsertById(flow.actions, "actionId", {
  actionId: "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
  fromState: "STATE_FS_005_IDLE_TASK_LIST",
  toState: "STATE_FS_005_IDLE_TASK_LIST",
  serverCommand: "idle_task.claim_once",
  requestPayload: { requiredState: "idle_task_started", taskId: "HANGUP_10001" },
  responseModel: {
    statDeltas: { experience: 200, potential: 200 },
    taskPatch: { completedClicks: 1 },
    feedback: "你完成了一次池边打鱼，获得经验 200、潜能 200。",
    visualCueIds: ["cue_idle_reward_claimed"],
  },
  evidence: recordingEvidence("FS_005_IDLE_TASK_LIST", 210),
});

upsertById(flow.actions, "actionId", {
  actionId: "ACTION_FS_005_LOCKED_EXP_1000",
  fromState: "STATE_FS_005_IDLE_TASK_LIST",
  toState: "STATE_FS_005_IDLE_TASK_LIST",
  serverCommand: "idle_task.inspect_locked",
  requestPayload: { requiredState: "idle_task_started", minimumPlayerValues: { experience: 1000 } },
  responseModel: { feedback: "经验达到 1000 后开启。", visualCueIds: ["cue_locked_task"] },
  failureFeedback: "经验不足，需经验值 > 1000。",
  evidence: recordingEvidence("FS_005_IDLE_TASK_LIST", 210),
});

upsertById(flow.actions, "actionId", {
  actionId: "ACTION_FS_005_LOCKED_EXP_2000",
  fromState: "STATE_FS_005_IDLE_TASK_LIST",
  toState: "STATE_FS_005_IDLE_TASK_LIST",
  serverCommand: "idle_task.inspect_locked",
  requestPayload: { requiredState: "idle_task_started", minimumPlayerValues: { experience: 2000 } },
  responseModel: { feedback: "经验达到 2000 后开启。", visualCueIds: ["cue_locked_task"] },
  failureFeedback: "经验不足，需经验值 > 2000。",
  evidence: recordingEvidence("FS_005_IDLE_TASK_LIST", 210),
});

upsertById(flow.actions, "actionId", {
  actionId: "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE",
  fromState: "STATE_FS_005_IDLE_TASK_LIST",
  toState: "STATE_FS_006_SECT_HOME",
  serverCommand: "idle_task.return_to_progression",
  requestPayload: { requiredState: "idle_task_started" },
  responseModel: {
    grantState: "idle_reward_claimed",
    feedback: "你回到章节推进。",
    visualCueIds: ["cue_return_to_progression"],
  },
  evidence: recordingEvidence("FS_005_IDLE_TASK_LIST", 210),
});

writeJson(flowPath, flow);
writeJson(screenPath, screen);
console.log(`Migrated ${flowPath}`);
console.log(`Migrated ${screenPath}`);
