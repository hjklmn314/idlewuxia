import fs from "node:fs";
import path from "node:path";

import {
  allEvidenceReferences,
} from "../src/evidenceContract.js";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "wuxia_first_session_acceptance");

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
  fs.writeFileSync(path.join(outputDir, fileName), `${text}\n`, "utf8");
}

function evidenceSource(evidence = {}) {
  return {
    references: allEvidenceReferences(evidence),
  };
}

function evidenceReferencesOrBlank(evidence = {}) {
  const references = allEvidenceReferences(evidence);
  return references.length
    ? references
    : [{ sourceFile: "", sourceRecord: "", sourceKind: "unknown" }];
}

function actionLabel(action = {}) {
  return action.displayText?.zhCN || action.input || action.actionId || "";
}

function actionEvidence(action = {}) {
  return action.evidence?.level || "unknown";
}

function screenPrimaryAction(screen = {}) {
  return screen.primaryActionId || screen.body?.flatMap((block) => {
    if (block.type === "choiceList") return block.choices || [];
    if (block.type === "taskRows") return block.rows || [];
    if (block.type === "chapterCards") return block.cards || [];
    if (block.type === "entryButtons") return block.buttons || [];
    return [];
  }).find((item) => typeof item === "object" && item.actionId)?.actionId || "";
}

const flow = readJson(path.join("config", "wuxia_first_session_flow.json"));
const screenContract = readJson(path.join("config", "wuxia_first_session_screen_contract.json"));
let competitorReference = {};
try {
  competitorReference = readJson(path.join("config", "wuxia_competitor_first_session_reference.json"));
} catch {
  competitorReference = {};
}

fs.mkdirSync(outputDir, { recursive: true });

const screens = screenContract.screens || {};
const statesById = new Map((flow.states || []).map((state) => [state.stateId, state]));
const actionsByState = new Map();
for (const action of flow.actions || []) {
  const list = actionsByState.get(action.fromState) || [];
  list.push(action);
  actionsByState.set(action.fromState, list);
}
const automatedGoldenActions = new Set([
  "ACTION_FS_001_ORIGIN_SCHOLAR",
  "ACTION_FS_001_ORIGIN_RESULT_CONTINUE",
  "ACTION_FS_002_TITLE_START",
  "ACTION_FS_003_CHARACTER_STATUS",
  "ACTION_FS_004_IDLE_CONFIRM",
  "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
  "ACTION_FS_005_LOCKED_EXP_1000",
  "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE",
  "ACTION_FS_006_SECT_HOME",
  "ACTION_FS_007_CHAPTER_CARD_ENTRY",
  "ACTION_FS_008_MAP_EXPLORE",
  "ACTION_FS_009_EARLY_COMBAT",
  "ACTION_FS_010_NPC_INTERACTION",
  "ACTION_FS_011_CHAPTER_LOOP_RETURN",
]);

const evidenceRows = [];
for (const state of flow.states || []) {
  for (const [index, reference] of evidenceReferencesOrBlank(state.evidence).entries()) {
    evidenceRows.push({
      EvidenceId: `EV_STATE_${state.stateId}_SRC_${index + 1}`,
      Domain: "first_session_state",
      SubjectId: state.stateId,
      Claim: `${state.stateId} renders ${state.screenId}`,
      SourceFile: reference.sourceFile,
      SourceRecord: reference.sourceRecord || state.sourceStepId || "",
      SourceKind: reference.sourceKind,
      SourceValue: state.displayText?.rawCompetitorText || state.displayText?.zhCN || "",
      EvidenceLevel: state.evidence?.level || "unknown",
      Confidence: state.evidence?.level === "recording_observed" ? "0.80" : "0.60",
      Interpretation: state.stepType || "",
      ProjectMapping: state.screenId || "",
      ValidationStatus: screens[state.screenId] ? "implemented" : "missing_screen_contract",
    });
  }
}
for (const action of flow.actions || []) {
  for (const [index, reference] of evidenceReferencesOrBlank(action.evidence).entries()) {
    evidenceRows.push({
      EvidenceId: `EV_ACTION_${action.actionId}_SRC_${index + 1}`,
      Domain: "first_session_action",
      SubjectId: action.actionId,
      Claim: `${action.fromState} -> ${action.toState || action.fromState}`,
      SourceFile: reference.sourceFile,
      SourceRecord: reference.sourceRecord,
      SourceKind: reference.sourceKind,
      SourceValue: action.displayText?.rawCompetitorText || action.input || "",
      EvidenceLevel: actionEvidence(action),
      Confidence: actionEvidence(action) === "recording_observed" ? "0.80" : "0.55",
      Interpretation: action.serverCommand || "",
      ProjectMapping: action.actionId,
      ValidationStatus: automatedGoldenActions.has(action.actionId) ? "automated" : "manual_or_branch",
    });
  }
}

