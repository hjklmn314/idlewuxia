import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "outputs", "production_os", "ui-neutral-contract-validation.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function finding(code, subject, message) {
  return { severity: "P0", code, subject, message };
}

export function validateUiNeutralContract({ rootDir = root, contract, schema, screenContract, visualStandard } = {}) {
  const activeRoot = rootDir;
  const activeContract = contract || readJson(path.join(activeRoot, "config", "production", "ui_neutral_visual_contract.json"));
  const activeSchema = schema || readJson(path.join(activeRoot, "config", "production", "schemas", "ui_neutral_visual_contract.schema.json"));
  const activeScreenContract = screenContract || readJson(path.join(activeRoot, "config", "wuxia_first_session_screen_contract.json"));
  const activeVisualStandard = visualStandard || readJson(path.join(activeRoot, "config", "production", "visual_standard.json"));
  const findings = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(activeSchema);
  if (!validate(activeContract)) {
    for (const error of validate.errors || []) findings.push(finding("UI_NEUTRAL_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));
    return { valid: false, findings };
  }

  if (activeContract.shipping !== false) findings.push(finding("UI_NEUTRAL_SHIPPING_ENABLED", "shipping", "The neutral image contract is a design proof and must not enter shipping."));
  if (activeContract.platform.minimumTouchTargetDp < activeVisualStandard.portrait.touchTargetMinDp) findings.push(finding("UI_NEUTRAL_TOUCH_TARGET_DRIFT", "platform.minimumTouchTargetDp", "Neutral UI touch target is weaker than the active visual standard."));
  const standardViewports = new Map(activeVisualStandard.portrait.viewports.map((viewport) => [viewport.id, `${viewport.width}x${viewport.height}`]));
  for (const viewport of activeContract.platform.supportedViewports) {
    const expected = standardViewports.get(viewport.id);
    const actual = `${viewport.width}x${viewport.height}`;
    if (!expected) findings.push(finding("UI_NEUTRAL_VIEWPORT_UNKNOWN", viewport.id, "Neutral UI contract contains a viewport absent from the active visual standard."));
    else if (expected !== actual) findings.push(finding("UI_NEUTRAL_VIEWPORT_DIMENSION_DRIFT", viewport.id, `Neutral UI viewport ${actual} differs from visual standard ${expected}.`));
  }

  const screenIds = new Set(Object.keys(activeScreenContract.screens || {}));
  const supportedIntentTypes = new Set();
  for (const branch of activeScreenContract ? readJson(path.join(activeRoot, "config", "wuxia_ui_intent_contract.schema.json")).oneOf || [] : []) {
    const ref = String(branch.$ref || "").split("/").pop();
    if (ref) {
      supportedIntentTypes.add(ref);
      supportedIntentTypes.add(ref.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).replace(/^_/, ""));
    }
  }
  for (const binding of activeContract.screenBindings) {
    if (!screenIds.has(binding.screenId)) findings.push(finding("UI_NEUTRAL_SCREEN_UNKNOWN", binding.screenId, "Neutral UI screen binding is absent from the first-session screen contract."));
    for (const intentType of binding.requiredIntentTypes) if (!supportedIntentTypes.has(intentType)) findings.push(finding("UI_NEUTRAL_INTENT_UNKNOWN", `${binding.screenId}:${intentType}`, "Screen binding refers to an intent type not declared by the UI intent Schema."));
  }
  const requiredComponents = new Set(["screen-frame", "state-card", "primary-action", "combat-unit-card", "chapter-node-card", "feedback-stack"]);
  const actualComponents = new Set(activeContract.componentContracts.map((component) => component.componentId));
  for (const componentId of requiredComponents) if (!actualComponents.has(componentId)) findings.push(finding("UI_NEUTRAL_COMPONENT_MISSING", componentId, "Required neutral UI component contract is missing."));
  if (!activeContract.neutralImage.forbiddenContent.includes("raw-runtime-id")) findings.push(finding("UI_NEUTRAL_RAW_ID_ALLOWED", "neutralImage.forbiddenContent", "Raw runtime IDs must be forbidden in the player-facing neutral image."));
  if (!activeContract.forbiddenPatterns.includes("placeholder-art-marked-as-production")) findings.push(finding("UI_NEUTRAL_PLACEHOLDER_BOUNDARY_MISSING", "forbiddenPatterns", "Placeholder art must be explicitly prevented from becoming production art."));
  const separation = activeContract.screenSeparation;
  if (!separation.onePrimaryGoalPerScreen) findings.push(finding("UI_NEUTRAL_MULTI_GOAL_SCREEN", "screenSeparation.onePrimaryGoalPerScreen", "Each screen must have one primary player goal."));
  if (!separation.forbiddenCombinedModes.some((modes) => modes.includes("route") && modes.includes("node-detail") && modes.includes("combat"))) findings.push(finding("UI_NEUTRAL_COMBINED_MODES_ALLOWED", "screenSeparation.forbiddenCombinedModes", "Route, node detail and combat must be explicitly forbidden from being composed as one persistent screen."));
  for (const [mode, definition] of Object.entries(separation.modes)) {
    const overlap = definition.allowedPersistentComponentIds.filter((componentId) => definition.forbiddenPersistentComponentIds.includes(componentId));
    if (overlap.length) findings.push(finding("UI_NEUTRAL_MODE_COMPONENT_OVERLAP", mode, `Mode allows and forbids the same persistent component: ${overlap.join(", ")}.`));
  }
  const topHud = activeContract.combatTopHud;
  if (!screenIds.has(topHud.screenId)) findings.push(finding("UI_NEUTRAL_TOP_HUD_SCREEN_UNKNOWN", topHud.screenId, "Combat top HUD is bound to a screen absent from the active screen contract."));
  if (topHud.runtimeContract !== "config/wuxia_combat_top_hud.json") findings.push(finding("UI_NEUTRAL_TOP_HUD_RUNTIME_CONTRACT_UNKNOWN", topHud.runtimeContract, "Combat top HUD must point to the shipping runtime contract."));
  if (topHud.maxHeightRatio > 0.18) findings.push(finding("UI_NEUTRAL_TOP_HUD_TOO_TALL", "combatTopHud.maxHeightRatio", "Combat top HUD must not exceed 18 percent of the portrait usable height."));
  const hudZoneIds = new Set(topHud.zones.map((zone) => zone.id));
  for (const requiredZone of ["context", "turn-order", "state-legend"]) if (!hudZoneIds.has(requiredZone)) findings.push(finding("UI_NEUTRAL_TOP_HUD_ZONE_MISSING", requiredZone, "Combat top HUD must define context, turn-order and state-legend zones."));
  for (const requiredPattern of ["decorative-progress-line", "large-central-glyph", "vertical-side-banner", "unbound-portrait-token"]) if (!topHud.forbiddenPatterns.includes(requiredPattern)) findings.push(finding("UI_NEUTRAL_TOP_HUD_DECORATION_ALLOWED", requiredPattern, "Combat top HUD must explicitly forbid ambiguous decorative or unbound content."));
  for (const requiredField of ["unitId", "side", "displayName", "alive", "actorMount", "turnIndex"]) if (!topHud.turnOrder.requiredFields.includes(requiredField)) findings.push(finding("UI_NEUTRAL_TOP_HUD_BINDING_FIELD_MISSING", requiredField, "Turn-order tokens must bind to authoritative runtime unit fields."));
  return { valid: findings.length === 0, findings, screenBindingCount: activeContract.screenBindings.length, viewportCount: activeContract.platform.supportedViewports.length, componentCount: activeContract.componentContracts.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateUiNeutralContract();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), status: result.valid ? "PASS" : "FAIL", ...result }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ status: result.valid ? "PASS" : "FAIL", ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
}
