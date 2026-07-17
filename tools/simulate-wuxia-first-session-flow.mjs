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

const scenario = [
  { actionId: "ACTION_FS_001_ORIGIN_SCHOLAR", expectedAccepted: true },
  { actionId: "ACTION_FS_001_ORIGIN_RESULT_CONTINUE", expectedAccepted: true },
  { actionId: "ACTION_FS_002_TITLE_START", expectedAccepted: true },
  { actionId: "ACTION_FS_003_CHARACTER_STATUS", expectedAccepted: true },
  { actionId: "ACTION_FS_004_IDLE_CONFIRM", expectedAccepted: true },
  { actionId: "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH", expectedAccepted: true },
  {
    actionId: "ACTION_FS_005_LOCKED_EXP_1000",
    expectedAccepted: false,
    expectedReasonIncludes: "experience requires 1000",
  },
  { actionId: "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE", expectedAccepted: true },
  { actionId: "ACTION_FS_007_CHAPTER_CARD_ENTRY", expectedAccepted: true },
  { actionId: "ACTION_FS_008_MAP_EXPLORE", expectedAccepted: true },
  { actionId: "ACTION_FS_009_EARLY_COMBAT", expectedAccepted: true },
  // Combat resolution returns to the map. Enter a configured NPC node through
  // the real ActionRoute before exercising the last two first-session states.
  { actionId: "ACT_CH1_SELECT_OWNER_WING", expectedAccepted: true },
  { actionId: "ACTION_FS_010_NPC_INTERACTION", expectedAccepted: true },
  { actionId: "ACTION_FS_011_CHAPTER_LOOP_RETURN", expectedAccepted: true },
];

for (const step of scenario) {
  const { actionId } = step;
  const before = runtime.snapshot();
  const result = runtime.dispatch(actionId);
  const reason = result.event?.reason || "ok";
  const acceptedMatches = result.accepted === step.expectedAccepted;
  const reasonMatches = !step.expectedReasonIncludes || reason.includes(step.expectedReasonIncludes);
  trace.push({
    actionId,
    fromState: before.currentState,
    screenId: before.state?.screenId || "",
    expectedAccepted: step.expectedAccepted,
    expectedReasonIncludes: step.expectedReasonIncludes || "",
    accepted: result.accepted,
    reason,
    matchesExpected: acceptedMatches && reasonMatches,
    feedback: result.event?.feedback || "",
    toState: result.snapshot.currentState,
    experience: result.snapshot.player?.experience,
    potential: result.snapshot.player?.potential,
  });
}

const expectedRejectedActionIds = trace
  .filter((event) => event.expectedAccepted === false && event.accepted === false && event.matchesExpected)
  .map((event) => event.actionId);
const unexpectedRejectedActionIds = trace
  .filter((event) => event.expectedAccepted === true && event.accepted === false)
  .map((event) => event.actionId);
const unexpectedAcceptedActionIds = trace
  .filter((event) => event.expectedAccepted === false && event.accepted === true)
  .map((event) => event.actionId);
const mismatchedActionIds = trace
  .filter((event) => !event.matchesExpected)
  .map((event) => event.actionId);

const report = {
  schema: "idlewuxia.first_session_flow_simulation.v2",
  generatedAt: new Date().toISOString(),
  scenarioId: "first_session_to_npc_loop_with_locked_probe",
  finalState: runtime.snapshot().currentState,
  flags: runtime.snapshot().flags,
  player: runtime.snapshot().player,
  trace,
  summary: {
    actions: trace.length,
    accepted: trace.filter((event) => event.accepted === true).length,
    rejected: unexpectedRejectedActionIds.length,
    expectedRejected: expectedRejectedActionIds.length,
    mismatches: mismatchedActionIds.length,
    expectedRejectedActionIds,
    unexpectedRejectedActionIds,
    unexpectedAcceptedActionIds,
    mismatchedActionIds,
    chapter1NodesAvailable: config.chapter1.nodes.length,
  },
};

fs.writeFileSync(path.join(outputDir, "wuxia_first_session_flow_simulation.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.mismatches > 0) process.exit(1);
