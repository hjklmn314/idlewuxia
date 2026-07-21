import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import {
  evidenceReferences,
  validateEvidenceContract,
} from "../src/evidenceContract.js";

const root = process.cwd();
const configPath = path.join(root, "config", "wuxia_first_session_flow.json");
const outputDir = path.join(root, "outputs", "idlewuxia_migration");
const requireLocalEvidenceFiles = !process.argv.includes("--runtime-only");
fs.mkdirSync(outputDir, { recursive: true });

function finding(severity, message, where = "") {
  return { severity, message, where };
}

function existsRel(relPath) {
  return Boolean(relPath) && fs.existsSync(path.join(root, relPath));
}

function evidenceFilesExist(evidence) {
  const references = evidenceReferences(evidence);
  return references.length > 0 && references.every((entry) => existsRel(entry.sourceFile));
}

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const screenPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");
const screenContract = JSON.parse(fs.readFileSync(screenPath, "utf8"));
const findings = [];
const evidenceContractReport = validateEvidenceContract(config);
for (const entry of evidenceContractReport.findings) {
  findings.push(finding(entry.severity, `${entry.code}: ${entry.detail}`, entry.path));
}

if (config.schema !== "idlewuxia.first_session_flow.v1") {
  findings.push(finding("error", "Unexpected first-session schema.", "schema"));
}

const states = Array.isArray(config.states) ? config.states : [];
const actions = Array.isArray(config.actions) ? config.actions : [];
const nodes = Array.isArray(config.chapter1?.nodes) ? config.chapter1.nodes : [];
const rooms = Array.isArray(config.chapter1?.rooms) ? config.chapter1.rooms : [];
const gates = Array.isArray(config.chapter1?.gates) ? config.chapter1.gates : [];
const rewards = Array.isArray(config.chapter1?.rewards) ? config.chapter1.rewards : [];
const screens = screenContract.screens || {};
const rewardClasses = config.rewardClasses || {};
const mobileLayout = screenContract.mobileLayout || {};
const runtimeMutationPolicy = config.chapterSystem?.resultEffectPolicies?.runtimeMutation || {};
const navigationPolicy = config.chapterSystem?.navigationPolicy || {};
const entityInteractionPolicy = config.chapterSystem?.entityInteractionPolicy || {};
const sessionDefaults = config.sessionDefaults || {};

const sessionDefaultsSchemaPath = path.join(root, "config", "wuxia_chapter_session_defaults.schema.json");
const sessionDefaultsSchema = JSON.parse(fs.readFileSync(sessionDefaultsSchemaPath, "utf8"));
const sessionDefaultsAjv = new Ajv2020({ allErrors: true, strict: true });
const validateSessionDefaults = sessionDefaultsAjv.compile(sessionDefaultsSchema);
if (!validateSessionDefaults(sessionDefaults)) {
  for (const error of validateSessionDefaults.errors || []) {
    findings.push(finding(
      "error",
      `Chapter session defaults schema violation: ${error.message || "invalid value"}.`,
      `sessionDefaults${error.instancePath || ""}`,
    ));
  }
}
const sessionInitialFlags = Array.isArray(sessionDefaults.initialFlags) ? sessionDefaults.initialFlags : [];
const screenInitialFlags = Array.isArray(screenContract.defaultStartFlags) ? screenContract.defaultStartFlags : [];
if (JSON.stringify(sessionInitialFlags) !== JSON.stringify(screenInitialFlags)) {
  findings.push(finding(
    "error",
    "Chapter session initial flags must match the screen startup compatibility contract.",
    "sessionDefaults.initialFlags",
  ));
}

const runtimeMutationSchemaPath = path.join(root, "config", "wuxia_runtime_mutation_policy.schema.json");
const runtimeMutationSchema = JSON.parse(fs.readFileSync(runtimeMutationSchemaPath, "utf8"));
const runtimeMutationAjv = new Ajv2020({ allErrors: true, strict: true });
const validateRuntimeMutationPolicy = runtimeMutationAjv.compile(runtimeMutationSchema);
if (!validateRuntimeMutationPolicy(runtimeMutationPolicy)) {
  for (const error of validateRuntimeMutationPolicy.errors || []) {
    findings.push(finding(
      "error",
      `Runtime mutation policy schema violation: ${error.message || "invalid value"}.`,
      `chapterSystem.resultEffectPolicies.runtimeMutation${error.instancePath || ""}`,
    ));
  }
}

