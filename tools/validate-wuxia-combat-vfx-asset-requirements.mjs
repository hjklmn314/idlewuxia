import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = "config/wuxia_combat_vfx_asset_requirements.json";
const schemaFile = "config/wuxia_combat_vfx_asset_requirements.schema.json";
const presentationFile = "config/wuxia_combat_presentation_contract.json";
const contentFile = "config/wuxia_combat_content.json";
const overlayFile = "config/wuxia_combat_reference_asset_overlay.json";
const outputPath = path.join(root, "outputs", "production_os", "combat-vfx-asset-requirements-validation.json");

const readJson = (rootDir, file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8").replace(/^\uFEFF/, ""));
const finding = (code, subject, message, severity = "P0") => ({ severity, code, subject, message });

export function validateCombatVfxAssetRequirements({ rootDir = root, manifest, presentation, content, overlay } = {}) {
  const activeManifest = manifest || readJson(rootDir, manifestFile);
  const activePresentation = presentation || readJson(rootDir, presentationFile);
  const activeContent = content || readJson(rootDir, contentFile);
  const activeOverlay = overlay || readJson(rootDir, overlayFile);
  const findings = [];
  const schema = readJson(rootDir, schemaFile);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(activeManifest)) {
    for (const error of validate.errors || []) findings.push(finding("ASSET_009_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));
  }

  const configuredCues = new Map((activePresentation.vfx || []).map((row) => [row.id, row]));
  const contentCues = new Map((activeContent.visualCues || []).map((row) => [row.cueId, row]));
  const manifestCues = new Map((activeManifest.visualCues || []).map((row) => [row.id, row]));
  const configuredBuffs = new Map((activePresentation.buffIcons || []).map((row) => [row.id, row]));
  const manifestBuffs = new Map((activeManifest.buffIcons || []).map((row) => [row.id, row]));
  const overlayAssets = new Map((activeOverlay.assets || []).map((row) => [row.id, row]));
  const overlayBindings = activeOverlay.bindings?.buffIcons || {};
  const bindingPolicy = activeManifest.policy?.runtimeBindingPolicy;

  if (manifestCues.size !== 28 || configuredCues.size !== 28 || contentCues.size !== 28) {
    findings.push(finding("ASSET_009_CUE_COVERAGE", "visualCues", "ASSET-009 requires exactly 28 manifest, presentation and content cue IDs."));
  }
  for (const [id, row] of manifestCues) {
    const presentationRow = configuredCues.get(id);
    const contentRow = contentCues.get(id);
    if (!presentationRow) findings.push(finding("ASSET_009_PRESENTATION_CUE_UNKNOWN", id, "Manifest cue is not present in the presentation contract."));
    else {
      if (presentationRow.logicalAssetId !== row.logicalAssetId) findings.push(finding("ASSET_009_LOGICAL_ID_DRIFT", id, "Manifest cue logicalAssetId differs from the presentation contract."));
      if (presentationRow.status !== "missing" || presentationRow.referenceAssetId !== null) findings.push(finding("ASSET_009_PRESENTATION_FALSE_SATISFACTION", id, "Presentation contract must keep this unapproved cue missing with no reference binding."));
      if (row.status !== "missing" || row.referenceAssetId !== null) findings.push(finding("ASSET_009_FALSE_SATISFACTION", id, "A VFX requirements row may not claim production satisfaction or bind a reference asset."));
    }
    if (!contentRow) findings.push(finding("ASSET_009_CONTENT_CUE_UNKNOWN", id, "Manifest cue is not present in the combat content visual cue list."));
    else if (contentRow.eventType !== row.eventType) findings.push(finding("ASSET_009_EVENT_TYPE_DRIFT", id, "Manifest eventType differs from the content visual cue."));
  }
  for (const id of configuredCues.keys()) if (!manifestCues.has(id)) findings.push(finding("ASSET_009_CUE_NOT_DECLARED", id, "Presentation cue is not declared in the ASSET-009 requirements table."));
  for (const row of activeManifest.visualCues || []) {
    if (!row.requiredPresentation || row.requiredPresentation.length < 8) findings.push(finding("ASSET_009_ART_BRIEF_MISSING", row.id, "Each cue needs a player-readable presentation brief."));
  }

  if (manifestBuffs.size !== 16 || configuredBuffs.size !== 16) findings.push(finding("ASSET_009_BUFF_COVERAGE", "buffIcons", "ASSET-009 requires exactly 16 manifest and presentation Buff icon IDs."));
  for (const [id, row] of manifestBuffs) {
    const presentationRow = configuredBuffs.get(id);
    const referenceId = overlayBindings[id];
    if (!presentationRow) findings.push(finding("ASSET_009_PRESENTATION_BUFF_UNKNOWN", id, "Manifest Buff icon is not present in the presentation contract."));
    else if (presentationRow.logicalAssetId !== row.logicalAssetId) findings.push(finding("ASSET_009_BUFF_LOGICAL_ID_DRIFT", id, "Manifest Buff logicalAssetId differs from the presentation contract."));
    if (row.status !== "reference-only") findings.push(finding("ASSET_009_BUFF_FALSE_SATISFACTION", id, "Reference Buff icons may only be development-only reference bindings."));
    if (!referenceId || referenceId !== row.referenceAssetId) findings.push(finding("ASSET_009_BUFF_REFERENCE_DRIFT", id, "Buff reference binding differs from the development overlay."));
    const ref = overlayAssets.get(row.referenceAssetId);
    if (!ref) findings.push(finding("ASSET_009_BUFF_REFERENCE_UNKNOWN", id, `Reference asset ${row.referenceAssetId} is absent from the overlay.`));
    else {
      if (ref.kind !== "buff-icon") findings.push(finding("ASSET_009_BUFF_REFERENCE_KIND", id, "Buff binding must point to a buff-icon reference asset."));
      if (ref.adoption !== "reference-only" || ref.approval !== "development-only") findings.push(finding("ASSET_009_BUFF_REFERENCE_POLICY", id, "Reference Buff icon must remain development-only and non-shipping."));
    }
  }
  for (const id of configuredBuffs.keys()) if (!manifestBuffs.has(id)) findings.push(finding("ASSET_009_BUFF_NOT_DECLARED", id, "Presentation Buff icon is not declared in the ASSET-009 requirements table."));

  if (activeManifest.referenceAudit?.eligibleVfxCandidates?.length !== 0) findings.push(finding("ASSET_009_VFX_REFERENCE_ELIGIBLE", "referenceAudit.eligibleVfxCandidates", "No reference VFX candidate passed the frame-addressable manual audit."));
  if (activeManifest.referenceAudit?.eligibleBuffCandidates?.length !== 6) findings.push(finding("ASSET_009_BUFF_REFERENCE_AUDIT", "referenceAudit.eligibleBuffCandidates", "The six audited Buff icon exemplars must remain explicitly listed as reference-only."));
  if (activeManifest.shippingAllowed !== false || activeManifest.sourcePolicy?.referenceBytesMayShip !== false || activeManifest.sourcePolicy?.referenceBindingsMaySatisfyProduction !== false) findings.push(finding("ASSET_009_SHIPPING_POLICY", "sourcePolicy", "Reference bytes and bindings must be excluded from shipping and production satisfaction."));
  if (!bindingPolicy || bindingPolicy.logicalIdOnly !== true || bindingPolicy.mountPoint !== "combat.vfx" || bindingPolicy.fallbackScope !== "development-only") findings.push(finding("ASSET_009_RUNTIME_BINDING_POLICY", "policy.runtimeBindingPolicy", "All VFX and Buff presentation must use logical IDs at combat.vfx with development-only fallbacks."));
  if (activeManifest.acceptanceGate?.productionStatus !== "blocked") findings.push(finding("ASSET_009_GATE_FALSE_OPEN", "acceptanceGate.productionStatus", "The production gate must remain blocked until owned assets and manual evidence exist."));

  const status = findings.length === 0 ? "PASS WITH KNOWN LIMITATIONS" : "REVISE";
  return {
    valid: findings.length === 0,
    status,
    findings,
    taskId: activeManifest.taskId,
    productionStatus: activeManifest.acceptanceGate?.productionStatus,
    counts: {
      visualCueRows: manifestCues.size,
      configuredVisualCues: configuredCues.size,
      missingVisualCues: (activeManifest.visualCues || []).filter((row) => row.status === "missing").length,
      buffIconRows: manifestBuffs.size,
      referenceOnlyBuffIcons: (activeManifest.buffIcons || []).filter((row) => row.status === "reference-only").length,
      eligibleVfxCandidates: activeManifest.referenceAudit?.eligibleVfxCandidates?.length || 0,
      eligibleBuffCandidates: activeManifest.referenceAudit?.eligibleBuffCandidates?.length || 0
    }
  };
}

function run() {
  const result = validateCombatVfxAssetRequirements();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run();
