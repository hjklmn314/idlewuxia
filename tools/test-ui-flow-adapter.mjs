import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

import { createChapterSession } from "../src/chapterSession.js";
import { createBrowserAutomationAdapter } from "../src/browserAutomationAdapter.js";
import { createUiFlowAdapter, UI_INTENT_TYPES } from "../src/uiFlowAdapter.js";

const definitions = {
  states: [
    { stateId: "opening", screenId: "screen_opening" },
    { stateId: "result", screenId: "screen_result" },
  ],
  actions: [{
    actionId: "advance",
    fromState: "opening",
    toState: "result",
    requestPayload: {},
    responseModel: { grantState: "advanced" },
  }],
  sessionDefaults: { initialFlags: [] },
  playerSeed: { inventory: {} },
  activeChapter: {
    chapterId: "chapter_fixture",
    nodes: [],
    rooms: [],
    npcs: [],
    interactables: [],
    gates: [],
    rewards: [],
  },
};

const screenContract = {
  screens: {
    screen_opening: { title: "Opening", step: "1/2", mode: "story" },
    screen_result: { title: "Result", step: "2/2", mode: "status" },
  },
};

const session = createChapterSession(definitions, { initialState: "opening" });
const adapter = createUiFlowAdapter({ session, flowContract: definitions, screenContract });

assert.equal(adapter.present().screenId, "screen_opening");
assert.equal(adapter.execute({ type: "dispatchAction", actionId: "advance" }).accepted, true);
assert.equal(adapter.present().screenId, "screen_result");

const beforeRejectedIntent = adapter.snapshot();
assert.deepEqual(
  adapter.execute({ type: "unknown", actionId: "advance" }),
  { accepted: false, status: "rejected", reason: "unsupported_ui_intent", intentType: "unknown" },
);
assert.deepEqual(adapter.snapshot(), beforeRejectedIntent, "unknown intents must be zero-mutation");
assert.equal(
  adapter.execute({ type: "dispatchAction", actionId: "advance", injected: true }).reason,
  "invalid_ui_intent",
  "intent envelopes must reject undeclared fields",
);
assert.deepEqual(adapter.snapshot(), beforeRejectedIntent, "invalid intents must be zero-mutation");

const presented = adapter.present();
presented.screen.title = "External title";
presented.snapshot.player.level = 999;
assert.equal(adapter.present().screen.title, "Result", "presented UI definitions must be detached");
assert.notEqual(adapter.snapshot().player.level, 999, "presented runtime snapshots must be detached");
assert.throws(
  () => createUiFlowAdapter({ session, flowContract: definitions, screenContract: { screens: {} } }).present(),
  /Missing screen contract/,
  "missing screen definitions must fail closed",
);

