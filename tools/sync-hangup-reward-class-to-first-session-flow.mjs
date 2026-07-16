import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const summaryPath = path.join(
  root,
  "fangzhijianghu",
  "outputs",
  "client_runtime_sync_contract_20260627",
  "client_runtime_smoke",
  "client_runtime_summary.json",
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const flow = readJson(flowPath);
const summary = readJson(summaryPath);
const reward = summary.final_state?.last_reward;

if (!reward?.award_class || !Array.isArray(reward.expanded_reward_rows)) {
  throw new Error("client_runtime_summary.json does not expose an expanded hangup reward class.");
}

flow.rewardAttributeMap = {
  ...(flow.rewardAttributeMap || {}),
  exp: "experience",
  pot: "potential",
  money: "money",
};

flow.rewardClasses = {
  ...(flow.rewardClasses || {}),
  [reward.award_class]: {
    rewardClassId: reward.award_class,
    taskId: reward.task_id || "",
    rewardMode: reward.reward_mode || "",
    autoAwardClass: reward.auto_award_class || "",
    rows: reward.expanded_reward_rows.map((row) => ({
      awardRowId: row.AwardRowId || "",
      rewardAttrName: row.RewardAttrName || "",
      calculationPolicy: row.CalculationPolicy || "",
      baseAward: Number(row.BaseAward || 0),
      evidenceLevel: row.EvidenceLevel || "unknown",
    })),
    sourceEvidence: {
      level: "cross_source_confirmed",
      source: "fangzhijianghu/outputs/client_runtime_sync_contract_20260627/client_runtime_smoke/client_runtime_summary.json",
      record: `award_class=${reward.award_class};task_id=${reward.task_id || ""}`,
      sourceEvidence: "res/script/HangUpTask/hangUpTaskConfig.lua|res/script/HangUpTask/hangUpTaskRewardConfig.lua",
    },
  },
};

const action = (flow.actions || []).find((item) => item.actionId === "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH");
if (!action) throw new Error("ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH not found.");

const taskPatch = { ...(action.responseModel?.taskPatch || {}) };
delete taskPatch.completedClicks;
action.responseModel = {
  ...(action.responseModel || {}),
  taskPatch,
  rewardClassId: reward.award_class,
  rewardMode: reward.reward_mode || "click_work",
  taskCounterDeltas: {
    ...(action.responseModel?.taskCounterDeltas || {}),
    completedClicks: 1,
  },
};
delete action.responseModel.statDeltas;
action.evidence = {
  level: "cross_source_confirmed",
  source: "fangzhijianghu/outputs/client_runtime_sync_contract_20260627/client_runtime_smoke/client_runtime_summary.json",
  record: `taskId=${reward.task_id || ""};awardClass=${reward.award_class}`,
  sourceEvidence: "res/script/HangUpTask/hangUpTaskConfig.lua|res/script/HangUpTask/hangUpTaskRewardConfig.lua|res/script/HangUpTask/hangUpTaskTextConfig.lua",
};

writeJson(flowPath, flow);

const output = {
  generatedAt: new Date().toISOString(),
  rewardClassId: reward.award_class,
  taskId: reward.task_id || "",
  rows: flow.rewardClasses[reward.award_class].rows.length,
  appliedToAction: action.actionId,
};
const outDir = path.join(root, "outputs", "wuxia_first_session_contract_sync");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "hangup_reward_class_sync_summary.json"), JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify(output, null, 2));
