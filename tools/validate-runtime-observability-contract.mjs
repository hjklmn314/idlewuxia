import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const contract = read("../config/analytics_events.json");
const contractSchema = read("../config/runtime_observability_contract.schema.json");
const eventSchema = read("../config/runtime_observability_event.schema.json");
const replaySchema = read("../config/runtime_observability_replay.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateContract = ajv.compile(contractSchema);
if (!validateContract(contract)) {
  console.error(JSON.stringify({ status: "fail", errors: validateContract.errors }, null, 2));
  process.exit(1);
}

const requiredEventTypes = [
  "runtime.session_started",
  "runtime.intent",
  "runtime.result",
  "runtime.rejection",
  "runtime.state_delta",
  "runtime.error",
  "runtime.performance_sample",
];
const eventTypes = contract.eventDefinitions.map((entry) => entry.eventType);
if (new Set(eventTypes).size !== eventTypes.length) throw new Error("observability event types must be unique");
for (const eventType of requiredEventTypes) {
  if (!eventTypes.includes(eventType)) throw new Error(`missing required observability event definition ${eventType}`);
}
for (const path of contract.stateDelta.trackedPaths) {
  if (contract.privacy.forbiddenFields.some((field) => path.split(".").includes(field))) {
    throw new Error(`tracked state path violates privacy policy: ${path}`);
  }
}
const metricIds = contract.performanceMetrics.map((entry) => entry.metricId);
if (new Set(metricIds).size !== metricIds.length) throw new Error("observability performance metric IDs must be unique");
ajv.compile(eventSchema);
ajv.compile(replaySchema);

console.log(JSON.stringify({
  status: "pass",
  contractVersion: contract.contractVersion,
  eventTypes,
  trackedPaths: contract.stateDelta.trackedPaths.length,
  errorCodes: contract.errorCodes.length,
  performanceMetrics: metricIds,
  privacyClass: contract.privacy.class,
  upload: contract.retention.upload,
}, null, 2));