if (runtimeMutationPolicy.schema !== "idlewuxia.runtime_mutation_policy.v1") {
  findings.push(finding("error", "Runtime mutation policy schema is missing or unsupported.", "chapterSystem.resultEffectPolicies.runtimeMutation.schema"));
}
for (const [group, keys] of Object.entries({
  categoryNames: ["narrativeFeedback", "mapState", "attributeReward", "skillProgression", "roleState", "combat", "chapterClear"],
  actionNames: [
    "entitySwap", "entityAdd", "hideSelf", "entityDelete", "mapMarkerSet", "mapMarkerChange",
    "attributeChange", "skillExperienceChange", "inheritableMarkerSet", "playerMarkerSet",
    "playerMarkerChange", "playerTimeMarkerSet", "playerTimedMarkerSet", "storyDialogue", "navigationStop", "chapterClear",
  ],
  argKeys: ["primary", "secondary", "duration"],
})) {
  for (const key of keys) {
    if (!String(runtimeMutationPolicy[group]?.[key] || "").trim()) {
      findings.push(finding(
        "error",
        `Runtime mutation policy is missing ${group}.${key}.`,
        `chapterSystem.resultEffectPolicies.runtimeMutation.${group}.${key}`,
      ));
    }
  }
}
for (const key of ["defaultValue", "listDelimiter"]) {
  if (!String(runtimeMutationPolicy[key] || "").trim()) {
    findings.push(finding("error", `Runtime mutation policy is missing ${key}.`, `chapterSystem.resultEffectPolicies.runtimeMutation.${key}`));
  }
}
for (const key of ["compareResultId", "compareWinConditionToken", "inheritanceResultIdPrefix", "autoTextArg", "autoTextMarkerArg"]) {
  if (!String(runtimeMutationPolicy.combatFollowup?.[key] || "").trim()) {
    findings.push(finding("error", `Runtime mutation policy is missing combatFollowup.${key}.`, `chapterSystem.resultEffectPolicies.runtimeMutation.combatFollowup.${key}`));
  }
}
if (runtimeMutationPolicy.failurePolicy !== "reject_entire_branch_and_discard_draft") {
  findings.push(finding("error", "Runtime mutation policy must reject and discard an invalid branch draft.", "chapterSystem.resultEffectPolicies.runtimeMutation.failurePolicy"));
}

const navigationSchemaPath = path.join(root, "config", "wuxia_navigation_policy.schema.json");
const navigationSchema = JSON.parse(fs.readFileSync(navigationSchemaPath, "utf8"));
const navigationAjv = new Ajv2020({ allErrors: true, strict: true });
const validateNavigationPolicy = navigationAjv.compile(navigationSchema);
if (!validateNavigationPolicy(navigationPolicy)) {
  for (const error of validateNavigationPolicy.errors || []) {
    findings.push(finding(
      "error",
      `Navigation policy schema violation: ${error.message || "invalid value"}.`,
      `chapterSystem.navigationPolicy${error.instancePath || ""}`,
    ));
  }
}
if (navigationPolicy.blockerResult?.actionName !== runtimeMutationPolicy.actionNames?.navigationStop) {
  findings.push(finding(
    "error",
    "Navigation blocker action must match the runtime mutation navigationStop action.",
    "chapterSystem.navigationPolicy.blockerResult.actionName",
  ));
}
const roomEntryConditions = Object.values(config.chapter1?.conditionLookup || {}).filter((condition) => (
  condition?.arg1 === navigationPolicy.roomEntryCondition?.actionName
  && String(condition?.[navigationPolicy.roomEntryCondition?.targetRoomField] || "").trim()
));
if (!roomEntryConditions.length) {
  findings.push(finding(
    "error",
    "Navigation policy does not resolve any configured room-entry conditions.",
    "chapter1.conditionLookup",
  ));
}
const blockerResults = Object.values(config.chapter1?.resultLookup || {}).filter((result) => (
  result?.action === navigationPolicy.blockerResult?.actionName
));
if (!blockerResults.length) {
  findings.push(finding(
    "error",
    "Navigation policy does not resolve any configured movement-blocking result.",
    "chapter1.resultLookup",
  ));
}

