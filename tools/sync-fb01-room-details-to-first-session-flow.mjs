import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const sourcePath = path.join(root, "fangzhijianghu", "outputs", "fb01_room_chain_package_20260629", "fb01_room_nodes.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter((item) => item.length > 1 || item[0]);
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function splitPipe(value) {
  return String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const flow = readJson(flowPath);
const sourceRows = parseCsv(fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
const sourceByNode = new Map(sourceRows.map((row) => [row.NodeId, row]));
const gates = Array.isArray(flow.chapter1?.gates) ? flow.chapter1.gates : [];
const gateById = new Map(gates.map((gate) => [gate.gateId, gate]));
const rewards = Array.isArray(flow.chapter1?.rewards) ? flow.chapter1.rewards : [];
const rewardById = new Map(rewards.map((reward) => [reward.rewardId, reward]));
const syncedNodes = [];
const addedGates = [];
const addedRewards = [];

for (const node of flow.chapter1?.nodes || []) {
  const row = sourceByNode.get(node.nodeId);
  if (!row) continue;
  node.sourceRooms = splitPipe(row.SourceRooms);
  node.sourceRoomNames = splitPipe(row.SourceRoomNames);
  node.connections = splitPipe(row.Connections);
  node.gates = splitPipe(row.Gates);
  node.encounters = splitPipe(row.Encounters);
  node.interactables = splitPipe(row.Interactables);
  node.interactableNames = splitPipe(row.InteractableNames);
  node.rewards = splitPipe(row.Rewards);
  node.progressFlags = splitPipe(row.ProgressFlags);
  node.displayText = {
    ...(node.displayText || {}),
    zhCN: row.DisplayName || node.displayText?.zhCN || node.nodeId,
    rawCompetitorText: row.DisplayName || node.displayText?.rawCompetitorText || "",
  };
  node.evidence = {
    ...(node.evidence || {}),
    level: row.EvidenceLevel || node.evidence?.level || "unknown",
    source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_nodes.csv",
    record: row.NodeId,
    sourceEvidence: row.SourceEvidence || node.evidence?.sourceEvidence || "",
  };
  syncedNodes.push(node.nodeId);

  for (const gateId of node.gates || []) {
    if (gateById.has(gateId)) continue;
    const gate = {
      gateId,
      nodeId: node.nodeId,
      gateType: "fb01_node_gate",
      requirements: {
        progressFlags: node.progressFlags || [],
        sourceRooms: node.sourceRooms || [],
        encounters: node.encounters || [],
      },
      reason: "Imported from fb01 room node gate list.",
      projectPolicy: "local_gate_row_generated_from_competitor_node_contract",
      evidence: {
        level: row.EvidenceLevel || "cross_source_confirmed",
        source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_nodes.csv",
        record: row.NodeId,
        sourceEvidence: row.SourceEvidence || "",
      },
    };
    gates.push(gate);
    gateById.set(gateId, gate);
    addedGates.push(gateId);
  }

  for (const rewardId of node.rewards || []) {
    if (rewardById.has(rewardId)) continue;
    const reward = {
      rewardId,
      nodeId: node.nodeId,
      rewardType: "fb01_branch_reward_unresolved",
      amount: "",
      itemId: "",
      resolutionStatus: "reward_id_confirmed_but_amount_not_in_fb01_room_rewards",
      evidence: {
        level: row.EvidenceLevel || "cross_source_confirmed",
        source: "fangzhijianghu/outputs/fb01_room_chain_package_20260629/fb01_room_nodes.csv",
        record: row.NodeId,
        sourceEvidence: row.SourceEvidence || "",
      },
    };
    rewards.push(reward);
    rewardById.set(rewardId, reward);
    addedRewards.push(rewardId);
  }
}

flow.chapter1.gates = gates;
flow.chapter1.rewards = rewards;
writeJson(flowPath, flow);

const summary = {
  generatedAt: new Date().toISOString(),
  source: path.relative(root, sourcePath).replaceAll("\\", "/"),
  syncedNodes,
  addedGates,
  addedRewards,
  sourceRows: sourceRows.length,
};

const outDir = path.join(root, "outputs", "wuxia_first_session_contract_sync");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "fb01_room_detail_sync_summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
