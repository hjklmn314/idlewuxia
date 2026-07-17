import assert from "node:assert/strict";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";
import { createRuntimePersistence } from "../src/runtimePersistence.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const flowContract = {
  schema: "idlewuxia.first_session_flow.test.v1",
  states: [
    { stateId: "opening", screenId: "opening" },
    { stateId: "origin_result", screenId: "origin_result" },
  ],
  actions: [{
    actionId: "choose_origin",
    fromState: "opening",
    toState: "origin_result",
    requestPayload: {},
    responseModel: {
      grantState: "origin_selected",
      profilePatch: { origin: "武学世家" },
    },
  }],
  playerSeed: { origin: "", inventory: {} },
  activeChapter: {
    chapterId: "test_chapter",
    nodes: [{ nodeId: "node_1", sourceRooms: [] }],
    rooms: [],
    npcs: [],
    interactables: [],
    gates: [],
    rewards: [],
  },
};

const persistenceContract = {
  envelopeSchema: "idlewuxia.runtime_save_envelope.v1",
  stateSchema: "idlewuxia.first_session_runtime_save.v1",
  schemaVersion: 1,
  storageKey: "idlewuxia.test.save.v1",
  maxSavedEvents: 2,
};

const storage = new MemoryStorage();
const firstPersistence = createRuntimePersistence({ storage, contract: persistenceContract });
assert.equal(firstPersistence.restore(flowContract.schema).status, "empty");

const firstAttached = firstPersistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
assert.equal(firstAttached.runtime.dispatch("choose_origin").accepted, true);
assert.equal(firstAttached.runtime.selectChapterNode("node_1").accepted, true);
firstAttached.runtime.dispatch("unknown_1");
firstAttached.runtime.dispatch("unknown_2");
assert.equal(firstAttached.status().status, "saved");

const secondPersistence = createRuntimePersistence({ storage, contract: persistenceContract });
const restored = secondPersistence.restore(flowContract.schema);
assert.equal(restored.status, "restored");
assert.equal(restored.state.events.length, 2, "persisted event history must respect the configured cap");

const secondRuntime = createFirstSessionRuntime(flowContract, {
  initialState: "opening",
  initialSaveState: restored.state,
});
const secondSnapshot = secondRuntime.snapshot();
assert.equal(secondSnapshot.currentState, "origin_result");
assert.equal(secondSnapshot.player.origin, "武学世家");
assert.ok(secondSnapshot.flags.includes("origin_selected"));
assert.equal(secondSnapshot.chapter.selectedNodeId, "node_1");

const storedEnvelope = JSON.parse(storage.getItem(persistenceContract.storageKey));
storedEnvelope.schemaVersion = 999;
storage.setItem(persistenceContract.storageKey, JSON.stringify(storedEnvelope));
const incompatible = createRuntimePersistence({ storage, contract: persistenceContract }).restore(flowContract.schema);
assert.equal(incompatible.status, "ignored_incompatible");
assert.equal(incompatible.state, null);

storedEnvelope.schemaVersion = persistenceContract.schemaVersion;
storedEnvelope.state.player = null;
storage.setItem(persistenceContract.storageKey, JSON.stringify(storedEnvelope));
const invalid = createRuntimePersistence({ storage, contract: persistenceContract }).restore(flowContract.schema);
assert.equal(invalid.status, "ignored_invalid");
assert.equal(invalid.state, null);

const zeroEventStorage = new MemoryStorage();
const zeroEventPersistence = createRuntimePersistence({
  storage: zeroEventStorage,
  contract: { ...persistenceContract, storageKey: "idlewuxia.test.zero-events", maxSavedEvents: 0 },
});
const zeroEventAttached = zeroEventPersistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
zeroEventAttached.runtime.dispatch("unknown");
assert.equal(JSON.parse(zeroEventStorage.getItem("idlewuxia.test.zero-events")).state.events.length, 0);

const throwingStorage = {
  getItem() { throw new Error("storage unavailable"); },
  setItem() { throw new Error("storage unavailable"); },
  removeItem() { throw new Error("storage unavailable"); },
};
const unavailablePersistence = createRuntimePersistence({ storage: throwingStorage, contract: persistenceContract });
assert.equal(unavailablePersistence.restore(flowContract.schema).status, "unavailable");
const unavailableAttached = unavailablePersistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
assert.equal(unavailableAttached.runtime.dispatch("choose_origin").accepted, true, "storage failure must not block gameplay");
assert.equal(unavailableAttached.status().status, "unavailable");

console.log("runtime persistence tests: PASS (restore + event cap + compatibility + storage isolation)");