const entityInteractionSchemaPath = path.join(root, "config", "wuxia_entity_interaction_policy.schema.json");
const entityInteractionSchema = JSON.parse(fs.readFileSync(entityInteractionSchemaPath, "utf8"));
const entityInteractionAjv = new Ajv2020({ allErrors: true, strict: true });
const validateEntityInteractionPolicy = entityInteractionAjv.compile(entityInteractionSchema);
if (!validateEntityInteractionPolicy(entityInteractionPolicy)) {
  for (const error of validateEntityInteractionPolicy.errors || []) {
    findings.push(finding(
      "error",
      `Entity interaction policy schema violation: ${error.message || "invalid value"}.`,
      `chapterSystem.entityInteractionPolicy${error.instancePath || ""}`,
    ));
  }
}
const dialogueActionType = entityInteractionPolicy.branchRouting?.dialogueActionType || "";
const configuredEntityActionTypes = new Set([
  ...(config.chapter1?.npcs || []).flatMap((npc) => (npc.actions || []).map((action) => action.actionType)),
  ...(config.chapter1?.interactables || []).flatMap((item) => (item.actions || []).map((action) => action.actionType)),
]);
if (!configuredEntityActionTypes.has(dialogueActionType)) {
  findings.push(finding(
    "error",
    "Entity interaction dialogue action type does not resolve any configured action.",
    "chapterSystem.entityInteractionPolicy.branchRouting.dialogueActionType",
  ));
}
if (!(config.chapter1?.interactables || []).some((item) => (
  Object.hasOwn(item, entityInteractionPolicy.visibility?.interactableField || "")
))) {
  findings.push(finding(
    "error",
    "Entity interaction visibility field does not resolve any configured interactable.",
    "chapterSystem.entityInteractionPolicy.visibility.interactableField",
  ));
}
for (const actionType of Object.keys(entityInteractionPolicy.feedback?.npcGlobalActions || {})) {
  if (!configuredEntityActionTypes.has(actionType)) {
    findings.push(finding(
      "error",
      `Entity interaction feedback action ${actionType} does not resolve any configured entity action.`,
      `chapterSystem.entityInteractionPolicy.feedback.npcGlobalActions.${actionType}`,
    ));
  }
  const rule = entityInteractionPolicy.feedback.npcGlobalActions[actionType];
  if (rule.requiredSourceField && rule.optionalSourceField) {
    findings.push(finding(
      "error",
      `Entity interaction feedback action ${actionType} cannot require and optionally read a source field at the same time.`,
      `chapterSystem.entityInteractionPolicy.feedback.npcGlobalActions.${actionType}`,
    ));
  }
}

if (mobileLayout.orientation !== "portrait") {
  findings.push(finding("error", "Screen contract must declare portrait mobile orientation.", "mobileLayout.orientation"));
}
if (!Number.isFinite(Number(mobileLayout.contentMaxWidthPx)) || Number(mobileLayout.contentMaxWidthPx) <= 0) {
  findings.push(finding("error", "Screen contract must declare a positive contentMaxWidthPx.", "mobileLayout.contentMaxWidthPx"));
}
for (const edge of ["top", "right", "bottom", "left"]) {
  if (!String(mobileLayout.safeArea?.[edge] || "").includes("safe-area-inset")) {
    findings.push(finding("error", `Screen contract safeArea.${edge} must use a mobile safe-area inset.`, `mobileLayout.safeArea.${edge}`));
  }
}
const indexPath = path.join(root, "index.html");
if (!fs.existsSync(indexPath) || !fs.readFileSync(indexPath, "utf8").includes("viewport-fit=cover")) {
  findings.push(finding("error", "Mobile shell must retain viewport-fit=cover for iOS/Android safe areas.", "index.html"));
}

const stateIds = new Set();
for (const state of states) {
  if (!state.stateId) findings.push(finding("error", "State missing stateId.", JSON.stringify(state)));
  if (stateIds.has(state.stateId)) findings.push(finding("error", `Duplicate stateId ${state.stateId}.`, state.stateId));
  stateIds.add(state.stateId);
  if (!state.screenId) findings.push(finding("warning", `State ${state.stateId} has no screenId.`, state.stateId));
  if (state.screenId && !screens[state.screenId]) {
    findings.push(finding("error", `State ${state.stateId} points to missing screen ${state.screenId}.`, state.stateId));
  }
  if (!state.evidence?.level) findings.push(finding("error", `State ${state.stateId} missing evidence level.`, state.stateId));
  if (!evidenceReferences(state.evidence).length || (requireLocalEvidenceFiles && !evidenceFilesExist(state.evidence))) {
    findings.push(finding("error", `State ${state.stateId} source file is missing.`, evidenceReferences(state.evidence).map((entry) => entry.sourceFile).join("|") || state.stateId));
  }
}

