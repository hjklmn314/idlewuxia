import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const screenPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function roomExploreBlock(overrides = {}) {
  return {
    type: "roomExplore",
    defaultRoomId: "fb01_01a",
    presenceLabel: "这里有：",
    emptyPresenceText: "啥也没有",
    roomHint: "选择出口移动，选择人物交互。",
    missingRoomText: "房间配置缺失",
    directionLabels: {
      up: "上",
      down: "下",
      left: "左",
      right: "右",
    },
    logLines: ["你进入了{roomName}。"],
    ...overrides,
  };
}

const screen = readJson(screenPath);
screen.screens = screen.screens || {};

screen.screens.UI_MapExplore = {
  ...(screen.screens.UI_MapExplore || {}),
  mode: "mapExplore",
  title: "石路",
  nav: {
    left: "状态",
    center: "石路",
    right: "离开",
  },
  body: [roomExploreBlock()],
  primaryText: "",
  primaryActionId: "",
  navActions: {
    left: "ACTION_FS_008_MAP_EXPLORE_BACK_TO_CHAPTER",
    right: "ACTION_FS_008_MAP_EXPLORE_LEAVE",
  },
};

screen.screens.UI_ChapterLoop = {
  ...(screen.screens.UI_ChapterLoop || {}),
  mode: "mapExplore",
  title: "石路",
  nav: {
    left: "状态",
    center: "石路",
    right: "离开",
  },
  body: [
    roomExploreBlock({
      logLines: ["你继续在{roomName}附近探索。"],
    }),
  ],
  primaryText: "",
  primaryActionId: "",
  navActions: {
    left: "ACTION_FS_011_CHAPTER_LOOP_STATUS",
    right: "ACTION_FS_011_CHAPTER_LOOP_LEAVE",
  },
};

writeJson(screenPath, screen);

console.log(JSON.stringify({
  updated: true,
  screens: ["UI_MapExplore", "UI_ChapterLoop"],
  bodyType: "roomExplore",
  defaultRoomId: "fb01_01a",
}, null, 2));
