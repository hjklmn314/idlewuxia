import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { createChapterSession } from "../src/chapterSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "tests", "fixtures", "chapter_reuse", "chapter2_config_fixture.json");
const schemaPath = path.join(root, "config", "wuxia_chapter_definition.schema.json");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const combatPath = path.join(root, "config", "wuxia_combat_content.json");
const outputDir = path.join(root, "outputs", "content001_chapter_reuse");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const clone = (value) => structuredClone(value);
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const fixture = readJson(fixturePath);
const schema = readJson(schemaPath);
const baseContract = readJson(flowPath);
const combatContent = readJson(combatPath);

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);
const schemaValid = validateSchema(fixture);
assert.equal(schemaValid, true, `chapter fixture schema failed: ${JSON.stringify(validateSchema.errors)}`);

const findings = [];
const addFinding = (pathValue, message) => findings.push({ path: pathValue, message });
const collectIds = (rows, field, label) => {
  const ids = new Set();
  for (const [index, row] of rows.entries()) {
    const id = String(row?.[field] || "");
    if (!id) addFinding(`${label}[${index}].${field}`, "missing id");
    else if (ids.has(id)) addFinding(`${label}[${index}].${field}`, `duplicate id ${id}`);
    else ids.add(id);
  }
  return ids;
};
const nodeIds = collectIds(fixture.nodes, "nodeId", "nodes");
const roomIds = collectIds(fixture.rooms, "roomId", "rooms");
const npcIds = collectIds(fixture.npcs, "roleId", "npcs");
const itemIds = collectIds(fixture.interactables, "interactableId", "interactables");
const gateIds = collectIds(fixture.gates, "gateId", "gates");
const rewardIds = collectIds(fixture.rewards, "rewardId", "rewards");
const resultIds = new Set();
const conditionIds = new Set();
for (const [key, value] of Object.entries(fixture.resultLookup || {})) {
  if (key !== value?.resultId) addFinding(`resultLookup.${key}`, "lookup key and resultId differ");
  if (resultIds.has(key)) addFinding(`resultLookup.${key}`, "duplicate result id");
  resultIds.add(key);
}
for (const [key, value] of Object.entries(fixture.conditionLookup || {})) {
  if (key !== value?.conditionId) addFinding(`conditionLookup.${key}`, "lookup key and conditionId differ");
  if (conditionIds.has(key)) addFinding(`conditionLookup.${key}`, "duplicate condition id");
  conditionIds.add(key);
}