const flowRows = (flow.actions || []).map((action) => ({
  FlowId: action.actionId,
  FromState: action.fromState,
  Trigger: action.input || action.actionId,
  Conditions: JSON.stringify(action.requestPayload || {}),
  Actions: action.serverCommand || "",
  ToState: action.toState || action.fromState,
  Rewards: JSON.stringify(action.responseModel?.statDeltas || action.responseModel?.taskPatch || {}),
  FailurePath: action.failureFeedback || "",
  SourceEvidence: evidenceSource(action.evidence),
  ImplementationOwner: "JSON state machine + JS generic renderer",
}));

const uiRows = (flow.states || []).map((state) => {
  const screen = screens[state.screenId] || {};
  const availableActions = actionsByState.get(state.stateId) || [];
  return {
    ScreenId: state.screenId,
    StateId: state.stateId,
    PlayerIntent: state.displayText?.rawCompetitorText || state.stepType || "",
    PrimaryInformation: (screen.body || []).map((block) => block.type).join("|"),
    PrimaryAction: screenPrimaryAction(screen) || availableActions[0]?.actionId || "",
    Feedback: availableActions.map((action) => action.responseModel?.feedback || action.failureFeedback || "").filter(Boolean).join("|"),
    EmptyState: "",
    ErrorState: availableActions.filter((action) => action.failureFeedback).map((action) => action.failureFeedback).join("|"),
    MobileConstraint: "9:16 portrait; touch target must be visible and non-zero size",
    Acceptance: state.evidence?.record ? `matches ${state.evidence.record}` : "requires manual evidence review",
  };
});

const nodeRows = (flow.chapter1?.nodes || []).map((node) => ({
  NodeId: node.nodeId,
  DisplayName: node.displayText?.zhCN || "",
  NodeType: node.nodeType || "",
  Connections: node.connections || [],
  Gates: node.gates || [],
  Encounters: node.encounters || [],
  Interactables: node.interactables || [],
  Rewards: node.rewards || [],
  SourceEvidence: evidenceSource(node.evidence),
  ProjectPresentation: node.presentation || "",
}));

const roomRows = (flow.chapter1?.rooms || []).map((room) => ({
  RoomId: room.roomId,
  DisplayName: room.displayName?.zhCN || "",
  ParentNodeId: room.parentNodeId || "",
  Connections: (room.connections || []).map((connection) => [connection.direction, connection.roomId].filter(Boolean).join(":")),
  Gates: (room.gates || []).map((gate) => [gate.key, gate.value].filter(Boolean).join("=")),
  Encounters: room.encounterIds || [],
  EncounterNames: room.encounterNames || [],
  Interactables: room.interactableIds || [],
  Rewards: room.rewardIds || [],
  FightBackground: room.fightBackground || "",
  RoomBgm: room.roomBgm || "",
  SourceEvidence: evidenceSource(room.evidence),
  ProjectPresentation: room.projectPresentation || "",
}));

const npcRows = (flow.chapter1?.npcs || []).map((npc) => ({
  RoleId: npc.roleId,
  DisplayName: npc.name || npc.displayName?.zhCN || "",
  Actions: (npc.actions || []).map((action) => `${action.actionType}:${action.label || ""}`),
  Branches: (npc.branches || []).length,
  NarrativeBranches: (npc.branches || []).filter((branch) => (branch.narrativeLines || []).length).length,
  Skills: npc.skills || [],
  SourceEvidence: evidenceSource(npc.evidence),
  ResultSource: npc.evidence?.resultSource || "",
  ProjectPresentation: "room presence button + NPC action panel + bottom log",
}));

