import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runEditorRoiAudit, validateEditorRoiDecision } from "./audit-wuxia-editor-roi.mjs";
import { validateChapterPackage } from "./lib/chapter-authoring-workflow.mjs";

const clone = (value) => structuredClone(value);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadDecision = () => JSON.parse(fs.readFileSync(path.join(root, "config", "production", "editor_roi_decision.json"), "utf8"));
const baseline = runEditorRoiAudit({ writeReport: false });
assert.equal(baseline.verdict, "PASS_WITH_KNOWN_LIMITATIONS");
assert.equal(baseline.decisionValidation.valid, true);
assert.equal(baseline.authoringWorkflowProof.validation.valid, true);
assert.equal(baseline.authoringWorkflowProof.diff.length, 1);
assert.equal(baseline.authoringWorkflowProof.rollback.rollbackVerified, true);
assert.equal(baseline.authoringWorkflowProof.inputMutated, false);

const decision = baseline.measurements.recorded;
assert.ok(decision.activeChapterRooms >= 45, "authoring measurement must include the active room volume");
assert.ok(decision.activeChapterNpcs >= 116, "authoring measurement must include the active NPC volume");

{
  const chapter = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "chapter_reuse", "chapter2_config_fixture.json"), "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_chapter_definition.schema.json"), "utf8"));
  const combatContent = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));
  const blocked = validateChapterPackage({ chapter, schema, combatContent });
  assert.equal(blocked.valid, false, "unregistered external Encounter must fail closed");
  assert.ok(blocked.semanticFindings.some((finding) => finding.code === "UNKNOWN_REFERENCE"));
  const approved = validateChapterPackage({
    chapter,
    schema,
    combatContent,
    externalEncounterIds: loadDecision().workflow.externalEncounterIds,
  });
  assert.equal(approved.valid, true, "explicit config-owned external Encounter allowlist must pass");
}

{
  const broken = clone(loadDecision());
  broken.options[0].decision = "select";
  assert.ok(validateEditorRoiDecision(broken).findings.some((finding) => finding.code === "EDITOR_ROI_SELECTION_INVALID"));
}

{
  const broken = clone(loadDecision());
  broken.selectedOption = "specialized-visual-editor";
  broken.options.forEach((option) => { option.decision = option.id === broken.selectedOption ? "select" : "defer"; });
  assert.ok(validateEditorRoiDecision(broken).findings.some((finding) => finding.code === "EDITOR_PREMATURE_SPECIALIZATION"));
}

{
  const broken = clone(loadDecision());
  broken.workflow.runtimeConsumer = "src/missing-editor-runtime.js";
  assert.ok(validateEditorRoiDecision(broken).findings.some((finding) => finding.code === "EDITOR_WORKFLOW_FILE_MISSING"));
}

{
  const broken = clone(loadDecision());
  broken.workflow.diffCommand = "";
  assert.ok(validateEditorRoiDecision(broken).findings.some((finding) => finding.code === "EDITOR_WORKFLOW_CAPABILITY_MISSING"));
}

console.log("EDITOR-ROI-001 tests: PASS (baseline + external reference gate + 4 decision fail-closed cases)");