const calls = [];
const commandSession = {
  snapshot: () => ({ currentState: "opening", state: { screenId: "screen_opening" }, chapter: {}, player: {}, events: [] }),
  dispatch: (actionId) => ({ accepted: true, event: { feedback: actionId } }),
  selectChapterNode: (nodeId) => ({ accepted: true, event: { nodeId, displayText: { zhCN: nodeId } } }),
  selectChapterRoom: (roomId) => ({ accepted: true, event: { roomId, name: roomId } }),
  selectChapterNpc: (roleId) => ({ accepted: true, event: { roleId, name: roleId } }),
  interactWithChapterNpc: (roleId, actionType) => ({ accepted: true, event: { roleId, actionType, feedback: actionType } }),
  selectChapterInteractable: (interactableId) => ({ accepted: true, event: { interactableId, name: interactableId } }),
  interactWithChapterInteractable: (interactableId, actionType) => ({ accepted: true, event: { interactableId, actionType, feedback: actionType } }),
  resolvePendingChoice: (optionId) => ({ accepted: true, event: { optionId, optionLabel: optionId } }),
};
for (const method of Object.keys(commandSession)) {
  if (method === "snapshot") continue;
  const implementation = commandSession[method];
  commandSession[method] = (...args) => {
    calls.push([method, ...args]);
    return implementation(...args);
  };
}
const commandAdapter = createUiFlowAdapter({ session: commandSession, flowContract: definitions, screenContract });
const intentCases = [
  [{ type: "dispatchAction", actionId: "a" }, ["dispatch", "a"]],
  [{ type: "selectNode", nodeId: "n" }, ["selectChapterNode", "n"]],
  [{ type: "selectRoom", roomId: "r" }, ["selectChapterRoom", "r"]],
  [{ type: "selectNpc", roleId: "p" }, ["selectChapterNpc", "p"]],
  [{ type: "interactNpc", roleId: "p", actionType: "talk" }, ["interactWithChapterNpc", "p", "talk"]],
  [{ type: "selectInteractable", interactableId: "i" }, ["selectChapterInteractable", "i"]],
  [{ type: "interactInteractable", interactableId: "i", actionType: "look" }, ["interactWithChapterInteractable", "i", "look"]],
  [{ type: "resolveChoice", optionId: "o" }, ["resolvePendingChoice", "o"]],
];
for (const [intent, expectedCall] of intentCases) {
  assert.equal(commandAdapter.execute(intent).accepted, true);
  assert.deepEqual(calls.at(-1), expectedCall);
}
const intentSchema = JSON.parse(readFileSync(new URL("../config/wuxia_ui_intent_contract.schema.json", import.meta.url), "utf8"));
const validateIntent = new Ajv2020({ allErrors: true, strict: true }).compile(intentSchema);
for (const [intent] of intentCases) assert.equal(validateIntent(intent), true, JSON.stringify(validateIntent.errors));
assert.equal(validateIntent({ type: "dispatchAction", actionId: "a", injected: true }), false);
assert.equal(validateIntent({ type: "dispatchAction", actionId: "   " }), false, "schema must reject whitespace-only IDs");
assert.equal(validateIntent({ type: "dispatchAction", actionId: "  a  " }), true, "schema must preserve runtime acceptance of padded IDs");
assert.equal(commandAdapter.execute({ type: "dispatchAction", actionId: "   " }).accepted, false);
assert.equal(commandAdapter.execute({ type: "dispatchAction", actionId: "  a  " }).accepted, true);
assert.deepEqual(
  [...UI_INTENT_TYPES].sort(),
  intentSchema.oneOf.map((entry) => entry.$ref.split("/").at(-1)).sort(),
  "runtime and schema must expose the same intent types",
);

let renderCount = 0;
const persistence = {
  status: () => ({ status: "ready" }),
  clear: () => ({ status: "cleared" }),
};
const automation = createBrowserAutomationAdapter({
  uiFlowAdapter: commandAdapter,
  render: () => { renderCount += 1; },
  persistence,
});
assert.equal(automation.dispatchAction("a").clicked, true);
assert.equal(automation.selectNode("n").text, "n");
assert.equal(automation.selectRoom("r").clicked, true);
assert.equal(automation.selectNpc("p").clicked, true);
assert.equal(automation.interactNpc("p", "talk").clicked, true);
assert.equal(automation.selectInteractable("i").clicked, true);
assert.equal(automation.interactInteractable("i", "look").clicked, true);
assert.equal(automation.resolveChoice("o").clicked, true);
assert.equal(renderCount, 8, "each automation command must render exactly once");
assert.equal(automation.snapshot().currentState, "opening");
assert.deepEqual(automation.persistenceStatus(), { status: "ready" });
assert.deepEqual(automation.clearSave(), { status: "cleared" });

const mainSource = readFileSync(new URL("../src/wuxia-main.js", import.meta.url), "utf8");
assert.equal(mainSource.includes("state.runtime"), false, "UI controller must not bypass the UI Flow Adapter");
assert.equal(mainSource.includes("createBrowserAutomationAdapter"), true, "browser API must use the automation adapter");

console.log("ui flow adapter contract tests: PASS");