const actionIds = new Set();
for (const action of actions) {
  if (!action.actionId) findings.push(finding("error", "Action missing actionId.", JSON.stringify(action)));
  if (actionIds.has(action.actionId)) findings.push(finding("error", `Duplicate actionId ${action.actionId}.`, action.actionId));
  actionIds.add(action.actionId);
  if (!stateIds.has(action.fromState)) findings.push(finding("error", `Action ${action.actionId} fromState does not exist.`, action.fromState));
  if (action.toState && !stateIds.has(action.toState)) findings.push(finding("error", `Action ${action.actionId} toState does not exist.`, action.toState));
  if (action.fromState === "STATE_FS_006_SECT_HOME" || action.toState === "STATE_FS_006_SECT_HOME") {
    findings.push(finding("error", `Action ${action.actionId} still references removed sect-home state.`, action.actionId));
  }
  if (!action.serverCommand) findings.push(finding("error", `Action ${action.actionId} missing serverCommand.`, action.actionId));
  if (!action.evidence?.level) findings.push(finding("error", `Action ${action.actionId} missing evidence level.`, action.actionId));
  if (action.responseModel?.rewardClassId && !rewardClasses[action.responseModel.rewardClassId]) {
    findings.push(finding("error", `Action ${action.actionId} references missing rewardClass ${action.responseModel.rewardClassId}.`, action.actionId));
  }
  if (action.responseModel?.rewardMode === "click_work" && Number(action.responseModel?.taskCounterDeltas?.completedClicks || 0) <= 0) {
    findings.push(finding("error", `Repeatable task action ${action.actionId} must increment taskCounterDeltas.completedClicks.`, action.actionId));
  }
}

for (const [rewardClassId, rewardClass] of Object.entries(rewardClasses)) {
  if (!Array.isArray(rewardClass.rows) || rewardClass.rows.length === 0) {
    findings.push(finding("error", `RewardClass ${rewardClassId} has no rows.`, rewardClassId));
  }
  for (const row of rewardClass.rows || []) {
    if (!row.rewardAttrName) findings.push(finding("error", `RewardClass ${rewardClassId} row missing rewardAttrName.`, rewardClassId));
    if (!Number.isFinite(Number(row.baseAward))) findings.push(finding("error", `RewardClass ${rewardClassId} row has invalid baseAward.`, rewardClassId));
  }
}

for (const [screenId, screen] of Object.entries(screens)) {
  const screenText = collectStrings(screen).join("\n");
  for (const forbidden of ["当前录屏", "暂按待验证", "待验证处理", "请稍后", "APP备案", "隐私政策", "用户协议"]) {
    if (screenText.includes(forbidden)) {
      findings.push(finding("error", `Product screen ${screenId} contains forbidden audit/legal placeholder text: ${forbidden}.`, screenId));
    }
  }
  if (/华山|师门/.test(screenText)) {
    findings.push(finding("error", `Product screen ${screenId} exposes sect-specific text before sect selection is implemented.`, screenId));
  }
  if ((screen.nav?.left === "返回" || screen.nav?.left === "状态") && !screen.navActions?.left) {
    findings.push(finding("warning", `Screen ${screenId} has a left nav label without a configured nav action.`, screenId));
  }
  if ((screen.nav?.right === "返回" || screen.nav?.right === "离开") && !screen.navActions?.right) {
    findings.push(finding("warning", `Screen ${screenId} has a right nav label without a configured nav action.`, screenId));
  }
  if (screen.mode === "combat") {
    const combatBlocks = (screen.body || []).filter((block) => block.type === "combatRuntime");
    if (screen.primaryText || screen.primaryActionId || screen.secondaryText || screen.secondaryActionId) {
      findings.push(finding("error", `Combat screen ${screenId} exposes a manual primary/secondary action. Player combat must resolve from its configured timeline.`, screenId));
    }
    if (combatBlocks.length !== 1 || combatBlocks[0].autoResolve !== true) {
      findings.push(finding("error", `Combat screen ${screenId} must declare exactly one autoResolve combatRuntime block.`, screenId));
    }
  }
}

