import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_first_session_evidence_map");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function csvCell(value) {
  const text = Array.isArray(value)
    ? value.join("|")
    : typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName, rows, columns) {
  const text = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, fileName), `${text}\n`, "utf8");
}

function evidenceOf(row = {}) {
  const evidence = row.evidence || {};
  return {
    source: evidence.source || evidence.sourceEvidence || "",
    record: evidence.record || row.sourceStepId || row.nodeId || row.roomId || row.roleId || row.gateId || row.rewardId || "",
    level: evidence.level || row.source || "unknown",
    frameSecond: evidence.frameSecond ?? "",
    framePath: evidence.framePath || "",
  };
}

function displayNameOf(row = {}) {
  return row.displayText?.zhCN
    || row.displayText?.rawCompetitorText
    || row.label?.zhCN
    || row.name
    || row.input
    || row.stateId
    || row.actionId
    || row.nodeId
    || row.roomId
    || row.gateId
    || row.rewardId
    || "";
}

function sourceValueOf(row = {}) {
  return row.displayText?.rawCompetitorText
    || row.displayText?.zhCN
    || row.displayName?.rawCompetitorText
    || row.displayName?.zhCN
    || row.name
    || row.input
    || row.conditionText?.zhCN
    || row.rewardText?.zhCN
    || "";
}

function statusFor(evidenceLevel, implementationReady) {
  if (implementationReady && evidenceLevel && evidenceLevel !== "unknown" && evidenceLevel !== "design_proposal") {
    return "mapped_and_implemented";
  }
  if (evidenceLevel && evidenceLevel !== "unknown") return "mapped_needs_runtime_check";
  return "needs_source_evidence";
}

function pushMap(rows, domain, subjectId, row, projectField, owner, implementationReady = false, nextAction = "") {
  const evidence = evidenceOf(row);
  rows.push({
    MapId: `${domain}:${subjectId}`,
    Domain: domain,
    SubjectId: subjectId,
    DisplayName: displayNameOf(row),
    CompetitorSource: evidence.source,
    SourceRecord: evidence.record,
    EvidenceLevel: evidence.level,
    FrameSecond: evidence.frameSecond,
    FramePath: evidence.framePath,
    SourceValue: sourceValueOf(row),
    ProjectField: projectField,
    ProjectOwner: owner,
    ValidationStatus: statusFor(evidence.level, implementationReady),
    NextAction: nextAction || (evidence.level === "unknown" ? "补 Lua/配置/录屏证据" : "真实交互验收"),
  });
}

fs.mkdirSync(outDir, { recursive: true });

const flow = readJson(path.join("config", "wuxia_first_session_flow.json"));
const screens = readJson(path.join("config", "wuxia_first_session_screen_contract.json"));
const rows = [];

for (const [key, sourcePath] of Object.entries(flow.sourceFiles || {})) {
  rows.push({
    MapId: `source_file:${key}`,
    Domain: "source_file",
    SubjectId: key,
    DisplayName: key,
    CompetitorSource: sourcePath,
    SourceRecord: "",
    EvidenceLevel: "source_manifest",
    FrameSecond: "",
    FramePath: "",
    SourceValue: sourcePath,
    ProjectField: `sourceFiles.${key}`,
    ProjectOwner: "data_pipeline",
    ValidationStatus: fs.existsSync(path.join(root, sourcePath)) ? "source_exists" : "source_missing",
    NextAction: fs.existsSync(path.join(root, sourcePath)) ? "继续抽取结构化字段" : "恢复或重建源文件",
  });
}

pushMap(rows, "player_seed", flow.playerSeed?.characterId || "player_seed", flow.playerSeed || {}, "playerSeed", "data_config", true);

for (const state of flow.states || []) {
  pushMap(rows, "state", state.stateId, state, "states[].screenId/displayText/evidence", "state_machine", !!screens.screens?.[state.screenId]);
}

for (const action of flow.actions || []) {
  const ready = Boolean(action.fromState && action.toState && action.serverCommand);
  pushMap(rows, "action", action.actionId, action, "actions[].serverCommand/requestPayload/responseModel", "action_router", ready);
}

