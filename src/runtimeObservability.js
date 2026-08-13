import { cloneData } from "./dataClone.js";
import { lastItem } from "./languageCompatibility.js";

const OBSERVABILITY_EVENT_SCHEMA = "idlewuxia.runtime_observability_event.v1";
const OBSERVABILITY_REPLAY_SCHEMA = "idlewuxia.runtime_observability_replay.v1";
let generatedIdSequence = 0;

function defaultIdFactory(prefix) {
  generatedIdSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${generatedIdSequence.toString(36)}`;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value === undefined ? null : value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function digest(value) {
  return `fnv1a32:${fnv1a32(stableStringify(value))}`;
}

function valueAtPath(source, path) {
  return String(path || "").split(".").filter(Boolean).reduce(
    (current, segment) => (current && typeof current === "object" ? current[segment] : undefined),
    source,
  );
}

function projectSnapshot(snapshot, trackedPaths = []) {
  return Object.fromEntries(trackedPaths.map((path) => [path, stableValue(valueAtPath(snapshot, path))]));
}

function changedProjection(beforeProjection, afterProjection, limit) {
  const changes = [];
  for (const path of Object.keys(afterProjection)) {
    const before = beforeProjection[path];
    const after = afterProjection[path];
    if (stableStringify(before) === stableStringify(after)) continue;
    changes.push({ path, before, after });
    if (changes.length >= limit) break;
  }
  return changes;
}

function sanitizeIntent(intent, allowedFields) {
  if (!intent || typeof intent !== "object") return {};
  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(intent, field))
      .map((field) => [field, stableValue(intent[field])]),
  );
}

function forbiddenKeyHits(value, forbiddenFields, prefix = "") {
  if (!value || typeof value !== "object") return [];
  const hits = [];
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (forbiddenFields.includes(key)) hits.push(path);
    hits.push(...forbiddenKeyHits(nested, forbiddenFields, path));
  }
  return hits;
}

function eventTypeCounts(events) {
  return events.reduce((counts, event) => {
    counts[event.eventType] = Number(counts[event.eventType] || 0) + 1;
    return counts;
  }, {});
}

function normalizeErrorCode(result, contract) {
  const explicit = result?.event?.reasonCode || result?.reasonCode || "";
  if (explicit) return String(explicit);
  const reason = String(result?.event?.reason || result?.reason || "");
  return contract?.rejectionCodes?.[reason]
    || contract?.rejectionCodes?.default
    || "RUNTIME_COMMAND_REJECTED";
}

export function runtimeObservabilityConfigHash(configSource = {}) {
  return digest(configSource);
}

export function runtimeObservabilityStateHash(snapshot = {}, trackedPaths = []) {
  return digest(projectSnapshot(snapshot, trackedPaths));
}

export function createRuntimeObservability({
  contract = {},
  context = {},
  configSource = {},
  now = () => new Date(),
  idFactory = defaultIdFactory,
} = {}) {
  const maxEvents = Math.max(1, Number(contract?.retention?.maxEvents || 512));
  const maxChangedPaths = Math.max(1, Number(contract?.stateDelta?.maxChangedPaths || 64));
  const trackedPaths = [...(contract?.stateDelta?.trackedPaths || [])];
  const allowedIntentFields = [...(contract?.privacy?.allowedIntentFields || ["type"] )];
  const forbiddenFields = [...(contract?.privacy?.forbiddenFields || [])];
  const eventDefinitions = new Map((contract?.eventDefinitions || []).map((entry) => [entry.eventType, entry]));
  const errorCodes = new Set(contract?.errorCodes || []);
  const performanceMetrics = new Map((contract?.performanceMetrics || []).map((entry) => [entry.metricId, entry]));
  const sessionId = String(context.sessionId || idFactory("session"));
  const runId = String(context.runId || idFactory("run"));
  const events = [];
  const replayCommands = [];
  const dataQuality = {
    missingRequiredFields: [],
    privacyViolations: [],
    sequenceViolations: [],
  };
  let sequence = 0;

  const tags = Object.freeze({
    buildVersion: String(context.buildVersion || contract?.build?.version || "unknown"),
    buildId: String(context.buildId || contract?.build?.buildId || "unknown"),
    configVersion: String(context.configVersion || "unknown"),
    configHash: String(context.configHash || runtimeObservabilityConfigHash(configSource)),
    saveVersion: Number(context.saveVersion || 0),
    moduleId: String(context.moduleId || contract?.moduleId || "runtime"),
    sessionId,
    runId,
    experimentId: String(context.experimentId || ""),
    variantId: String(context.variantId || ""),
    seed: context.seed ?? null,
    privacyClass: String(contract?.privacy?.class || "technical_no_pii"),
  });

  function emit(eventType, payload = {}) {
    sequence += 1;
    const timestamp = now();
    const event = {
      $schema: OBSERVABILITY_EVENT_SCHEMA,
      eventSchemaVersion: Number(eventDefinitions.get(eventType)?.schemaVersion || 1),
      eventType,
      eventId: `${sessionId}:${sequence}`,
      sequence,
      timestamp: (timestamp instanceof Date ? timestamp : new Date(timestamp)).toISOString(),
      ...tags,
      payload: stableValue(payload),
    };
    const required = eventDefinitions.get(eventType)?.requiredPayloadFields || [];
    for (const field of required) {
      if (!Object.prototype.hasOwnProperty.call(event.payload, field)) {
        dataQuality.missingRequiredFields.push({ eventId: event.eventId, eventType, field });
      }
    }
    for (const path of forbiddenKeyHits(event, forbiddenFields)) {
      dataQuality.privacyViolations.push({ eventId: event.eventId, path });
    }
    const previous = lastItem(events);
    if (previous && previous.sequence + 1 !== event.sequence) {
      dataQuality.sequenceViolations.push({ previous: previous.sequence, current: event.sequence });
    }
    events.push(event);
    if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
    return cloneData(event);
  }

  function recordSessionStart({ snapshot = {}, persistenceStatus = "unknown" } = {}) {
    const projection = projectSnapshot(snapshot, trackedPaths);
    return emit("runtime.session_started", {
      persistenceStatus: String(persistenceStatus || "unknown"),
      initialStateHash: digest(projection),
      initialState: String(snapshot?.currentState || ""),
    });
  }

  function recordExecution({ intent = {}, result = {}, before = {}, after = {} } = {}) {
    const safeIntent = sanitizeIntent(intent, allowedIntentFields);
    const beforeProjection = projectSnapshot(before, trackedPaths);
    const afterProjection = projectSnapshot(after, trackedPaths);
    const beforeStateHash = digest(beforeProjection);
    const afterStateHash = digest(afterProjection);
    const changes = changedProjection(beforeProjection, afterProjection, maxChangedPaths);
    const intentEvent = emit("runtime.intent", {
      intent: safeIntent,
      beforeStateHash,
      state: String(before?.currentState || ""),
      combatReplayId: String(before?.pendingCombat?.combatSnapshot?.replayId || ""),
    });
    const accepted = result?.accepted === true;
    const errorCode = accepted ? "" : normalizeErrorCode(result, contract);
    emit("runtime.result", {
      intentEventId: intentEvent.eventId,
      accepted,
      runtimeEventType: String(result?.event?.type || result?.event?.EventType || ""),
      executionStatus: String(result?.event?.executionStatus || result?.executionStatus || result?.status || ""),
      outcomeKind: String(result?.event?.outcomeKind || result?.outcomeKind || ""),
      errorCode,
      stateChanged: beforeStateHash !== afterStateHash,
      beforeStateHash,
      afterStateHash,
      combatReplayId: String(after?.pendingCombat?.combatSnapshot?.replayId || before?.pendingCombat?.combatSnapshot?.replayId || ""),
    });
    if (!accepted) {
      emit("runtime.rejection", {
        intentEventId: intentEvent.eventId,
        intentType: String(intent?.type || ""),
        errorCode,
        stateUnchanged: beforeStateHash === afterStateHash,
      });
    }
    if (changes.length) {
      emit("runtime.state_delta", {
        intentEventId: intentEvent.eventId,
        beforeStateHash,
        afterStateHash,
        changes,
        truncated: changes.length >= maxChangedPaths,
      });
    }
    replayCommands.push({
      sequence: replayCommands.length + 1,
      intent: safeIntent,
      expectedAccepted: accepted,
      expectedBeforeStateHash: beforeStateHash,
      expectedAfterStateHash: afterStateHash,
      expectedErrorCode: errorCode,
      combatReplayId: String(after?.pendingCombat?.combatSnapshot?.replayId || ""),
    });
  }

  function recordError({ errorCode = "", source = "runtime", snapshot = {} } = {}) {
    const safeErrorCode = errorCodes.has(errorCode) ? errorCode : "OBS_RUNTIME_UNHANDLED_ERROR";
    return emit("runtime.error", {
      errorCode: safeErrorCode,
      source: String(source || "runtime"),
      state: String(snapshot?.currentState || ""),
      combatReplayId: String(snapshot?.pendingCombat?.combatSnapshot?.replayId || ""),
    });
  }

  function recordPerformance({ metricId = "", value = 0, screenId = "", state = "" } = {}) {
    const definition = performanceMetrics.get(metricId);
    if (!definition || !Number.isFinite(Number(value))) return null;
    const numericValue = Math.round(Number(value) * 1000) / 1000;
    return emit("runtime.performance_sample", {
      metricId,
      value: numericValue,
      unit: definition.unit,
      budget: Number(definition.budget),
      withinBudget: numericValue <= Number(definition.budget),
      screenId: String(screenId || ""),
      state: String(state || ""),
    });
  }

  function diagnostics() {
    const missing = dataQuality.missingRequiredFields.length;
    const privacy = dataQuality.privacyViolations.length;
    const ordering = dataQuality.sequenceViolations.length;
    return cloneData({
      $schema: "idlewuxia.runtime_observability_diagnostics.v1",
      status: missing || privacy || ordering ? "fail" : "pass",
      eventCount: events.length,
      replayCommandCount: replayCommands.length,
      eventTypeCounts: eventTypeCounts(events),
      context: tags,
      dataQuality,
    });
  }

  function exportReplay() {
    return cloneData({
      $schema: OBSERVABILITY_REPLAY_SCHEMA,
      replayId: `runtime-replay-${lastItem(digest({ sessionId, runId, commands: replayCommands }).split(":"))}`,
      context: tags,
      trackedPaths,
      initialStateHash: replayCommands[0]?.expectedBeforeStateHash || "",
      commands: replayCommands,
    });
  }

  return Object.freeze({
    recordSessionStart,
    recordExecution,
    recordError,
    recordPerformance,
    diagnostics,
    exportReplay,
    events: () => cloneData(events),
  });
}

export function diagnoseObservedReplay({ replay, createRunner } = {}) {
  if (replay?.$schema !== OBSERVABILITY_REPLAY_SCHEMA || !Array.isArray(replay?.commands)) {
    return { status: "invalid", divergence: { sequence: 0, category: "invalid_replay_envelope" } };
  }
  if (typeof createRunner !== "function") {
    return { status: "invalid", divergence: { sequence: 0, category: "missing_runner_factory" } };
  }
  const runner = createRunner();
  if (!runner || typeof runner.execute !== "function" || typeof runner.snapshot !== "function") {
    return { status: "invalid", divergence: { sequence: 0, category: "invalid_runner" } };
  }
  for (const command of replay.commands) {
    const beforeStateHash = runtimeObservabilityStateHash(runner.snapshot(), replay.trackedPaths || []);
    if (beforeStateHash !== command.expectedBeforeStateHash) {
      return {
        status: "diverged",
        divergence: {
          sequence: command.sequence,
          category: "before_state_hash_mismatch",
          expected: command.expectedBeforeStateHash,
          actual: beforeStateHash,
        },
      };
    }
    const result = runner.execute(cloneData(command.intent));
    if ((result?.accepted === true) !== command.expectedAccepted) {
      return {
        status: "diverged",
        divergence: {
          sequence: command.sequence,
          category: "acceptance_mismatch",
          expected: command.expectedAccepted,
          actual: result?.accepted === true,
        },
      };
    }
    const afterStateHash = runtimeObservabilityStateHash(runner.snapshot(), replay.trackedPaths || []);
    if (afterStateHash !== command.expectedAfterStateHash) {
      return {
        status: "diverged",
        divergence: {
          sequence: command.sequence,
          category: "after_state_hash_mismatch",
          expected: command.expectedAfterStateHash,
          actual: afterStateHash,
        },
      };
    }
  }
  return { status: "match", commands: replay.commands.length, divergence: null };
}
