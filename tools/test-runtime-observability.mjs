import assert from "node:assert/strict";
import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

import { createChapterSession } from "../src/chapterSession.js";
import {
  createRuntimeObservability,
  diagnoseObservedReplay,
  runtimeObservabilityConfigHash,
} from "../src/runtimeObservability.js";
import { createUiFlowAdapter } from "../src/uiFlowAdapter.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const flow = read("../config/wuxia_first_session_flow.json");
const screens = read("../config/wuxia_first_session_screen_contract.json");
const combat = read("../config/wuxia_combat_content.json");
const persistence = read("../config/runtime_persistence_contract.json");
const contract = read("../config/analytics_events.json");
const eventSchema = read("../config/runtime_observability_event.schema.json");
const replaySchema = read("../config/runtime_observability_replay.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateEvent = ajv.compile(eventSchema);
const validateReplay = ajv.compile(replaySchema);

function createRunner(definitions = flow, observer = null) {
  const session = createChapterSession(definitions, {
    initialState: screens.defaultStartState,
    initialFlags: screens.defaultStartFlags,
    combatContent: combat,
  });
  return createUiFlowAdapter({
    session,
    flowContract: definitions,
    screenContract: screens,
    observability: observer,
  });
}

let tick = 0;
const observability = createRuntimeObservability({
  contract,
  context: {
    sessionId: "session-test",
    runId: "run-test",
    configVersion: flow.schema,
    saveVersion: persistence.schemaVersion,
  },
  configSource: { flow, screens, combat, persistence },
  now: () => new Date(Date.UTC(2026, 7, 9, 0, 0, tick++)),
});
const runner = createRunner(flow, observability);
observability.recordSessionStart({ snapshot: runner.snapshot(), persistenceStatus: "fresh" });

const rejected = runner.execute({ type: "dispatchAction", actionId: "ACTION_DOES_NOT_EXIST" });
assert.equal(rejected.accepted, false);
assert.equal(runner.execute({ type: "dispatchAction", actionId: "ACTION_FS_001_ORIGIN_SCHOLAR" }).accepted, true);
assert.equal(runner.execute({ type: "dispatchAction", actionId: "ACTION_FS_001_ORIGIN_RESULT_CONTINUE" }).accepted, true);
observability.recordError({
  errorCode: "OBS_RUNTIME_UNHANDLED_ERROR",
  source: "test.error",
  snapshot: runner.snapshot(),
});
observability.recordPerformance({
  metricId: "ui.render.duration_ms",
  value: 7.25,
  screenId: "UI_TitleStart",
  state: runner.snapshot().currentState,
});

const diagnostics = observability.diagnostics();
assert.equal(diagnostics.status, "pass", JSON.stringify(diagnostics.dataQuality));
assert.equal(diagnostics.replayCommandCount, 3);
assert.equal(diagnostics.context.buildVersion, contract.build.version);
assert.equal(diagnostics.context.configVersion, flow.schema);
assert.equal(diagnostics.context.saveVersion, 2);
assert.match(diagnostics.context.configHash, /^fnv1a32:[0-9a-f]{8}$/);
assert.equal(diagnostics.eventTypeCounts["runtime.session_started"], 1);
assert.equal(diagnostics.eventTypeCounts["runtime.intent"], 3);
assert.equal(diagnostics.eventTypeCounts["runtime.result"], 3);
assert.equal(diagnostics.eventTypeCounts["runtime.rejection"], 1);
assert.ok(diagnostics.eventTypeCounts["runtime.state_delta"] >= 2);
assert.equal(diagnostics.eventTypeCounts["runtime.error"], 1);
assert.equal(diagnostics.eventTypeCounts["runtime.performance_sample"], 1);

const events = observability.events();
assert.ok(events.every((event) => validateEvent(event)), JSON.stringify(validateEvent.errors));
assert.ok(events.every((event, index) => event.sequence === index + 1));
assert.ok(events.every((event) => event.privacyClass === "technical_no_pii"));
assert.equal(JSON.stringify(events).includes("ACTION_DOES_NOT_EXIST"), true, "technical action IDs remain diagnosable");
assert.equal(JSON.stringify(events).includes("feedback"), false, "free-form feedback must not enter observability events");
assert.equal(JSON.stringify(events).includes("stack"), false, "raw exception stacks must not enter observability events");
assert.equal(observability.recordPerformance({ metricId: "unknown.metric", value: 1 }), null);
const rejection = events.find((event) => event.eventType === "runtime.rejection");
assert.equal(rejection.payload.errorCode, "RUNTIME_COMMAND_REJECTED");
assert.equal(rejection.payload.stateUnchanged, true, "semantic gameplay projection must remain atomic on rejection");

const replay = observability.exportReplay();
assert.equal(validateReplay(replay), true, JSON.stringify(validateReplay.errors));
assert.equal(replay.commands.length, 3);
const matched = diagnoseObservedReplay({ replay, createRunner: () => createRunner() });
assert.deepEqual(matched, { status: "match", commands: 3, divergence: null });

const driftedFlow = structuredClone(flow);
const originAction = driftedFlow.actions.find((entry) => entry.actionId === "ACTION_FS_001_ORIGIN_SCHOLAR");
originAction.responseModel.statDeltas = { experience: 999 };
const diverged = diagnoseObservedReplay({ replay, createRunner: () => createRunner(driftedFlow) });
assert.equal(diverged.status, "diverged");
assert.equal(diverged.divergence.sequence, 2);
assert.equal(diverged.divergence.category, "after_state_hash_mismatch");

const reordered = { screens, flow };
assert.equal(
  runtimeObservabilityConfigHash(reordered),
  runtimeObservabilityConfigHash({ flow, screens }),
  "configuration digest must ignore object key insertion order",
);

const cappedContract = structuredClone(contract);
cappedContract.retention.maxEvents = 16;
const capped = createRuntimeObservability({
  contract: cappedContract,
  context: { sessionId: "session-cap", runId: "run-cap", configVersion: flow.schema, saveVersion: 2 },
  configSource: { flow },
  now: () => new Date("2026-08-09T00:00:00.000Z"),
});
const capRunner = createRunner(flow, capped);
capped.recordSessionStart({ snapshot: capRunner.snapshot(), persistenceStatus: "fresh" });
for (let index = 0; index < 10; index += 1) {
  capRunner.execute({ type: "dispatchAction", actionId: `MISSING_${index}` });
}
assert.equal(capped.events().length, 16, "in-memory retention must enforce the configured event cap");
assert.equal(capped.diagnostics().status, "pass");

const generatedIds = createRuntimeObservability({ contract, configSource: { flow } }).diagnostics().context;
assert.notEqual(generatedIds.sessionId, generatedIds.runId, "session and run identifiers must be distinct");

assert.deepEqual(
  diagnoseObservedReplay({ replay: {}, createRunner: () => createRunner() }),
  { status: "invalid", divergence: { sequence: 0, category: "invalid_replay_envelope" } },
);

console.log(JSON.stringify({
  status: "pass",
  events: events.length,
  replayCommands: replay.commands.length,
  replayMatch: matched.status,
  divergenceCategory: diverged.divergence.category,
  dataQuality: diagnostics.dataQuality,
  retentionCap: capped.events().length,
}, null, 2));
