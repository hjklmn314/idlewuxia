import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const rewardsCsvPath = path.join(root, "fangzhijianghu", "outputs", "fb01_room_chain_package_20260629", "fb01_room_rewards.csv");

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || "");
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

function numberOrZero(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
const rewards = readCsv(rewardsCsvPath);
const clearReward = rewards.find((row) => row.RewardId === "REWARD_FB01_CHAPTER_CLEAR");

if (!clearReward) {
  throw new Error(`Missing REWARD_FB01_CHAPTER_CLEAR in ${rewardsCsvPath}`);
}

flow.rewardAttributeMap = {
  ...(flow.rewardAttributeMap || {}),
  exp: "experience",
  pot: "potential",
  yueli: "yueli",
};

flow.playerSeed = {
  ...(flow.playerSeed || {}),
  yueli: Number(flow.playerSeed?.yueli || 0),
  chapterClearLedger: Array.isArray(flow.playerSeed?.chapterClearLedger) ? flow.playerSeed.chapterClearLedger : [],
};

flow.chapterSystem = flow.chapterSystem || {};
flow.chapterSystem.chapterClearPolicy = {
  schema: "idlewuxia.chapter_clear_policy.v1",
  evidenceLevel: "config_confirmed",
  chapters: {
    fb01: {
      chapterId: "fb01",
      clearSourceNodeId: "NODE_FB01_MAIN_HALL",
      clearNodeId: "NODE_FB01_SETTLEMENT_LOOP",
      clearProgressResultId: "mapbj1",
      clearFlag: "fb01_complete",
      clearStateSignal: "STATE_FS_012_CHAPTER_CLEAR",
      rewardId: "REWARD_FB01_CHAPTER_CLEAR",
      rewardDeltas: {
        experience: numberOrZero(clearReward.Exp),
        potential: numberOrZero(clearReward.Pot),
        yueli: numberOrZero(clearReward.Yueli),
      },
      evidence: {
        level: clearReward.EvidenceLevel || "config_confirmed",
        source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_rewards.csv",
        sourceEvidence: clearReward.SourceEvidence || "res/script/map/map.lua",
        projectMapping: clearReward.ProjectMapping || "chapter_clear_reward",
      },
    },
  },
};

const nextText = `${JSON.stringify(flow, null, 2)}\n`;
const oldText = fs.readFileSync(flowPath, "utf8");
if (oldText !== nextText) {
  fs.writeFileSync(flowPath, nextText, "utf8");
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  rewardId: clearReward.RewardId,
  rewardDeltas: flow.chapterSystem.chapterClearPolicy.chapters.fb01.rewardDeltas,
  wroteFile: oldText !== nextText,
}, null, 2));
