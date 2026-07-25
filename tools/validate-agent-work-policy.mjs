import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(root, "config", "production", "agent_work_policy.json");
const schemaPath = path.join(root, "config", "production", "agent_work_policy.schema.json");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

export function validateAgentWorkPolicy(policy = readJson(policyPath), schema = readJson(schemaPath)) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const valid = validate(policy);
  const findings = (validate.errors || []).map((error) => ({ code: "POLICY_SCHEMA_INVALID", path: error.instancePath || "/", message: error.message || "Schema validation failed." }));
  const assignments = policy.currentAssignments || [];
  const ids = assignments.map((item) => item.id);
  if (new Set(ids).size !== ids.length) findings.push({ code: "POLICY_DUPLICATE_ASSIGNMENT", path: "currentAssignments", message: "Assignment IDs must be unique." });
  if (!policy.gates?.gate2StrictAcceptance?.requiresGate1) findings.push({ code: "POLICY_GATE_ORDER_INVALID", path: "gates.gate2StrictAcceptance", message: "Strict acceptance must require Gate 1." });
  if (!policy.gates?.finalManualAcceptance?.requiresGate2) findings.push({ code: "POLICY_FINAL_ORDER_INVALID", path: "gates.finalManualAcceptance", message: "Final manual acceptance must require Gate 2." });
  const statuses = new Set(policy.statuses || []);
  for (const assignment of assignments) {
    if (!statuses.has(assignment.status)) findings.push({ code: "POLICY_UNKNOWN_STATUS", path: `currentAssignments.${assignment.id}`, message: `Unknown assignment status: ${assignment.status}` });
    if (assignment.owner === assignment.acceptanceOwner) findings.push({ code: "POLICY_SELF_ACCEPTANCE", path: `currentAssignments.${assignment.id}`, message: "Task owner and acceptance owner must be independent." });
  }
  if (policy.gates.gate1Engineering.owner !== policy.independentAcceptanceRole) findings.push({ code: "POLICY_GATE1_OWNER_DRIFT", path: "gates.gate1Engineering.owner", message: "Gate 1 owner must equal independentAcceptanceRole." });
  if (policy.gates.gate1Engineering.owner === policy.gates.gate2StrictAcceptance.owner) findings.push({ code: "POLICY_REVIEWER_NOT_INDEPENDENT", path: "gates", message: "Gate 1 and Gate 2 owners must be different." });
  return { valid: findings.length === 0, findings, assignmentCount: assignments.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateAgentWorkPolicy();
  console.log(JSON.stringify({ status: result.valid ? "PASS" : "FAIL", ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
}
