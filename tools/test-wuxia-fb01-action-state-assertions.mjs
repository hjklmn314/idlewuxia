import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("config/wuxia_fb01_action_state_assertion_policy.json");
const schema = readJson("config/wuxia_fb01_action_state_assertion.schema.json");
const validate = new Ajv({allErrors: true, strict: false}).compile(schema);
assert.equal(validate(policy), true, JSON.stringify(validate.errors));
assert.equal(policy.taskId, "T03-01");
assert.equal(policy.expectedActionCount, 358);

const { runActionStateAssertions } = await import("./audit-wuxia-fb01-action-state-assertions.mjs");
const report = runActionStateAssertions({writeOutputs: false, sourceCommit: "test"});
assert.equal(report.verdict, "pass", JSON.stringify(report.findings, null, 2));
assert.equal(report.summary.actions, policy.expectedActionCount);
assert.equal(report.summary.assertedActions, policy.expectedActionCount);
assert.equal(report.summary.rejectedZeroMutation, report.summary.rejectedActions);
assert.equal(report.summary.acceptedWithDeclaredOutcome, report.summary.acceptedActions);
assert.equal(report.findings.length, 0);
console.log(`FB01 action state assertion tests: PASS (${report.summary.actions} actions)`);