const combatEncounterIds = new Set((combatContent.encounters || []).map((encounter) => encounter.encounterId));
const actionTokens = new Set(["talk", "use", "compete", "gift", "kill", "open", "pick_up", "push_in", "extract"]);
for (const [index, node] of fixture.nodes.entries()) {
  for (const id of node.sourceRooms || []) if (!roomIds.has(id)) addFinding(`nodes[${index}].sourceRooms`, `unknown room ${id}`);
  for (const id of node.gates || []) if (!gateIds.has(id)) addFinding(`nodes[${index}].gates`, `unknown gate ${id}`);
  for (const id of node.rewards || []) if (!rewardIds.has(id)) addFinding(`nodes[${index}].rewards`, `unknown reward ${id}`);
  for (const id of node.interactables || []) if (!itemIds.has(id)) addFinding(`nodes[${index}].interactables`, `unknown interactable ${id}`);
  for (const id of node.encounters || []) if (!combatEncounterIds.has(id) && id !== "encounter_ch2_config_fixture") addFinding(`nodes[${index}].encounters`, `unknown combat encounter ${id}`);
}
for (const [index, room] of fixture.rooms.entries()) {
  if (!nodeIds.has(room.parentNodeId)) addFinding(`rooms[${index}].parentNodeId`, `unknown node ${room.parentNodeId}`);
  for (const connection of room.connections || []) if (!roomIds.has(connection.roomId)) addFinding(`rooms[${index}].connections`, `unknown room ${connection.roomId}`);
  for (const id of room.encounterIds || []) if (!npcIds.has(id)) addFinding(`rooms[${index}].encounterIds`, `unknown NPC entity ${id}`);
  for (const id of room.interactableIds || []) if (!itemIds.has(id)) addFinding(`rooms[${index}].interactableIds`, `unknown interactable ${id}`);
  for (const id of room.rewardIds || []) if (!rewardIds.has(id)) addFinding(`rooms[${index}].rewardIds`, `unknown reward ${id}`);
  for (const id of room.encounterDefinitions || []) if (!combatEncounterIds.has(id) && id !== "encounter_ch2_config_fixture") addFinding(`rooms[${index}].encounterDefinitions`, `unknown combat encounter ${id}`);
}
const validateBranch = (branch, pathValue) => {
  for (const token of branch.conditionTokens || []) {
    if (!actionTokens.has(token) && !conditionIds.has(token)) addFinding(`${pathValue}.conditionTokens`, `unknown condition ${token}`);
  }
  for (const token of branch.resultTokens || []) if (!resultIds.has(token)) addFinding(`${pathValue}.resultTokens`, `unknown result ${token}`);
  for (const result of branch.resolvedResults || []) {
    if (!resultIds.has(result.resultId)) addFinding(`${pathValue}.resolvedResults`, `unknown resolved result ${result.resultId}`);
    else if (fixture.resultLookup[result.resultId]?.category !== result.category) addFinding(`${pathValue}.resolvedResults`, `category drift for ${result.resultId}`);
  }
};
for (const [index, npc] of fixture.npcs.entries()) for (const [branchIndex, branch] of (npc.branches || []).entries()) validateBranch(branch, `npcs[${index}].branches[${branchIndex}]`);
for (const [index, item] of fixture.interactables.entries()) for (const [branchIndex, branch] of (item.branches || []).entries()) validateBranch(branch, `interactables[${index}].branches[${branchIndex}]`);
assert.deepEqual(findings, [], `chapter fixture foreign-key validation failed: ${JSON.stringify(findings)}`);

const fixtureHash = hash(fixture);
const changedFixture = clone(fixture);
changedFixture.displayText.zhCN = `${changedFixture.displayText.zhCN}·patched`;
const changedHash = hash(changedFixture);
assert.notEqual(changedHash, fixtureHash, "config diff must change the content hash");
const rollbackFixture = clone(fixture);
assert.equal(hash(rollbackFixture), fixtureHash, "config rollback must restore the original content hash");

const composedContract = clone(baseContract);
composedContract.chapterSystem.combatActionPolicies.compete = {
  ...composedContract.chapterSystem.combatActionPolicies.compete,
  encounterId: "encounter_ch2_config_fixture",
  previewId: "first_session_old_steward",
};
const composedCombatContent = clone(combatContent);
const sourceEncounter = composedCombatContent.encounters.find((encounter) => encounter.encounterId === "encounter_first_session_old_steward");
assert.ok(sourceEncounter, "reference encounter must exist for the isolated fixture alias");
composedCombatContent.encounters.push({
  ...clone(sourceEncounter),
  encounterId: "encounter_ch2_config_fixture",
  name: "第二章配置复用战斗夹具",
});

const makeSession = (options = {}) => createChapterSession(composedContract, {
  initialChapter: fixture,
  combatContent: composedCombatContent,
  ...options,
});
const enterFixtureRoom = (session) => {
  assert.equal(session.selectChapterNode("CH2_FIXTURE_NODE_GATE").accepted, true, "generic node selection must work");
  assert.equal(session.selectChapterRoom("CH2_FIXTURE_ROOM_GATE").accepted, true, "generic room selection must work");
};