for (const node of flow.chapter1?.nodes || []) {
  const ready = Boolean(node.nodeId && node.displayText?.zhCN && node.nodeType);
  pushMap(rows, "chapter1_node", node.nodeId, node, "chapter1.nodes[]", "level_flow", ready, "补节点内房间/NPC/出口/战斗/奖励链");
}

for (const room of flow.chapter1?.rooms || []) {
  const ready = Boolean(room.roomId && room.displayName?.zhCN && room.evidence?.source);
  pushMap(rows, "chapter1_room", room.roomId, room, "chapter1.rooms[]", "room_graph", ready, "用房间出口/NPC/门槛驱动第一章地图详情与交互");
}

for (const npc of flow.chapter1?.npcs || []) {
  const ready = Boolean(npc.roleId && npc.name && npc.evidence?.source);
  pushMap(rows, "chapter1_npc", npc.roleId, npc, "chapter1.npcs[]", "npc_interaction", ready, "verify in real browser room/NPC/action/log flow");
  for (const action of npc.actions || []) {
    rows.push({
      MapId: `chapter1_npc_action:${npc.roleId}:${action.actionType}`,
      Domain: "chapter1_npc_action",
      SubjectId: `${npc.roleId}:${action.actionType}`,
      DisplayName: `${npc.name || npc.roleId}:${action.label || action.actionType}`,
      CompetitorSource: npc.evidence?.source || "",
      SourceRecord: `${npc.roleId}.${action.sourceField || action.actionType}`,
      EvidenceLevel: action.evidenceLevel || npc.evidence?.level || "unknown",
      FrameSecond: "",
      FramePath: "",
      SourceValue: action.label || action.actionType,
      ProjectField: "chapter1.npcs[].actions[]",
      ProjectOwner: "npc_interaction",
      ValidationStatus: action.actionType ? "mapped_and_implemented" : "needs_source_evidence",
      NextAction: "real browser click validation",
    });
  }
  for (const branch of npc.branches || []) {
    rows.push({
      MapId: `chapter1_npc_branch:${npc.roleId}:${branch.order}`,
      Domain: "chapter1_npc_branch",
      SubjectId: `${npc.roleId}:${branch.order}`,
      DisplayName: `${npc.name || npc.roleId}:branch ${branch.order}`,
      CompetitorSource: npc.evidence?.resultSource || npc.evidence?.source || "",
      SourceRecord: `${npc.roleId}.branch.${branch.order}`,
      EvidenceLevel: branch.evidenceLevel || "unknown",
      FrameSecond: "",
      FramePath: "",
      SourceValue: (branch.narrativeLines || []).join("|") || (branch.resultTokens || []).join("|"),
      ProjectField: "chapter1.npcs[].branches[]",
      ProjectOwner: "npc_interaction",
      ValidationStatus: (branch.narrativeLines || []).length ? "mapped_and_implemented" : "mapped_needs_runtime_check",
      NextAction: (branch.narrativeLines || []).length ? "real browser log validation" : "resolve non-narrative result dispatcher",
    });
  }
}

