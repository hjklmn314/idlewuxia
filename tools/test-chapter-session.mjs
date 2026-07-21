import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChapterSession } from "../src/chapterSession.js";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const contract = {
  schema: "idlewuxia.chapter_session_contract_test.v1",
  states: [
    { stateId: "opening", screenId: "opening" },
    { stateId: "result", screenId: "result" },
  ],
  actions: [{
    actionId: "advance",
    fromState: "opening",
    toState: "result",
    requestPayload: {},
    responseModel: {
      grantState: "advanced",
      profilePatch: { origin: "wandering_swordsman" },
    },
  }],
  sessionDefaults: { initialFlags: ["configured_start"] },
  playerSeed: { origin: "", inventory: {} },
  chapterSystem: {
    navigationPolicy: {
      schema: "idlewuxia.navigation_policy.v1",
      roomEntryCondition: { actionName: "enter_room", targetRoomField: "arg2" },
      blockerResult: { actionName: "block_movement" },
      projectBridge: { mode: "allow_configured_room_selection", mutationPolicy: "navigation_only" },
      failurePolicy: "reject_unknown_definition_or_unconfigured_route",
    },
  },
  activeChapter: {
    chapterId: "chapter_fixture",
    nodes: [{ nodeId: "node_1", sourceRooms: [] }],
    rooms: [],
    npcs: [],
    interactables: [],
    gates: [],
    rewards: [],
  },
};

const session = createChapterSession(contract, { initialState: "opening" });
assert.deepEqual(
  Object.keys(session).sort(),
  [
    "dispatch",
    "exportSaveState",
    "interactWithChapterInteractable",
    "interactWithChapterNpc",
    "resolvePendingChoice",
    "resolvePendingCombat",
    "selectChapterInteractable",
    "selectChapterNode",
    "selectChapterNpc",
    "selectChapterRoom",
    "snapshot",
  ],
  "ChapterSession must expose only the established domain command/query surface",
);

const before = session.snapshot();
assert.equal(before.currentState, "opening");
assert.equal(before.chapter.chapterId, "chapter_fixture");
assert.deepEqual(before.flags, ["configured_start"], "default session flags must come from configuration");

const transition = session.dispatch("advance");
assert.equal(transition.accepted, true);
assert.equal(transition.snapshot.currentState, "result");
assert.equal(transition.snapshot.player.origin, "wandering_swordsman");
assert.ok(transition.snapshot.flags.includes("advanced"));

const selected = session.selectChapterNode("node_1");
assert.equal(selected.accepted, true);
assert.equal(session.snapshot().chapter.selectedNodeId, "node_1");

const detached = session.snapshot();
detached.player.origin = "external_mutation";
detached.events.push({ type: "external_mutation" });
assert.equal(session.snapshot().player.origin, "wandering_swordsman");
assert.equal(session.snapshot().events.some((event) => event.type === "external_mutation"), false);

const restored = createChapterSession(contract, {
  initialState: "opening",
  initialSaveState: session.exportSaveState(),
});
assert.deepEqual(restored.exportSaveState(), session.exportSaveState());

const mutableDefinitions = structuredClone(contract);
const isolatedSession = createChapterSession(mutableDefinitions, { initialState: "opening" });
mutableDefinitions.actions[0].toState = "external_state";
mutableDefinitions.actions[0].responseModel.profilePatch.origin = "external_origin";
const isolatedTransition = isolatedSession.dispatch("advance");
assert.equal(isolatedTransition.snapshot.currentState, "result", "session must own an immutable definition snapshot");
assert.equal(isolatedTransition.snapshot.player.origin, "wandering_swordsman");

const exposedDefinitions = isolatedSession.snapshot();
exposedDefinitions.chapter.nodes[0].nodeId = "external_node";
exposedDefinitions.chapter.npcs.push({ roleId: "external_npc" });
assert.equal(isolatedSession.snapshot().chapter.nodes[0].nodeId, "node_1", "snapshot definitions must be detached");
assert.equal(isolatedSession.snapshot().chapter.npcs.length, 0);

const eventIsolationSession = createChapterSession(contract, { initialState: "opening" });
const returnedCommand = eventIsolationSession.dispatch("advance");
returnedCommand.event.type = "external_event_type";
returnedCommand.event.grants.push("external_grant");
assert.equal(eventIsolationSession.exportSaveState().events[0].type, "commandAccepted", "returned events must be detached");
assert.equal(eventIsolationSession.exportSaveState().events[0].grants.includes("external_grant"), false);

const externalInitialChapter = structuredClone(contract.activeChapter);
const initialChapterSession = createChapterSession(
  { ...contract, activeChapter: undefined },
  { initialState: "opening", initialChapter: externalInitialChapter },
);
externalInitialChapter.chapterId = "external_chapter";
externalInitialChapter.nodes[0].nodeId = "external_node";
assert.equal(initialChapterSession.snapshot().chapter.chapterId, "chapter_fixture", "initialChapter must be cloned");
assert.equal(initialChapterSession.snapshot().chapter.nodes[0].nodeId, "node_1");

const directSession = createChapterSession(contract, { initialState: "opening" });
const compatibilityFacade = createFirstSessionRuntime(contract, { initialState: "opening" });
for (const command of [
  (runtime) => runtime.dispatch("advance"),
  (runtime) => runtime.selectChapterNode("node_1"),
  (runtime) => runtime.dispatch("unknown_action"),
]) {
  assert.deepEqual(command(compatibilityFacade), command(directSession));
}
assert.deepEqual(
  compatibilityFacade.exportSaveState(),
  directSession.exportSaveState(),
  "legacy factory must remain an exact compatibility facade",
);

const moduleSource = readFileSync(new URL("../src/chapterSession.js", import.meta.url), "utf8");
assert.equal(moduleSource.includes("new_install_or_new_save"), false, "ChapterSession must not hard-code a concrete state flag");

console.log("chapter session contract tests: PASS");
