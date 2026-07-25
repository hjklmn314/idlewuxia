import assert from "node:assert/strict";
import { validateAgentWorkPolicy } from "./validate-agent-work-policy.mjs";

const baseline = validateAgentWorkPolicy();
assert.equal(baseline.valid, true, "live agent work policy must validate");
assert.ok(baseline.assignmentCount >= 5, "active assignment register must include controller, audits and next task");

const duplicate = JSON.parse(JSON.stringify((await import("../config/production/agent_work_policy.json", { with: { type: "json" } })).default));
duplicate.currentAssignments.push({ ...duplicate.currentAssignments[0] });
assert.equal(validateAgentWorkPolicy(duplicate).valid, false, "duplicate assignment IDs must fail");

const gateOrder = JSON.parse(JSON.stringify((await import("../config/production/agent_work_policy.json", { with: { type: "json" } })).default));
gateOrder.gates.gate2StrictAcceptance.requiresGate1 = false;
assert.equal(validateAgentWorkPolicy(gateOrder).valid, false, "Gate 2 must depend on Gate 1");

const invalidStatus = JSON.parse(JSON.stringify((await import("../config/production/agent_work_policy.json", { with: { type: "json" } })).default));
invalidStatus.currentAssignments[0].status = "done";
assert.equal(validateAgentWorkPolicy(invalidStatus).valid, false, "assignment status must use the policy vocabulary");

console.log("agent work policy tests: PASS (schema, assignment uniqueness, gate ordering)");
