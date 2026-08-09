import { cloneData } from "./dataClone.js";
import { isValidPendingChoice } from "./resultExecutionModules.js";

function statusRecord(status, detail = "", extra = {}) {
  return { status, detail, ...extra };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value) {
  return isRecord(value)
    && Object.values(value).every((item) => typeof item === "string" || typeof item === "number");
}

function isStringArrayRecord(value) {
  return isRecord(value)
    && Object.values(value).every((item) => isStringArray(item));
}

function validCombatSnapshot(value) {
  return isRecord(value)
    && value.schema === "idlewuxia.combat_runtime.v1"
    && typeof value.encounterId === "string"
    && Array.isArray(value.playerUnitIds)
    && Array.isArray(value.enemyUnitIds)
    && Array.isArray(value.units)
    && value.units.every((unit) => isRecord(unit) && typeof unit.unitId === "string" && Number.isFinite(Number(unit.hp)) && Number.isFinite(Number(unit.hpMax)))
    && Array.isArray(value.events)
    && value.events.every(isRecord)
    && ["idle", "active", "finished"].includes(value.status);
}

function validRuntimeStateShape(state) {
  return isRecord(state)
    && typeof state.currentState === "string"
    && typeof state.runtimeSchema === "string"
    && typeof state.chapterId === "string"
    && isStringArray(state.flags)
    && isRecord(state.player)
    && isRecord(state.taskState)
    && Array.isArray(state.events)
    && state.events.every(isRecord)
    && typeof state.selectedChapterNodeId === "string"
    && typeof state.selectedChapterRoomId === "string"
    && typeof state.selectedChapterNpcId === "string"
    && typeof state.selectedChapterInteractableId === "string"
    && isStringArray(state.hiddenEntityIds)
    && isStringArrayRecord(state.addedEntityIdsByRoom)
    && isStringRecord(state.replacementEntityById)
    && isStringRecord(state.mapMarkers)
    && (state.pendingCombat === null || (isRecord(state.pendingCombat)
      && (state.pendingCombat.combatSnapshot === undefined || state.pendingCombat.combatSnapshot === null || validCombatSnapshot(state.pendingCombat.combatSnapshot))))
    && (
      state.pendingChoice === undefined
      || state.pendingChoice === null
      || isValidPendingChoice(state.pendingChoice)
    );
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function saveEnvelopeChecksum(envelope = {}) {
  const { checksum: _checksum, ...unsignedEnvelope } = envelope;
  return fnv1a32(JSON.stringify(stableValue(unsignedEnvelope)));
}

export function createRuntimePersistence({ storage, contract = {}, now = () => new Date() }) {
  const storageKey = contract.storageKey || "idlewuxia.first_session.save.v1";
  const stagingStorageKey = contract.stagingStorageKey || `${storageKey}.staging`;
  const backupStorageKey = contract.backupStorageKey || `${storageKey}.backup`;
  const rollbackStorageKey = contract.rollbackStorageKey || `${storageKey}.rollback`;
  const schemaVersion = Number(contract.schemaVersion || 1);
  const minimumReadableVersion = Number(contract.minimumReadableVersion || schemaVersion);
  const checksumAlgorithm = contract.integrity?.algorithm || "fnv1a32";
  const configuredEventLimit = contract.maxSavedEvents === undefined ? 64 : contract.maxSavedEvents;
  const maxSavedEvents = Math.max(0, Number(configuredEventLimit));
  const migrations = new Map((contract.migrations || []).map((migration) => [Number(migration.fromVersion), migration]));
  let writeSequence = 0;
  let lastStatus = statusRecord("idle");

  function storageAvailable(method) {
    return Boolean(storage && typeof storage[method] === "function");
  }

  function bestEffortRemove(key) {
    if (!storageAvailable("removeItem")) return;
    try {
      storage.removeItem(key);
    } catch {
      // A verified primary save remains authoritative even if stale staging cleanup fails.
    }
  }

  function currentEnvelopeForState(runtimeState, migration = {}) {
    const state = cloneData(runtimeState);
    state.events = maxSavedEvents > 0 ? (state.events || []).slice(-maxSavedEvents) : [];
    writeSequence += 1;
    const timestamp = now();
    const savedAt = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
    const envelope = {
      $schema: contract.envelopeSchema,
      schemaVersion,
      runtimeSchema: state.runtimeSchema || "",
      savedAt,
      writeId: `${savedAt}:${writeSequence}`,
      migration: {
        fromVersion: Number(migration.fromVersion || schemaVersion),
        appliedIds: [...(migration.appliedIds || [])],
      },
      state,
    };
    envelope.checksum = { algorithm: checksumAlgorithm, value: saveEnvelopeChecksum(envelope) };
    return envelope;
  }

  function parseCandidate(raw, expectedRuntimeSchema) {
    if (!raw) return { accepted: false, category: "empty", reason: "save is empty" };
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return { accepted: false, category: "corrupt", reason: "save JSON is malformed" };
    }
    const version = Number(envelope?.schemaVersion);
    if (!Number.isInteger(version)) return { accepted: false, category: "corrupt", reason: "save version is invalid" };
    if (version > schemaVersion) return { accepted: false, category: "future", reason: "save was created by a newer build" };
    if (version < minimumReadableVersion) return { accepted: false, category: "incompatible", reason: "save version is below the readable floor" };
    const expectedEnvelopeSchema = version === schemaVersion
      ? contract.envelopeSchema
      : contract.legacyEnvelopeSchemas?.[String(version)];
    if (!expectedEnvelopeSchema || envelope?.$schema !== expectedEnvelopeSchema) {
      return { accepted: false, category: "incompatible", reason: "save envelope schema mismatch" };
    }
    if (envelope?.runtimeSchema !== expectedRuntimeSchema || envelope?.state?.runtimeSchema !== expectedRuntimeSchema) {
      return { accepted: false, category: "incompatible", reason: "runtime schema mismatch" };
    }
    if (envelope?.state?.$schema !== contract.stateSchema) {
      return { accepted: false, category: "incompatible", reason: "save state schema mismatch" };
    }
    if (!validRuntimeStateShape(envelope.state)) {
      return { accepted: false, category: "corrupt", reason: "save state shape is invalid" };
    }
    if (version === schemaVersion) {
      if (envelope?.checksum?.algorithm !== checksumAlgorithm || envelope?.checksum?.value !== saveEnvelopeChecksum(envelope)) {
        return { accepted: false, category: "corrupt", reason: "save checksum mismatch" };
      }
      return { accepted: true, category: "current", envelope, raw };
    }
    const appliedIds = [];
    let currentVersion = version;
    while (currentVersion < schemaVersion) {
      const migration = migrations.get(currentVersion);
      if (!migration || Number(migration.toVersion) !== currentVersion + 1) {
        return { accepted: false, category: "incompatible", reason: `missing save migration from version ${currentVersion}` };
      }
      appliedIds.push(migration.id);
      currentVersion = Number(migration.toVersion);
    }
    return {
      accepted: true,
      category: "migrated",
      envelope: currentEnvelopeForState(envelope.state, { fromVersion: version, appliedIds }),
      raw,
      fromVersion: version,
      appliedIds,
    };
  }

  function verifyCurrentRaw(raw, expectedRuntimeSchema) {
    const parsed = parseCandidate(raw, expectedRuntimeSchema);
    return parsed.accepted && parsed.category === "current" ? parsed : null;
  }

  function promoteEnvelope(envelope, expectedRuntimeSchema, { backupRaw = "", rollbackRaw = "", preserveBackup = false } = {}) {
    const serialized = JSON.stringify(envelope);
    storage.setItem(stagingStorageKey, serialized);
    if (!verifyCurrentRaw(storage.getItem(stagingStorageKey), expectedRuntimeSchema)) throw new Error("staging save verification failed");
    if (rollbackRaw && !storage.getItem(rollbackStorageKey)) storage.setItem(rollbackStorageKey, rollbackRaw);
    if (backupRaw && !preserveBackup) storage.setItem(backupStorageKey, backupRaw);
    storage.setItem(storageKey, serialized);
    if (!verifyCurrentRaw(storage.getItem(storageKey), expectedRuntimeSchema)) throw new Error("primary save verification failed");
    bestEffortRemove(stagingStorageKey);
  }

  function restore(expectedRuntimeSchema) {
    if (!storageAvailable("getItem")) {
      lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
      return { ...lastStatus, state: null };
    }
    try {
      const primaryRaw = storage.getItem(storageKey);
      if (!primaryRaw) {
        const staged = parseCandidate(storage.getItem(stagingStorageKey), expectedRuntimeSchema);
        const backup = parseCandidate(storage.getItem(backupStorageKey), expectedRuntimeSchema);
        const recovery = staged.accepted ? { source: "staging", parsed: staged } : backup.accepted ? { source: "backup", parsed: backup } : null;
        if (!recovery) {
          lastStatus = statusRecord("empty");
          return { ...lastStatus, state: null };
        }
        promoteEnvelope(recovery.parsed.envelope, expectedRuntimeSchema, { preserveBackup: true });
        lastStatus = statusRecord("restored_recovered", `restored from ${recovery.source}`, { recoverySource: recovery.source });
        return { ...lastStatus, state: cloneData(recovery.parsed.envelope.state) };
      }

      const primary = parseCandidate(primaryRaw, expectedRuntimeSchema);
      if (primary.accepted) {
        if (primary.category === "migrated") {
          promoteEnvelope(primary.envelope, expectedRuntimeSchema, { backupRaw: primaryRaw, rollbackRaw: primaryRaw });
          lastStatus = statusRecord("restored_migrated", `migrated save ${primary.fromVersion} -> ${schemaVersion}`, {
            migrationIds: [...primary.appliedIds],
          });
        } else {
          bestEffortRemove(stagingStorageKey);
          lastStatus = statusRecord("restored");
        }
        return { ...lastStatus, state: cloneData(primary.envelope.state) };
      }
      if (["future", "incompatible"].includes(primary.category)) {
        lastStatus = statusRecord("ignored_incompatible", primary.reason);
        return { ...lastStatus, state: null };
      }

      const staged = parseCandidate(storage.getItem(stagingStorageKey), expectedRuntimeSchema);
      const backup = parseCandidate(storage.getItem(backupStorageKey), expectedRuntimeSchema);
      const recovery = staged.accepted ? { source: "staging", parsed: staged } : backup.accepted ? { source: "backup", parsed: backup } : null;
      if (!recovery) {
        lastStatus = statusRecord("ignored_invalid", primary.reason);
        return { ...lastStatus, state: null };
      }
      promoteEnvelope(recovery.parsed.envelope, expectedRuntimeSchema, { preserveBackup: true });
      lastStatus = statusRecord("restored_recovered", `primary invalid; restored from ${recovery.source}`, { recoverySource: recovery.source });
      return { ...lastStatus, state: cloneData(recovery.parsed.envelope.state) };
    } catch (error) {
      lastStatus = statusRecord("unavailable", error?.message || String(error));
      return { ...lastStatus, state: null };
    }
  }

  function save(runtimeState) {
    if (!storageAvailable("setItem") || !storageAvailable("getItem") || !storageAvailable("removeItem")) {
      lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
      return lastStatus;
    }
    try {
      if (!validRuntimeStateShape(runtimeState)) {
        lastStatus = statusRecord("rejected_invalid_state", "runtime state shape is invalid");
        return lastStatus;
      }
      const envelope = currentEnvelopeForState(runtimeState);
      const primaryRaw = storage.getItem(storageKey) || "";
      let rollbackRaw = "";
      if (primaryRaw) {
        try {
          const primaryVersion = Number(JSON.parse(primaryRaw)?.schemaVersion);
          if (primaryVersion < schemaVersion) rollbackRaw = primaryRaw;
        } catch {
          rollbackRaw = "";
        }
      }
      promoteEnvelope(envelope, runtimeState.runtimeSchema, { backupRaw: primaryRaw, rollbackRaw });
      lastStatus = statusRecord("saved", "", { writeId: envelope.writeId, checksum: envelope.checksum.value });
      return lastStatus;
    } catch (error) {
      lastStatus = statusRecord("unavailable", error?.message || String(error));
      return lastStatus;
    }
  }

  function prepareRollback(expectedRuntimeSchema) {
    if (!storageAvailable("getItem") || !storageAvailable("setItem")) {
      lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
      return lastStatus;
    }
    try {
      const rollbackRaw = storage.getItem(rollbackStorageKey);
      const rollback = parseCandidate(rollbackRaw, expectedRuntimeSchema);
      if (!rollback.accepted) {
        lastStatus = statusRecord("rollback_unavailable", rollback.reason || "rollback save is unavailable");
        return lastStatus;
      }
      const primaryRaw = storage.getItem(storageKey);
      if (primaryRaw) storage.setItem(backupStorageKey, primaryRaw);
      storage.setItem(storageKey, rollbackRaw);
      lastStatus = statusRecord("rollback_prepared", "previous-version save copied to primary", {
        rollbackVersion: Number(JSON.parse(rollbackRaw).schemaVersion),
      });
      return lastStatus;
    } catch (error) {
      lastStatus = statusRecord("unavailable", error?.message || String(error));
      return lastStatus;
    }
  }

  function attach(runtime) {
    const facade = {};

    function flush() {
      return save(runtime.exportSaveState());
    }

    function clear() {
      if (!storageAvailable("removeItem")) {
        lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
        return lastStatus;
      }
      try {
        for (const key of [storageKey, stagingStorageKey, backupStorageKey, rollbackStorageKey]) storage.removeItem(key);
        lastStatus = statusRecord("cleared");
      } catch (error) {
        lastStatus = statusRecord("unavailable", error?.message || String(error));
      }
      return lastStatus;
    }

    for (const [name, value] of Object.entries(runtime)) {
      if (typeof value !== "function") {
        facade[name] = value;
        continue;
      }
      if (name === "snapshot" || name === "exportSaveState") {
        facade[name] = value.bind(runtime);
        continue;
      }
      facade[name] = (...args) => {
        const result = value.apply(runtime, args);
        flush();
        return result;
      };
    }

    return {
      runtime: facade,
      flush,
      clear,
      status: () => ({ ...lastStatus }),
    };
  }

  return { restore, attach, prepareRollback };
}