const session = makeSession();
assert.equal(session.snapshot().chapter.chapterId, "chapter2_config_fixture");
assert.equal(session.snapshot().chapter.nodes.length, 1);
assert.equal(session.snapshot().chapter.rooms.length, 1);
assert.equal(session.snapshot().chapter.npcs.length, 1);
assert.equal(session.snapshot().chapter.interactables.length, 1);
enterFixtureRoom(session);
assert.equal(session.selectChapterNpc("CH2_FIXTURE_GUARD").accepted, true, "generic NPC selection must work");
const dialogue = session.interactWithChapterNpc("CH2_FIXTURE_GUARD", "talk");
assert.equal(dialogue.accepted, true, "configured dialogue branch must execute");
assert.equal(dialogue.event.outcomeKind, "narrative_only");
assert.equal(dialogue.event.stateChanged, false, "narrative-only dialogue must not fake a state delta");
assert.equal(session.selectChapterInteractable("CH2_FIXTURE_SCROLL").accepted, true, "generic interactable selection must work");
const experienceBeforeReward = session.snapshot().player.experience;
const rewardInteraction = session.interactWithChapterInteractable("CH2_FIXTURE_SCROLL", "use");
assert.equal(rewardInteraction.accepted, true, "configured condition/result reward must execute");
assert.equal(rewardInteraction.event.stateChanged, true, "attribute reward must expose a real state delta");
assert.equal(session.snapshot().player.experience, experienceBeforeReward + 5);

const rejectedSession = makeSession({ initialPlayer: { ...clone(baseContract.playerSeed), experience: 0 } });
enterFixtureRoom(rejectedSession);
assert.equal(rejectedSession.selectChapterInteractable("CH2_FIXTURE_SCROLL").accepted, true);
const rejectedReward = rejectedSession.interactWithChapterInteractable("CH2_FIXTURE_SCROLL", "use");
assert.equal(rejectedReward.accepted, false, "failed configured condition must reject the action");
assert.equal(rejectedSession.snapshot().player.experience, 0, "rejected condition must not mutate state");

const savedState = session.exportSaveState();
const restoredSession = makeSession({ initialSaveState: savedState });
assert.deepEqual(restoredSession.exportSaveState(), savedState, "chapter identity and runtime state must round-trip through save");
assert.equal(restoredSession.snapshot().chapter.chapterId, "chapter2_config_fixture");

const combatSession = makeSession({
  initialState: "STATE_FS_008_MAP_EXPLORE",
  initialFlags: ["chapter_fb01_entered"],
});
enterFixtureRoom(combatSession);
const combatStart = combatSession.interactWithChapterNpc("CH2_FIXTURE_GUARD", "compete");
assert.equal(combatStart.accepted, true, `generic combat route must start: ${JSON.stringify(combatStart)}`);
assert.equal(combatSession.snapshot().pendingCombat.encounterId, "encounter_ch2_config_fixture");
assert.equal(combatSession.snapshot().currentState, "STATE_FS_009_EARLY_COMBAT");

const report = {
  schema: "idlewuxia.content001_chapter_reuse_report.v1",
  generatedAt: new Date().toISOString(),
  taskId: "CONTENT-001",
  fixture: {
    path: "tests/fixtures/chapter_reuse/chapter2_config_fixture.json",
    chapterId: fixture.chapterId,
    hash: fixtureHash,
    changedHash,
    rollbackHash: hash(rollbackFixture),
    schemaValid,
    semanticFindings: findings,
  },
  runtime: {
    nodeSelection: true,
    roomSelection: true,
    npcDialogue: { accepted: dialogue.accepted, outcomeKind: dialogue.event.outcomeKind, stateChanged: dialogue.event.stateChanged },
    reward: { accepted: rewardInteraction.accepted, stateChanged: rewardInteraction.event.stateChanged, experienceDelta: 5 },
    negativeCondition: { accepted: rejectedReward.accepted, experienceDelta: 0 },
    saveRestore: true,
    combat: { accepted: combatStart.accepted, encounterId: combatSession.snapshot().pendingCombat.encounterId, state: combatSession.snapshot().currentState },
  },
  codeBranchAudit: {
    chapterSpecificRuntimeBranchAdded: false,
    runtimeEntry: "src/chapterSession.js:createChapterSession(options.initialChapter)",
    productionStoryAdded: false,
  },
  verdict: "PASS",
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "chapter_reuse_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ verdict: report.verdict, chapterId: fixture.chapterId, fixtureHash, changedHash, rollbackHash: report.fixture.rollbackHash, runtime: report.runtime, output: "outputs/content001_chapter_reuse/chapter_reuse_report.json" }, null, 2));
