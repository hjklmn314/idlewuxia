import assert from "node:assert/strict";
import fs from "node:fs";

import { resolveConfiguredCombatResultAuditBinding } from "./wuxia-combat-result-audit-policy.mjs";

const flow = JSON.parse(fs.readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"));
const combatContent = JSON.parse(fs.readFileSync(new URL("../config/wuxia_combat_content.json", import.meta.url), "utf8"));

const routes = [
  ["compare", "fb01r16_3", "custom_caozuo", "encounter_fb01_capture_yin_quanan"],
  ["inattack201", "fb01r41_1", "custom_caozuo", "encounter_fb01_inner_demon"],
  ["inattack202", "fb01r42_1", "custom_caozuo", "encounter_fb01_nightmare"],
];

for (const [resultId, sourceId, actionType, encounterId] of routes) {
  const result = resolveConfiguredCombatResultAuditBinding({ flow, combatContent, resultId, sourceId, actionType });
  assert.equal(result.accepted, true, `${resultId} must be recognized as a configured real CombatSession route`);
  assert.equal(result.policy.encounterId, encounterId);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const base = { flow, combatContent, resultId: "inattack201", sourceId: "fb01r41_1", actionType: "custom_caozuo" };
assert.equal(resolveConfiguredCombatResultAuditBinding({ ...base, sourceId: "fb01r42_1" }).reason, "source_disallowed");
assert.equal(resolveConfiguredCombatResultAuditBinding({ ...base, actionType: "talk" }).reason, "action_disallowed");

const missingPolicyFlow = clone(flow);
delete missingPolicyFlow.chapterSystem.combatResultPolicies.inattack201;
assert.equal(resolveConfiguredCombatResultAuditBinding({ ...base, flow: missingPolicyFlow }).reason, "missing_policy");

const unknownEncounterContent = clone(combatContent);
unknownEncounterContent.encounters = unknownEncounterContent.encounters.filter((entry) => entry.encounterId !== "encounter_fb01_inner_demon");
assert.equal(resolveConfiguredCombatResultAuditBinding({ ...base, combatContent: unknownEncounterContent }).reason, "unknown_encounter");

const mismatchedPolicyFlow = clone(flow);
mismatchedPolicyFlow.chapterSystem.combatResultPolicies.inattack201.resultId = "inattack202";
assert.equal(resolveConfiguredCombatResultAuditBinding({ ...base, flow: mismatchedPolicyFlow }).reason, "result_id_mismatch");

console.log("combat result audit policy tests: PASS (3 configured routes + 5 fail-closed cases)");
