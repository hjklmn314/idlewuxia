import { cloneData } from "./dataClone.js";

function statusRecord(status, detail = "") {
  return { status, detail };
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
    && (state.pendingCombat === null || isRecord(state.pendingCombat));
}

export function createRuntimePersistence({ storage, contract = {} }) {
  const storageKey = contract.storageKey || "idlewuxia.first_session.save.v1";
  const schemaVersion = Number(contract.schemaVersion || 1);
  const configuredEventLimit = contract.maxSavedEvents === undefined ? 64 : contract.maxSavedEvents;
  const maxSavedEvents = Math.max(0, Number(configuredEventLimit));
  let lastStatus = statusRecord("idle");

  function restore(expectedRuntimeSchema) {
    if (!storage || typeof storage.getItem !== "function") {
      lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
      return { ...lastStatus, state: null };
    }
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) {
        lastStatus = statusRecord("empty");
        return { ...lastStatus, state: null };
      }
      const envelope = JSON.parse(raw);
      const compatible = envelope?.$schema === contract.envelopeSchema
        && Number(envelope?.schemaVersion) === schemaVersion
        && envelope?.runtimeSchema === expectedRuntimeSchema
        && envelope?.state?.$schema === contract.stateSchema
        && envelope?.state?.runtimeSchema === expectedRuntimeSchema;
      if (!compatible) {
        lastStatus = statusRecord("ignored_incompatible", "save schema or runtime schema mismatch");
        return { ...lastStatus, state: null };
      }
      if (!validRuntimeStateShape(envelope.state)) {
        lastStatus = statusRecord("ignored_invalid", "save state shape is invalid");
        return { ...lastStatus, state: null };
      }
      lastStatus = statusRecord("restored");
      return { ...lastStatus, state: cloneData(envelope.state) };
    } catch (error) {
      lastStatus = statusRecord("unavailable", error?.message || String(error));
      return { ...lastStatus, state: null };
    }
  }

  function save(runtimeState) {
    if (!storage || typeof storage.setItem !== "function") {
      lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
      return lastStatus;
    }
    try {
      const state = cloneData(runtimeState);
      state.events = maxSavedEvents > 0 ? (state.events || []).slice(-maxSavedEvents) : [];
      const envelope = {
        $schema: contract.envelopeSchema,
        schemaVersion,
        runtimeSchema: state.runtimeSchema || "",
        savedAt: new Date().toISOString(),
        state,
      };
      storage.setItem(storageKey, JSON.stringify(envelope));
      lastStatus = statusRecord("saved");
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
      if (!storage || typeof storage.removeItem !== "function") {
        lastStatus = statusRecord("unavailable", "storage adapter is unavailable");
        return lastStatus;
      }
      try {
        storage.removeItem(storageKey);
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

  return { restore, attach };
}
