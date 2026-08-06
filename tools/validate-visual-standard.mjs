import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "outputs", "production_os", "visual-standard-validation.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function finding(code, subject, message) {
  return { severity: "P0", code, subject, message };
}

export function validateVisualStandard({ rootDir = root, standard, uiExperience } = {}) {
  const activeRoot = rootDir;
  const activeStandard = standard || readJson(path.join(activeRoot, "config", "production", "visual_standard.json"));
  const activeUi = uiExperience || readJson(path.join(activeRoot, "config", "production", "ui_experience_registry.json"));
  const schema = readJson(path.join(activeRoot, "config", "production", "schemas", "visual_standard.schema.json"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const findings = [];
  if (!validate(activeStandard)) {
    for (const error of validate.errors || []) findings.push(finding("VISUAL_STANDARD_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));
    return { valid: false, findings, viewportCount: 0 };
  }
  const viewportIds = new Set(activeStandard.portrait.viewports.map((viewport) => viewport.id));
  if (activeStandard.style.characterView !== "side") findings.push(finding("VISUAL_STANDARD_NOT_SIDE_VIEW", "style.characterView", "Characters must use side view."));
  if (activeStandard.style.characterHeadCountRange.min >= activeStandard.style.characterHeadCountRange.max) findings.push(finding("VISUAL_STANDARD_HEAD_RANGE_INVALID", "style.characterHeadCountRange", "Head-count range must have min < max."));
  if (activeStandard.style.sceneContainsBakedCharacters) findings.push(finding("VISUAL_STANDARD_BAKED_SCENE_ALLOWED", "style.sceneContainsBakedCharacters", "Scenes must not contain baked characters."));
  if (activeStandard.portrait.touchTargetMinDp < 44) findings.push(finding("VISUAL_STANDARD_TOUCH_TARGET_TOO_SMALL", "portrait.touchTargetMinDp", "Touch targets must be at least 44dp."));
  if (activeStandard.combat.placeholderPresentation !== "forbidden") findings.push(finding("VISUAL_STANDARD_PLACEHOLDER_ALLOWED", "combat.placeholderPresentation", "Placeholder combat presentation must be forbidden."));
  if (activeStandard.combat.walkFootPhasePolicy !== "alternate-left-right") findings.push(finding("VISUAL_STANDARD_WALK_PHASE_POLICY", "combat.walkFootPhasePolicy", "Walk cycles must alternate left and right foot phases."));
  const uiViewports = new Map((activeUi.viewports || []).map((viewport) => [viewport.id, viewport]));
  for (const [id, viewport] of uiViewports) {
    const standardViewport = activeStandard.portrait.viewports.find((item) => item.id === id);
    if (!standardViewport) findings.push(finding("VISUAL_STANDARD_VIEWPORT_MISSING", id, "Every production UI viewport must have visual-standard thresholds."));
    else if (standardViewport.width !== viewport.width || standardViewport.height !== viewport.height) findings.push(finding("VISUAL_STANDARD_VIEWPORT_DIMENSION_DRIFT", id, `Visual standard ${standardViewport.width}x${standardViewport.height} differs from UI registry ${viewport.width}x${viewport.height}.`));
  }
  for (const id of viewportIds) if (!uiViewports.has(id)) findings.push(finding("VISUAL_STANDARD_VIEWPORT_UNKNOWN", id, "Visual standard contains a viewport absent from the UI registry."));
  return { valid: findings.length === 0, findings, viewportCount: activeStandard.portrait.viewports.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateVisualStandard();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), status: result.valid ? "PASS" : "FAIL", ...result }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ status: result.valid ? "PASS" : "FAIL", ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
}