for (const item of flow.chapter1?.interactables || []) {
  const ready = Boolean(item.interactableId && item.name && item.evidence?.source);
  pushMap(
    rows,
    item.canSee ? "chapter1_interactable" : "chapter1_hidden_interactable",
    item.interactableId,
    item,
    "chapter1.interactables[]",
    "room_interactable",
    ready,
    item.canSee ? "verify in real browser room/object/action/log flow" : "verify hidden trigger is retained in data but not rendered as player action",
  );
  for (const action of item.actions || []) {
    rows.push({
      MapId: `chapter1_interactable_action:${item.interactableId}:${action.actionType}`,
      Domain: "chapter1_interactable_action",
      SubjectId: `${item.interactableId}:${action.actionType}`,
      DisplayName: `${item.name || item.interactableId}:${action.label || action.actionType}`,
      CompetitorSource: item.evidence?.source || "",
      SourceRecord: `${item.interactableId}.${action.sourceField || action.actionType}`,
      EvidenceLevel: action.evidenceLevel || item.evidence?.level || "unknown",
      FrameSecond: "",
      FramePath: "",
      SourceValue: action.label || action.actionType,
      ProjectField: "chapter1.interactables[].actions[]",
      ProjectOwner: "room_interactable",
      ValidationStatus: action.actionType ? "mapped_and_implemented" : "needs_source_evidence",
      NextAction: "real browser click validation",
    });
  }
  for (const branch of item.branches || []) {
    rows.push({
      MapId: `chapter1_interactable_branch:${item.interactableId}:${branch.order}`,
      Domain: "chapter1_interactable_branch",
      SubjectId: `${item.interactableId}:${branch.order}`,
      DisplayName: `${item.name || item.interactableId}:branch ${branch.order}`,
      CompetitorSource: item.evidence?.resultSource || item.evidence?.source || "",
      SourceRecord: `${item.interactableId}.branch.${branch.order}`,
      EvidenceLevel: branch.evidenceLevel || "unknown",
      FrameSecond: "",
      FramePath: "",
      SourceValue: (branch.narrativeLines || []).join("|") || (branch.resultTokens || []).join("|"),
      ProjectField: "chapter1.interactables[].branches[]",
      ProjectOwner: "room_interactable",
      ValidationStatus: (branch.narrativeLines || []).length ? "mapped_and_implemented" : "mapped_needs_runtime_check",
      NextAction: (branch.narrativeLines || []).length ? "real browser log validation" : "resolve non-narrative result dispatcher",
    });
  }
}

for (const gate of flow.chapter1?.gates || []) {
  const ready = Boolean(gate.gateId && gate.condition);
  pushMap(rows, "chapter1_gate", gate.gateId, gate, "chapter1.gates[]", "progression_gate", ready);
}

for (const reward of flow.chapter1?.rewards || []) {
  const ready = Boolean(reward.rewardId && reward.payload);
  pushMap(rows, "chapter1_reward", reward.rewardId, reward, "chapter1.rewards[]", "economy_reward", ready);
}

for (const [screenId, screen] of Object.entries(screens.screens || {})) {
  rows.push({
    MapId: `screen:${screenId}`,
    Domain: "screen",
    SubjectId: screenId,
    DisplayName: screen.title || screen.nav?.center || screenId,
    CompetitorSource: "",
    SourceRecord: screenId,
    EvidenceLevel: "project_mapping",
    FrameSecond: "",
    FramePath: "",
    SourceValue: (screen.body || []).map((block) => block.type).join("|"),
    ProjectField: "wuxia_first_session_screen_contract.screens",
    ProjectOwner: "ui_view_model",
    ValidationStatus: "implemented_contract",
    NextAction: "继续对照竞品录屏补 UI 细节与文案",
  });
}

const columns = [
  "MapId",
  "Domain",
  "SubjectId",
  "DisplayName",
  "CompetitorSource",
  "SourceRecord",
  "EvidenceLevel",
  "FrameSecond",
  "FramePath",
  "SourceValue",
  "ProjectField",
  "ProjectOwner",
  "ValidationStatus",
  "NextAction",
];

writeCsv("first_session_competitor_evidence_map.csv", rows, columns);
fs.writeFileSync(
  path.join(outDir, "first_session_competitor_evidence_map.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2),
  "utf8",
);

const summary = rows.reduce((acc, row) => {
  acc.total += 1;
  acc.byDomain[row.Domain] = (acc.byDomain[row.Domain] || 0) + 1;
  acc.byStatus[row.ValidationStatus] = (acc.byStatus[row.ValidationStatus] || 0) + 1;
  acc.byEvidenceLevel[row.EvidenceLevel] = (acc.byEvidenceLevel[row.EvidenceLevel] || 0) + 1;
  return acc;
}, { total: 0, byDomain: {}, byStatus: {}, byEvidenceLevel: {} });

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify({ outputDir: outDir, ...summary }, null, 2));