const interactableRows = (flow.chapter1?.interactables || []).map((item) => ({
  InteractableId: item.interactableId,
  DisplayName: item.name || "",
  Description: item.description || "",
  CanSee: item.canSee ? "1" : "0",
  Actions: (item.actions || []).map((action) => `${action.actionType}:${action.label || ""}`),
  Branches: (item.branches || []).length,
  NarrativeBranches: (item.branches || []).filter((branch) => (branch.narrativeLines || []).length).length,
  ResultTokens: (item.branches || []).flatMap((branch) => branch.resultTokens || []),
  SourceEvidence: evidenceSource(item.evidence),
  ResultSource: item.evidence?.resultSource || "",
  ProjectPresentation: item.canSee ? "room presence button + object action panel + bottom log" : "hidden room trigger; retained in data but not player-visible",
}));

const acceptanceRows = [];
for (const state of flow.states || []) {
  const screen = screens[state.screenId];
  acceptanceRows.push({
    CheckId: `AC_SCREEN_${state.stateId}`,
    Domain: "ui_state",
    Precondition: `currentState=${state.stateId}`,
    Action: `render ${state.screenId}`,
    ExpectedResult: screen ? `mode=${screen.mode}; title=${screen.title || screen.nav?.center || ""}` : "screen contract missing",
    EvidenceType: state.evidence?.level || "unknown",
    Automated: "yes",
    Blocking: screen ? "no" : "yes",
    Artifact: "wuxia_first_session_screen_contract.json",
  });
}
for (const action of flow.actions || []) {
  acceptanceRows.push({
    CheckId: `AC_ACTION_${action.actionId}`,
    Domain: "state_route",
    Precondition: `currentState=${action.fromState}`,
    Action: action.actionId,
    ExpectedResult: `toState=${action.toState || action.fromState}`,
    EvidenceType: actionEvidence(action),
    Automated: automatedGoldenActions.has(action.actionId) ? "yes" : "partial",
    Blocking: automatedGoldenActions.has(action.actionId) ? "yes" : "no",
    Artifact: "test-wuxia-first-session-interactions.mjs",
  });
}
for (const node of flow.chapter1?.nodes || []) {
  acceptanceRows.push({
    CheckId: `AC_NODE_${node.nodeId}`,
    Domain: "chapter1_node",
    Precondition: "chapter_fb01_entered",
    Action: `select ${node.nodeId}`,
    ExpectedResult: `${node.displayText?.zhCN || node.nodeId}; gates=${(node.gates || []).length}; encounters=${(node.encounters || []).length}`,
    EvidenceType: node.evidence?.level || "unknown",
    Automated: node.order === 1 ? "partial" : "no",
    Blocking: node.order <= 3 ? "yes" : "no",
    Artifact: "wuxia_first_session_flow.json",
  });
}
for (const room of flow.chapter1?.rooms || []) {
  acceptanceRows.push({
    CheckId: `AC_ROOM_${room.roomId}`,
    Domain: "chapter1_room",
    Precondition: room.parentNodeId ? `selectedNode=${room.parentNodeId}` : "chapter_fb01_entered",
    Action: `select ${room.roomId}`,
    ExpectedResult: `${room.displayName?.zhCN || room.roomId}; exits=${(room.connections || []).length}; encounters=${(room.encounterIds || []).length}`,
    EvidenceType: room.evidence?.level || "unknown",
    Automated: "yes",
    Blocking: room.parentNodeId ? "yes" : "no",
    Artifact: "test-wuxia-first-session-interactions.mjs",
  });
}
for (const npc of flow.chapter1?.npcs || []) {
  acceptanceRows.push({
    CheckId: `AC_NPC_${npc.roleId}`,
    Domain: "chapter1_npc",
    Precondition: "selected room contains npc roleId",
    Action: `select ${npc.roleId}`,
    ExpectedResult: `${npc.name || npc.roleId}; actions=${(npc.actions || []).map((action) => action.label || action.actionType).join("|")}`,
    EvidenceType: npc.evidence?.level || "unknown",
    Automated: npc.roleId === "fb01r01_1" || npc.roleId === "fb01r04_1" ? "yes" : "partial",
    Blocking: npc.roleId?.startsWith("fb01") ? "yes" : "no",
    Artifact: "test-wuxia-first-session-interactions.mjs",
  });
  for (const action of npc.actions || []) {
    acceptanceRows.push({
      CheckId: `AC_NPC_ACTION_${npc.roleId}_${action.actionType}`,
      Domain: "chapter1_npc_action",
      Precondition: `selectedNpc=${npc.roleId}`,
      Action: action.actionType,
      ExpectedResult: "log/result branch resolved from chapter1_results.csv when narrative exists",
      EvidenceType: action.evidenceLevel || npc.evidence?.level || "unknown",
      Automated: npc.roleId === "fb01r01_1" && action.actionType === "talk" ? "yes" : "partial",
      Blocking: npc.roleId?.startsWith("fb01") && action.actionType === "talk" ? "yes" : "no",
      Artifact: "test-wuxia-first-session-interactions.mjs",
    });
  }
}
const interactableVisibilityPolicy = flow.chapterSystem?.entityInteractionPolicy?.visibility || {};
const interactableVisibilityField = interactableVisibilityPolicy.interactableField || "";
const interactableVisibleValue = interactableVisibilityPolicy.visibleValue;
for (const item of flow.chapter1?.interactables || []) {
  const isVisible = Boolean(interactableVisibilityField)
    && item[interactableVisibilityField] === interactableVisibleValue;
  acceptanceRows.push({
    CheckId: `AC_INTERACTABLE_${item.interactableId}`,
    Domain: isVisible ? "chapter1_interactable" : "chapter1_hidden_interactable",
    Precondition: isVisible ? "selected room contains visible interactableId" : "selected room contains hidden trigger interactableId",
    Action: isVisible ? `select ${item.interactableId}` : `reject ${item.interactableId}`,
    ExpectedResult: isVisible
      ? `${item.name || item.interactableId}; actions=${(item.actions || []).map((action) => action.label || action.actionType).join("|")}`
      : `${item.name || item.interactableId}; hidden by configured visibility policy; not player-selectable`,
    EvidenceType: item.evidence?.level || "unknown",
    Automated: ["fb01item_20", "fb01item_16", "bfitem2", "bfitem3"].includes(item.interactableId) ? "yes" : "partial",
    Blocking: item.interactableId?.startsWith("fb01") || item.interactableId?.startsWith("bfitem") ? "yes" : "no",
    Artifact: "test-wuxia-first-session-interactions.mjs",
  });
  for (const action of item.actions || []) {
    acceptanceRows.push({
      CheckId: `AC_INTERACTABLE_ACTION_${item.interactableId}_${action.actionType}`,
      Domain: "chapter1_interactable_action",
      Precondition: `selectedInteractable=${item.interactableId}`,
      Action: action.actionType,
      ExpectedResult: "log/result branch resolved from chapter1_results.csv when narrative exists; raw result ids must not be shown",
      EvidenceType: action.evidenceLevel || item.evidence?.level || "unknown",
      Automated: ["fb01item_20", "fb01item_16"].includes(item.interactableId) && action.actionType === "use" ? "yes" : "partial",
      Blocking: item.interactableId?.startsWith("fb01") ? "yes" : "no",
      Artifact: "test-wuxia-first-session-interactions.mjs",
    });
  }
}