for (const forbidden of ["当前录屏", "暂按待验证", "待验证处理", "请稍后"]) {
  const matches = collectStrings(config).filter((text) => text.includes(forbidden));
  if (matches.length) {
    findings.push(finding("error", `Flow config still contains forbidden audit placeholder text: ${forbidden}.`, matches.slice(0, 3).join(" | ")));
  }
}

if (stateIds.has("STATE_FS_006_SECT_HOME")) findings.push(finding("error", "Removed sect-home state still exists.", "STATE_FS_006_SECT_HOME"));
if (screens.UI_SectHome) findings.push(finding("error", "Removed sect-home screen still exists.", "UI_SectHome"));

const nodeIds = new Set();
const roomIds = new Set(rooms.map((room) => room.roomId).filter(Boolean));
const gateIds = new Set(gates.map((gate) => gate.gateId).filter(Boolean));
const rewardIds = new Set(rewards.map((reward) => reward.rewardId).filter(Boolean));
for (const node of nodes) {
  const isProjectBridge = node.isProjectBridge || node.hideFromMap || node.nodeType === "chapter_settlement";
  if (!node.nodeId) findings.push(finding("error", "Node missing nodeId.", JSON.stringify(node)));
  if (nodeIds.has(node.nodeId)) findings.push(finding("error", `Duplicate nodeId ${node.nodeId}.`, node.nodeId));
  nodeIds.add(node.nodeId);
  if (!node.displayText?.zhCN) findings.push(finding("error", `Node ${node.nodeId} missing zhCN display text.`, node.nodeId));
  if (!Array.isArray(node.sourceRooms) || node.sourceRooms.length === 0) findings.push(finding("error", `Node ${node.nodeId} missing sourceRooms from fb01 room config.`, node.nodeId));
  if (!isProjectBridge && (!Array.isArray(node.sourceRoomNames) || node.sourceRoomNames.length === 0)) findings.push(finding("warning", `Node ${node.nodeId} missing readable sourceRoomNames.`, node.nodeId));
  if ((node.interactables || []).length > 0 && (!Array.isArray(node.interactableNames) || node.interactableNames.length === 0)) {
    findings.push(finding("warning", `Node ${node.nodeId} has interactables but no readable interactableNames.`, node.nodeId));
  }
  for (const gateId of node.gates || []) {
    if (!gateIds.has(gateId)) findings.push(finding("error", `Node ${node.nodeId} references missing gate ${gateId}.`, node.nodeId));
  }
  for (const rewardId of node.rewards || []) {
    if (!rewardIds.has(rewardId)) findings.push(finding("error", `Node ${node.nodeId} references missing reward ${rewardId}.`, node.nodeId));
  }
  for (const roomId of node.sourceRooms || []) {
    const chapterRootReference = node.nodeType === "chapter_settlement" && roomId === config.chapter1?.chapterId;
    if (rooms.length > 0 && !roomIds.has(roomId) && !chapterRootReference) {
      findings.push(finding("error", `Node ${node.nodeId} references missing room ${roomId}.`, node.nodeId));
    }
  }
  if (!node.evidence?.level) findings.push(finding("error", `Node ${node.nodeId} missing evidence level.`, node.nodeId));
  if (!evidenceReferences(node.evidence).length || (requireLocalEvidenceFiles && !evidenceFilesExist(node.evidence))) {
    findings.push(finding("error", `Node ${node.nodeId} source file is missing.`, evidenceReferences(node.evidence).map((entry) => entry.sourceFile).join("|") || node.nodeId));
  }
}

