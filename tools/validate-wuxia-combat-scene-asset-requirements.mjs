import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = "config/wuxia_combat_scene_asset_requirements.json";
const schemaFile = "config/wuxia_combat_scene_asset_requirements.schema.json";
const presentationFile = "config/wuxia_combat_presentation_contract.json";
const overlayFile = "config/wuxia_combat_reference_asset_overlay.json";
const outputPath = path.join(root, "outputs", "production_os", "combat-scene-asset-requirements-validation.json");

export function validateCombatSceneAssetRequirements({ rootDir = root, manifest, presentation, overlay } = {}) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8").replace(/^\uFEFF/, ""));
  const activeManifest = manifest || read(manifestFile);
  const activePresentation = presentation || read(presentationFile);
  const activeOverlay = overlay || read(overlayFile);
  const findings = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(read(schemaFile));
  if (!validate(activeManifest)) for (const error of validate.errors || []) findings.push({ severity: "P0", code: "ASSET_008_SCHEMA_INVALID", subject: error.instancePath || "/", message: error.message || "Schema validation failed." });
  const scenes = new Map((activeManifest.scenes || []).map((row) => [row.id, row]));
  const presentationScenes = new Map((activePresentation.scenes || []).map((row) => [row.id, row]));
  const overlayAssets = new Map((activeOverlay.assets || []).map((row) => [row.id, row]));
  const overlayBindings = activeOverlay.bindings?.scenes || {};
  for (const row of activeManifest.scenes || []) {
    const p = presentationScenes.get(row.id);
    if (!p) findings.push({ severity: "P0", code: "ASSET_008_PRESENTATION_BINDING_MISSING", subject: row.id, message: "Scene requirements must correspond to a presentation binding." });
    else if (p.logicalAssetId !== row.logicalAssetId) findings.push({ severity: "P0", code: "ASSET_008_LOGICAL_ID_DRIFT", subject: row.id, message: "Scene logicalAssetId differs from the presentation contract." });
    const ref = overlayAssets.get(row.referenceAssetId);
    if (!ref) findings.push({ severity: "P0", code: "ASSET_008_REFERENCE_UNKNOWN", subject: row.id, message: `Reference asset ${row.referenceAssetId} is absent from the development overlay.` });
    if (overlayBindings[row.id] !== row.referenceAssetId) findings.push({ severity: "P0", code: "ASSET_008_REFERENCE_DRIFT", subject: row.id, message: "Scene reference binding differs from the development overlay." });
    if (row.status !== "reference-only") findings.push({ severity: "P0", code: "ASSET_008_FALSE_SATISFACTION", subject: row.id, message: "Reference scenes cannot be claimed as production satisfied." });
  }
  if (activeManifest.shippingAllowed !== false || activeManifest.sourcePolicy?.referenceBytesMayShip !== false) findings.push({ severity: "P0", code: "ASSET_008_SHIPPING_POLICY", subject: "sourcePolicy", message: "Reference scene bytes must be excluded from shipping." });
  const status = findings.length === 0 ? "PASS WITH KNOWN LIMITATIONS" : "REVISE";
  return { valid: findings.length === 0, status, findings, taskId: activeManifest.taskId, productionStatus: activeManifest.acceptanceGate?.productionStatus, counts: { sceneRows: scenes.size, referenceCandidates: activeManifest.referenceAudit?.candidates?.length || 0 } };
}

function run() { const result = validateCombatSceneAssetRequirements(); fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 1; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run();