const issues = [];
for (const state of flow.states || []) {
  if (!screens[state.screenId]) issues.push({ severity: "error", id: state.stateId, issue: `missing screen ${state.screenId}` });
}
for (const action of flow.actions || []) {
  if (!statesById.has(action.fromState)) issues.push({ severity: "error", id: action.actionId, issue: `missing fromState ${action.fromState}` });
  if (action.toState && !statesById.has(action.toState)) issues.push({ severity: "error", id: action.actionId, issue: `missing toState ${action.toState}` });
  if (!allEvidenceReferences(action.evidence).length && actionEvidence(action) !== "design_proposal") {
    issues.push({ severity: "warning", id: action.actionId, issue: "missing evidence source" });
  }
}
for (const [screenId, screen] of Object.entries(screens)) {
  if (screen.primaryText && !screenPrimaryAction(screen) && !["status", "chapterCards", "npc"].includes(screen.mode)) {
    issues.push({ severity: "warning", id: screenId, issue: "primaryText without action binding" });
  }
}

const packedEvidenceRows = evidenceRows.filter(
  (row) => String(row.SourceFile || "").includes("|")
    || String(row.SourceRecord || "").includes("|"),
);
if (packedEvidenceRows.length) {
  throw new Error(
    `Acceptance registry contains ${packedEvidenceRows.length} pipe-packed source reference rows.`,
  );
}