for (const room of rooms) {
  if (!room.roomId) findings.push(finding("error", "Room missing roomId.", JSON.stringify(room)));
  if (!room.displayName?.zhCN) findings.push(finding("error", `Room ${room.roomId} missing displayName.zhCN.`, room.roomId));
  if (room.parentNodeId && !nodeIds.has(room.parentNodeId)) {
    findings.push(finding("error", `Room ${room.roomId} points to missing parent node ${room.parentNodeId}.`, room.roomId));
  }
  const connectionKeys = new Set();
  const connectionDirections = new Set();
  for (const connection of room.connections || []) {
    if (!String(connection.direction || "").trim()) {
      findings.push(finding("error", `Room ${room.roomId} has a connection without direction.`, room.roomId));
    }
    const connectionKey = `${connection.direction || ""}:${connection.roomId || ""}`;
    if (connectionKeys.has(connectionKey)) {
      findings.push(finding("error", `Room ${room.roomId} has duplicate connection ${connectionKey}.`, room.roomId));
    }
    connectionKeys.add(connectionKey);
    if (connectionDirections.has(connection.direction)) {
      findings.push(finding("error", `Room ${room.roomId} has more than one connection in direction ${connection.direction}.`, room.roomId));
    }
    connectionDirections.add(connection.direction);
    if (connection.roomId && !roomIds.has(connection.roomId)) {
      findings.push(finding("error", `Room ${room.roomId} connects to missing room ${connection.roomId}.`, room.roomId));
    }
    const targetRoom = rooms.find((candidate) => candidate.roomId === connection.roomId);
    if (targetRoom && !(targetRoom.connections || []).some((candidate) => candidate.roomId === room.roomId)) {
      findings.push(finding("error", `Room connection ${room.roomId} -> ${connection.roomId} is not reciprocal.`, room.roomId));
    }
  }
  if (!room.evidence?.level) findings.push(finding("error", `Room ${room.roomId} missing evidence level.`, room.roomId));
  if (!evidenceReferences(room.evidence).length || (requireLocalEvidenceFiles && !evidenceFilesExist(room.evidence))) {
    findings.push(finding("error", `Room ${room.roomId} source file is missing.`, evidenceReferences(room.evidence).map((entry) => entry.sourceFile).join("|") || room.roomId));
  }
}

for (const gate of gates) {
  if (!gate.gateId) findings.push(finding("error", "Gate missing gateId.", JSON.stringify(gate)));
  if (!gate.gateType) findings.push(finding("error", `Gate ${gate.gateId} missing gateType.`, gate.gateId));
  if (!gate.evidence?.level) findings.push(finding("error", `Gate ${gate.gateId} missing evidence level.`, gate.gateId));
}

for (const reward of rewards) {
  if (!reward.rewardId) findings.push(finding("error", "Reward missing rewardId.", JSON.stringify(reward)));
  if (!reward.evidence?.level) findings.push(finding("error", `Reward ${reward.rewardId} missing evidence level.`, reward.rewardId));
}

if (states.length < 7) findings.push(finding("error", "First-session flow must include at least 7 states.", "states"));
if (nodes.length !== 7) findings.push(finding("error", `Chapter1 package must expose exactly 7 executable nodes; found ${nodes.length}.`, "chapter1.nodes"));
if (rooms.length > 0 && rooms.length < 40) findings.push(finding("warning", `Chapter1 room chain looks incomplete; found ${rooms.length}.`, "chapter1.rooms"));
if (gates.length === 0) findings.push(finding("warning", "No chapter1 gates were imported.", "chapter1.gates"));

const report = {
  generatedAt: new Date().toISOString(),
  configPath: "config/wuxia_first_session_flow.json",
  validationMode: requireLocalEvidenceFiles ? "full-local-evidence" : "portable-runtime",
  summary: {
    states: states.length,
    actions: actions.length,
    chapter1Nodes: nodes.length,
    chapter1Rooms: rooms.length,
    gates: gates.length,
    rewards: rewards.length,
    errors: findings.filter((item) => item.severity === "error").length,
    warnings: findings.filter((item) => item.severity === "warning").length,
  },
  findings,
};

fs.writeFileSync(path.join(outputDir, "wuxia_first_session_flow_validation_report.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, "wuxia_first_session_flow_validation_report.md"), [
  "# Wuxia First Session Flow Validation",
  "",
  `- States: ${report.summary.states}`,
  `- Actions: ${report.summary.actions}`,
  `- Chapter1 nodes: ${report.summary.chapter1Nodes}`,
  `- Chapter1 rooms: ${report.summary.chapter1Rooms}`,
  `- Gates: ${report.summary.gates}`,
  `- Rewards: ${report.summary.rewards}`,
  `- Errors: ${report.summary.errors}`,
  `- Warnings: ${report.summary.warnings}`,
  "",
  ...findings.map((item) => `- ${item.severity.toUpperCase()}: ${item.message} (${item.where})`),
  "",
].join("\n"), "utf8");

console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.errors > 0) process.exit(1);
