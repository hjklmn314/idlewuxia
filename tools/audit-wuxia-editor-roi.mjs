import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import {
  buildChapterPreview,
  buildRollbackEvidence,
  clone,
  diffJson,
  validateChapterPackage,
} from "./lib/chapter-authoring-workflow.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "production", "editor_roi_decision.json");
const productionSchemaPath = path.join(root, "config", "production", "schemas", "production_os_contract.schema.json");
const chapterSchemaPath = path.join(root, "config", "wuxia_chapter_definition.schema.json");
const fixturePath = path.join(root, "tests", "fixtures", "chapter_reuse", "chapter2_config_fixture.json");
const combatPath = path.join(root, "config", "wuxia_combat_content.json");
const outputDir = path.join(root, "outputs", "editor_roi001");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const relative = (filePath) => path.relative(root, filePath).replace(/\\/g, "/");

export function validateEditorRoiDecision(decision) {
  const schema = readJson(productionSchemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema);
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/editorRoiDecision` });
  const valid = validate(decision);
  const findings = (validate.errors || []).map((error) => ({
    severity: "P0",
    code: "EDITOR_ROI_SCHEMA_INVALID",
    subject: error.instancePath || "/",
    message: error.message || "schema validation failed",
  }));
  const selected = (decision.options || []).filter((option) => option.decision === "select");
  if (selected.length !== 1 || selected[0]?.id !== decision.selectedOption) {
    findings.push({ severity: "P0", code: "EDITOR_ROI_SELECTION_INVALID", subject: "selectedOption", message: "Exactly one selected option must match selectedOption." });
  }
  if (decision.selectedOption === "specialized-visual-editor" && decision.knownFacts?.schemaProductionPackages < 3) {
    findings.push({ severity: "P0", code: "EDITOR_PREMATURE_SPECIALIZATION", subject: "selectedOption", message: "A specialized editor requires at least three production packages on a stable schema." });
  }
  for (const key of ["sourceAuthority", "runtimeConsumer", "schema"]) {
    const value = decision.workflow?.[key];
    if (!value || !fs.existsSync(path.join(root, value))) {
      findings.push({ severity: "P0", code: "EDITOR_WORKFLOW_FILE_MISSING", subject: `workflow.${key}`, message: `Missing project file: ${value || "<empty>"}` });
    }
  }
  for (const key of ["validationCommand", "previewCommand", "diffCommand", "undoStrategy", "previewBehavior", "versioning", "migration", "sourceControl"]) {
    if (!String(decision.workflow?.[key] || "").trim()) {
      findings.push({ severity: "P0", code: "EDITOR_WORKFLOW_CAPABILITY_MISSING", subject: `workflow.${key}`, message: `${key} is required.` });
    }
  }
  return { valid: valid && findings.length === 0, findings };
}

export function runEditorRoiAudit({ decision = readJson(configPath), writeReport = true } = {}) {
  const decisionValidation = validateEditorRoiDecision(decision);
  const chapter = readJson(fixturePath);
  const chapterValidation = validateChapterPackage({
    chapter,
    schema: readJson(chapterSchemaPath),
    combatContent: readJson(combatPath),
    externalEncounterIds: decision.workflow.externalEncounterIds,
  });
  const changed = clone(chapter);
  changed.displayText = { ...(changed.displayText || {}), roiProbe: "changed-in-memory-only" };
  const diff = diffJson(chapter, changed);
  const rollback = buildRollbackEvidence(chapter, changed);
  const currentMetrics = {
    activeChapterBytes: fs.statSync(path.join(root, decision.knownFacts.activeChapterAuthority)).size,
    activeChapterLines: fs.readFileSync(path.join(root, decision.knownFacts.activeChapterAuthority), "utf8").split(/\r?\n/).length - 1,
    activeCombatBytes: fs.statSync(path.join(root, decision.knownFacts.activeCombatAuthority)).size,
  };
  const metricDrift = Object.entries(currentMetrics)
    .filter(([key, value]) => decision.knownFacts[key] !== value)
    .map(([key, value]) => ({ key, recorded: decision.knownFacts[key], current: value }));
  const report = {
    schema: "idlewuxia.editor_roi_audit.v1",
    generatedAt: new Date().toISOString(),
    taskId: decision.taskId,
    selectedOption: decision.selectedOption,
    decisionStatus: decision.decisionStatus,
    decisionValidation,
    measurements: { recorded: decision.knownFacts, current: currentMetrics, drift: metricDrift },
    authoringWorkflowProof: {
      fixture: relative(fixturePath),
      validation: chapterValidation,
      preview: buildChapterPreview(chapter),
      diff,
      rollback,
      inputMutated: false,
    },
    specializedEditorDeferred: decision.selectedOption !== "specialized-visual-editor",
    verdict: decisionValidation.valid && chapterValidation.valid && diff.length > 0 && rollback.rollbackVerified
      ? "PASS_WITH_KNOWN_LIMITATIONS"
      : "REVISE",
  };
  if (writeReport) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "editor_roi_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = runEditorRoiAudit();
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== "PASS_WITH_KNOWN_LIMITATIONS") process.exitCode = 1;
}