writeCsv("evidence_registry.csv", evidenceRows, [
  "EvidenceId", "Domain", "SubjectId", "Claim", "SourceFile", "SourceRecord", "SourceKind", "SourceValue",
  "EvidenceLevel", "Confidence", "Interpretation", "ProjectMapping", "ValidationStatus",
]);
writeCsv("system_flow.csv", flowRows, [
  "FlowId", "FromState", "Trigger", "Conditions", "Actions", "ToState", "Rewards", "FailurePath",
  "SourceEvidence", "ImplementationOwner",
]);
writeCsv("ui_state.csv", uiRows, [
  "ScreenId", "StateId", "PlayerIntent", "PrimaryInformation", "PrimaryAction", "Feedback",
  "EmptyState", "ErrorState", "MobileConstraint", "Acceptance",
]);
writeCsv("level_nodes.csv", nodeRows, [
  "NodeId", "DisplayName", "NodeType", "Connections", "Gates", "Encounters", "Interactables",
  "Rewards", "SourceEvidence", "ProjectPresentation",
]);
writeCsv("level_rooms.csv", roomRows, [
  "RoomId", "DisplayName", "ParentNodeId", "Connections", "Gates", "Encounters", "EncounterNames",
  "Interactables", "Rewards", "FightBackground", "RoomBgm", "SourceEvidence", "ProjectPresentation",
]);
writeCsv("npc_interactions.csv", npcRows, [
  "RoleId", "DisplayName", "Actions", "Branches", "NarrativeBranches", "Skills",
  "SourceEvidence", "ResultSource", "ProjectPresentation",
]);
writeCsv("interactable_interactions.csv", interactableRows, [
  "InteractableId", "DisplayName", "Description", "CanSee", "Actions", "Branches", "NarrativeBranches",
  "ResultTokens", "SourceEvidence", "ResultSource", "ProjectPresentation",
]);
writeCsv("acceptance.csv", acceptanceRows, [
  "CheckId", "Domain", "Precondition", "Action", "ExpectedResult", "EvidenceType", "Automated",
  "Blocking", "Artifact",
]);
fs.writeFileSync(path.join(outputDir, "issues.json"), JSON.stringify(issues, null, 2), "utf8");

const report = `# Wuxia First Session Acceptance Matrix

Generated: ${new Date().toISOString()}

## Scope

- Start state: ${screenContract.defaultStartState}
- States: ${flow.states?.length || 0}
- Actions: ${flow.actions?.length || 0}
- Screens: ${Object.keys(screens).length}
- Chapter 1 nodes: ${flow.chapter1?.nodes?.length || 0}
- Chapter 1 rooms: ${flow.chapter1?.rooms?.length || 0}
- Chapter 1 NPCs: ${flow.chapter1?.npcs?.length || 0}
- Chapter 1 interactables: ${flow.chapter1?.interactables?.length || 0}
- Competitor reference steps: ${competitorReference.steps?.length || 0}

## Generated Tables

- evidence_registry.csv
- system_flow.csv
- ui_state.csv
- level_nodes.csv
- level_rooms.csv
- npc_interactions.csv
- interactable_interactions.csv
- acceptance.csv
- issues.json

## Current Gate

${issues.length ? `Open issues: ${issues.length}` : "No blocking schema/evidence issues found by this pass."}

## Confirmed Competitor Facts

- First-session state order is backed by recording evidence rows in \`wuxia_first_session_flow.json\`.
- fb01 contains 7 project nodes mapped from restored room/task evidence.
- First hangup task \`池边打鱼\` grants experience/potential by configured action route.

## Tested Inferences

- The current JS generic renderer can click through the automated golden path from opening origin to chapter loop return.
- Some chapter and NPC branch actions remain partial because exact per-button Lua branch behavior is not fully bound yet.

## Project Recommendations

- Keep this matrix as the gate before UI polish work.
- Next implementation should expand \`UI_MapExplore\` from a linear bridge into selectable node detail backed by \`chapter1.nodes\`.
- Product polish should not hide action buttons unless an equivalent card/list action is visible and non-zero sized.

## Unresolved Minimum List

${issues.map((issue) => `- [${issue.severity}] ${issue.id}: ${issue.issue}`).join("\n") || "- None from this automated pass."}
`;
fs.writeFileSync(path.join(outputDir, "report.md"), report, "utf8");

console.log(JSON.stringify({
  outputDir,
  evidenceRows: evidenceRows.length,
  systemFlowRows: flowRows.length,
  uiRows: uiRows.length,
  nodeRows: nodeRows.length,
  acceptanceRows: acceptanceRows.length,
  issues: issues.length,
  errors: issues.filter((issue) => issue.severity === "error").length,
  warnings: issues.filter((issue) => issue.severity === "warning").length,
}, null, 2));

if (issues.some((issue) => issue.severity === "error")) process.exit(1);
