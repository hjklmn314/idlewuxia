import assert from "node:assert/strict";
import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";
import { createRuntimePersistence, saveEnvelopeChecksum } from "../src/runtimePersistence.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failNextSetKey = "";
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failNextSetKey === key) {
      this.failNextSetKey = "";
      throw new Error(`interrupted write at ${key}`);
    }
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
    chapterId: "test_chapter",
    nodes: [{ nodeId: "node_1", sourceRooms: [] }],
    rooms: [],
    npcs: [],
    interactables: [],
    gates: [],
    rewards: [],
  },
};

const productionContract = JSON.parse(fs.readFileSync(new URL("../config/runtime_persistence_contract.json", import.meta.url), "utf8"));
const envelopeSchema = JSON.parse(fs.readFileSync(new URL("../config/runtime_save_envelope.schema.json", import.meta.url), "utf8"));
const validateEnvelope = new Ajv2020({ allErrors: true, strict: true }).compile(envelopeSchema);
const persistenceContract = {
  ...productionContract,
  storageKey: "idlewuxia.test.save.v1",
  stagingStorageKey: "idlewuxia.test.save.v1.staging",
  backupStorageKey: "idlewuxia.test.save.v1.backup",
  rollbackStorageKey: "idlewuxia.test.save.v1.rollback.v1",
  maxSavedEvents: 2,
};
const fixedNow = () => new Date("2026-08-09T00:00:00.000Z");

function createPersistence(storage, overrides = {}) {
  return createRuntimePersistence({
    storage,
    contract: { ...persistenceContract, ...overrides },
    now: fixedNow,
  });
}

const storage = new MemoryStorage();
const firstPersistence = createPersistence(storage);
assert.equal(firstPersistence.restore(flowContract.schema).status, "empty");

const firstAttached = firstPersistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
assert.equal(firstAttached.runtime.dispatch("choose_origin").accepted, true);
assert.equal(firstAttached.runtime.selectChapterNode("node_1").accepted, true);
firstAttached.runtime.dispatch("unknown_1");
firstAttached.runtime.dispatch("unknown_2");
assert.equal(firstAttached.status().status, "saved");

const storedEnvelope = JSON.parse(storage.getItem(persistenceContract.storageKey));
assert.equal(validateEnvelope(storedEnvelope), true, JSON.stringify(validateEnvelope.errors));
assert.equal(storedEnvelope.checksum.value, saveEnvelopeChecksum(storedEnvelope));
assert.equal(storedEnvelope.state.events.length, 2, "persisted event history must respect the configured cap");
assert.equal(storage.getItem(persistenceContract.stagingStorageKey), null, "committed write must clear staging");
assert.ok(storage.getItem(persistenceContract.backupStorageKey), "subsequent writes must retain the previous primary envelope");

const secondPersistence = createPersistence(storage);
const restored = secondPersistence.restore(flowContract.schema);
assert.equal(restored.status, "restored");
const secondRuntime = createFirstSessionRuntime(flowContract, { initialState: "opening", initialSaveState: restored.state });
const secondSnapshot = secondRuntime.snapshot();
assert.equal(secondSnapshot.currentState, "origin_result");
assert.equal(secondSnapshot.player.origin, "武学世家");
assert.ok(secondSnapshot.flags.includes("origin_selected"));
assert.equal(secondSnapshot.chapter.selectedNodeId, "node_1");

{
  const recoveryStorage = new MemoryStorage();
  const primary = storage.getItem(persistenceContract.storageKey);
  const backup = storage.getItem(persistenceContract.backupStorageKey);
  const corrupted = JSON.parse(primary);
  corrupted.state.player = null;
  recoveryStorage.setItem(persistenceContract.storageKey, JSON.stringify(corrupted));
  recoveryStorage.setItem(persistenceContract.backupStorageKey, backup);
  const recovered = createPersistence(recoveryStorage).restore(flowContract.schema);
  assert.equal(recovered.status, "restored_recovered");
  assert.equal(recovered.recoverySource, "backup");
  assert.equal(recovered.state.player.origin, "武学世家");
  assert.equal(validateEnvelope(JSON.parse(recoveryStorage.getItem(persistenceContract.storageKey))), true);
}

{
  const recoveryStorage = new MemoryStorage();
  recoveryStorage.setItem(persistenceContract.storageKey, "{broken");
  recoveryStorage.setItem(persistenceContract.stagingStorageKey, storage.getItem(persistenceContract.storageKey));
  recoveryStorage.setItem(persistenceContract.backupStorageKey, "{also-broken");
  const recovered = createPersistence(recoveryStorage).restore(flowContract.schema);
  assert.equal(recovered.status, "restored_recovered");
  assert.equal(recovered.recoverySource, "staging");
  assert.equal(recoveryStorage.getItem(persistenceContract.stagingStorageKey), null);
}

{
  const invalidStorage = new MemoryStorage();
  invalidStorage.setItem(persistenceContract.storageKey, "{broken");
  const invalid = createPersistence(invalidStorage).restore(flowContract.schema);
  assert.equal(invalid.status, "ignored_invalid");
  assert.equal(invalid.state, null);
}

