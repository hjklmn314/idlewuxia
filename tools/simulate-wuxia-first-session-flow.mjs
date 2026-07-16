import fs from "node:fs";
import path from "node:path";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_flow.json"), "utf8"));
const screen = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_screen_contract.json"), "utf8"));
const outputDir = path.join(root, "outputs", "idlewuxia_migration");
fs.mkdirSync(outputDir, { recursive: true });

const runtime = createFirstSessionRuntime(config, {
  initialState: screen.defaultStartState,
  initialFlags: screen.defaultStartFlags,
});
const trace = [];

const goldenPath = [
  "ACTION_FS_001_ORIGIN_SCHOLAR",
  "ACTION_FS_001_ORIGIN_RESULT_CONTINUE",
  "ACTION_FS_002_TITLE_START",
  "ACTION_FS_003_CHARACTER_STATUS",
  "ACTION_FS_004_IDLE_CONFIRM",
  "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
  "ACTION_FS_005_LOCKED_EXP_1000",
  "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE",
  "ACTION_FS_007_CHAPTER_CARD_ENTRY",
  "ACTION_FS_008_MAP_EXPLORE",
  "ACTION_FS_009_EARLY_COMBAT",
  "ACTION_FS_010_NPC_INTERACTION",
  "ACTION_FS_011_CHAPTER_LOOP_RETURN",
];

for (const actionId of goldenPath) {
  const before = runtime.snapshot();
  const result = runtime.dispatch(actionId);
  trace.push({
    actionId,
    fromState: before.currentState,
    screenId: before.state?.screenId || "",
    accepted: result.accepted,
    reason: result.event?.reason || "ok",
    feedback: result.event?.feedback || "",
    toState: result.snapshot.currentState,
    experience: result.snapshot.player?.experience,
    potential: result.snapshot.player?.potential,
  });
}

const firstPlayableNode = config.chapter1.nodes[0];
if (firstPlayableNode) {
  trace.push({
    actionId: "ACTION_SELECT_CHAPTER1_FIRST_NODE",
    fromState: runtime.snapshot().currentState,
    serverCommand: "chapter.selectNode",
    nodeId: firstPlayableNode.nodeId,
    accepted: true,
    gates: firstPlayableNode.gates,
    sourceRooms: firstPlayableNode.sourceRooms,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  finalState: runtime.snapshot().currentState,
  flags: runtime.snapshot().flags,
  player: runtime.snapshot().player,
  trace,
  summary: {
    actions: trace.filter((event) => event.actionId?.startsWith("ACTION_FS_")).length,
    rejected: trace.filter((event) => event.accepted === false && !event.actionId.includes("LOCKED")).length,
    expectedRejected: trace.filter((event) => event.accepted === false && event.actionId.includes("LOCKED")).length,
    chapter1NodesAvailable: config.chapter1.nodes.length,
  },
};

fs.writeFileSync(path.join(outputDir, "wuxia_first_session_flow_simulation.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.rejected > 0) process.exit(1);