{
  const futureStorage = new MemoryStorage();
  const future = fs.readFileSync(new URL("../tests/fixtures/runtime_persistence/v3_future_save.json", import.meta.url), "utf8");
  futureStorage.setItem(persistenceContract.storageKey, future);
  futureStorage.setItem(persistenceContract.backupStorageKey, storage.getItem(persistenceContract.storageKey));
  const incompatible = createPersistence(futureStorage).restore(flowContract.schema);
  assert.equal(incompatible.status, "ignored_incompatible", "a future primary must not silently roll back to an older backup");
  assert.equal(incompatible.state, null);
}

{
  const migrationStorage = new MemoryStorage();
  const legacyRaw = fs.readFileSync(new URL("../tests/fixtures/runtime_persistence/v1_representative_save.json", import.meta.url), "utf8");
  migrationStorage.setItem(persistenceContract.storageKey, legacyRaw);
  const persistence = createPersistence(migrationStorage);
  const migrated = persistence.restore(flowContract.schema);
  assert.equal(migrated.status, "restored_migrated");
  assert.deepEqual(migrated.migrationIds, ["SAVE_MIGRATION_001_V1_TO_V2_ENVELOPE_INTEGRITY"]);
  assert.equal(migrated.state.currentState, "origin_result");
  const current = JSON.parse(migrationStorage.getItem(persistenceContract.storageKey));
  assert.equal(current.schemaVersion, 2);
  assert.equal(current.migration.fromVersion, 1);
  assert.equal(current.checksum.value, saveEnvelopeChecksum(current));
  assert.equal(JSON.parse(migrationStorage.getItem(persistenceContract.rollbackStorageKey)).schemaVersion, 1);
  assert.equal(createPersistence(migrationStorage).restore(flowContract.schema).status, "restored", "migration retry must be idempotent");
  const rollback = persistence.prepareRollback(flowContract.schema);
  assert.equal(rollback.status, "rollback_prepared");
  assert.equal(JSON.parse(migrationStorage.getItem(persistenceContract.storageKey)).schemaVersion, 1);
  assert.equal(JSON.parse(migrationStorage.getItem(persistenceContract.backupStorageKey)).schemaVersion, 2);
}

{
  const interruptedStorage = new MemoryStorage();
  const persistence = createPersistence(interruptedStorage);
  const runtime = createFirstSessionRuntime(flowContract, { initialState: "opening" });
  const attached = persistence.attach(runtime);
  assert.equal(attached.flush().status, "saved");
  const oldPrimary = interruptedStorage.getItem(persistenceContract.storageKey);
  interruptedStorage.failNextSetKey = persistenceContract.storageKey;
  assert.equal(attached.runtime.dispatch("choose_origin").accepted, true, "storage failure must not reject a valid gameplay command");
  assert.equal(attached.status().status, "unavailable");
  assert.equal(interruptedStorage.getItem(persistenceContract.storageKey), oldPrimary, "interrupted primary write must preserve the previous primary");
  const recovered = createPersistence(interruptedStorage).restore(flowContract.schema);
  assert.equal(recovered.status, "restored");
  assert.equal(recovered.state.currentState, "opening", "uncommitted staged state must not replace a valid primary");
}

{
  const invalidStateStorage = new MemoryStorage();
  const persistence = createPersistence(invalidStateStorage);
  const attached = persistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
  const invalidState = attached.runtime.exportSaveState();
  invalidState.player = null;
  const result = persistence.attach({ exportSaveState: () => invalidState }).flush();
  assert.equal(result.status, "rejected_invalid_state");
  assert.equal(invalidStateStorage.getItem(persistenceContract.storageKey), null);
}

{
  const zeroEventStorage = new MemoryStorage();
  const zeroEventPersistence = createPersistence(zeroEventStorage, {
    storageKey: "idlewuxia.test.zero-events",
    stagingStorageKey: "idlewuxia.test.zero-events.staging",
    backupStorageKey: "idlewuxia.test.zero-events.backup",
    rollbackStorageKey: "idlewuxia.test.zero-events.rollback",
    maxSavedEvents: 0,
  });
  const attached = zeroEventPersistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
  attached.runtime.dispatch("unknown");
  assert.equal(JSON.parse(zeroEventStorage.getItem("idlewuxia.test.zero-events")).state.events.length, 0);
}

{
  const clearStorage = new MemoryStorage();
  const attached = createPersistence(clearStorage).attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
  attached.runtime.dispatch("unknown");
  clearStorage.setItem(persistenceContract.rollbackStorageKey, "legacy");
  assert.equal(attached.clear().status, "cleared");
  for (const key of [persistenceContract.storageKey, persistenceContract.stagingStorageKey, persistenceContract.backupStorageKey, persistenceContract.rollbackStorageKey]) {
    assert.equal(clearStorage.getItem(key), null);
  }
}

const throwingStorage = {
  getItem() { throw new Error("storage unavailable"); },
  setItem() { throw new Error("storage unavailable"); },
  removeItem() { throw new Error("storage unavailable"); },
};
const unavailablePersistence = createPersistence(throwingStorage);
assert.equal(unavailablePersistence.restore(flowContract.schema).status, "unavailable");
const unavailableAttached = unavailablePersistence.attach(createFirstSessionRuntime(flowContract, { initialState: "opening" }));
assert.equal(unavailableAttached.runtime.dispatch("choose_origin").accepted, true, "storage failure must not block gameplay");
assert.equal(unavailableAttached.status().status, "unavailable");

console.log("runtime persistence tests: PASS (v2 schema/checksum + migration + atomic staging + backup recovery + rollback + interruption + incompatibility)");
