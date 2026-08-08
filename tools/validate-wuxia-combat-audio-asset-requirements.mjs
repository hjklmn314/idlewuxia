import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = "config/wuxia_combat_audio_asset_requirements.json";
const schemaFile = "config/wuxia_combat_audio_asset_requirements.schema.json";
const presentationFile = "config/wuxia_combat_presentation_contract.json";
const contentFile = "config/wuxia_combat_content.json";
const overlayFile = "config/wuxia_combat_reference_asset_overlay.json";
const outputPath = path.join(root, "outputs", "production_os", "combat-audio-asset-requirements-validation.json");

const readJson = (rootDir, file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8").replace(/^\uFEFF/, ""));
const finding = (code, subject, message, severity = "P0") => ({ severity, code, subject, message });

export function validateCombatAudioAssetRequirements({ rootDir = root, manifest, presentation, content, overlay } = {}) {
  const activeManifest = manifest || readJson(rootDir, manifestFile);
  const activePresentation = presentation || readJson(rootDir, presentationFile);
  const activeContent = content || readJson(rootDir, contentFile);
  const activeOverlay = overlay || readJson(rootDir, overlayFile);
  const findings = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(readJson(rootDir, schemaFile));
  if (!validate(activeManifest)) for (const error of validate.errors || []) findings.push(finding("ASSET_010_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));

  const configured = new Map((activePresentation.audio || []).map((row) => [row.id, row]));
  const contentCues = new Map((activeContent.audioCues || []).map((row) => [row.audioCueId, row]));
  const manifestCues = new Map((activeManifest.audioCues || []).map((row) => [row.id, row]));
  const overlayAssets = new Map((activeOverlay.assets || []).map((row) => [row.id, row]));
  const overlayBindings = activeOverlay.bindings?.audio || {};

  if (manifestCues.size !== 5 || configured.size !== 5 || contentCues.size !== 5) findings.push(finding("ASSET_010_AUDIO_COVERAGE", "audioCues", "ASSET-010 requires exactly five manifest, presentation and content audio cue IDs."));
  for (const [id, row] of manifestCues) {
    const presentationRow = configured.get(id);
    const contentRow = contentCues.get(id);
    if (!presentationRow) findings.push(finding("ASSET_010_PRESENTATION_CUE_UNKNOWN", id, "Manifest audio cue is not present in the presentation contract."));
    else {
      if (presentationRow.logicalAssetId !== row.logicalAssetId) findings.push(finding("ASSET_010_LOGICAL_ID_DRIFT", id, "Manifest audio logicalAssetId differs from the presentation contract."));
      if (presentationRow.status !== "reference-only") findings.push(finding("ASSET_010_PRESENTATION_STATUS_DRIFT", id, "The current presentation contract must keep reference audio development-only."));
      if (presentationRow.referenceAssetId !== row.referenceAssetId) findings.push(finding("ASSET_010_REFERENCE_DRIFT", id, "Manifest referenceAssetId differs from the presentation contract."));
      if (row.status !== "reference-only") findings.push(finding("ASSET_010_FALSE_SATISFACTION", id, "Reference audio may not claim production satisfaction."));
    }
    if (!contentRow) findings.push(finding("ASSET_010_CONTENT_CUE_UNKNOWN", id, "Manifest audio cue is not present in combat content."));
    else if (contentRow.audioCueId !== id) findings.push(finding("ASSET_010_CONTENT_ID_DRIFT", id, "Manifest audio ID differs from content audioCueId."));
    const binding = overlayBindings[id];
    if (!binding || binding !== row.referenceAssetId) findings.push(finding("ASSET_010_OVERLAY_BINDING_DRIFT", id, "Audio reference binding differs from the development overlay."));
    const ref = overlayAssets.get(row.referenceAssetId);
    if (!ref) findings.push(finding("ASSET_010_REFERENCE_UNKNOWN", id, `Reference asset ${row.referenceAssetId} is absent from the overlay.`));
    else {
      if (ref.kind !== "audio" || ref.format !== "mp3") findings.push(finding("ASSET_010_REFERENCE_KIND", id, "Development audio reference must be an MP3 audio asset."));
      if (ref.adoption !== "reference-only" || ref.approval !== "development-only") findings.push(finding("ASSET_010_REFERENCE_POLICY", id, "Reference audio must remain development-only and non-shipping."));
    }
  }
  for (const id of configured.keys()) if (!manifestCues.has(id)) findings.push(finding("ASSET_010_CUE_NOT_DECLARED", id, "Presentation audio cue is not declared in the ASSET-010 requirements table."));

  if (activeManifest.referenceAudit?.productionEligibleCandidates?.length !== 0) findings.push(finding("ASSET_010_PRODUCTION_REFERENCE_ELIGIBLE", "referenceAudit.productionEligibleCandidates", "No competitor MP3 may be treated as a production-eligible audio source."));
  if (activeManifest.referenceAudit?.auditedReferenceCandidates?.length !== 4) findings.push(finding("ASSET_010_REFERENCE_AUDIT", "referenceAudit.auditedReferenceCandidates", "The four overlay audio references must remain explicitly hashed and reference-only."));
  const policy = activeManifest.policy;
  if (activeManifest.shippingAllowed !== false || activeManifest.sourcePolicy?.referenceBytesMayShip !== false || activeManifest.sourcePolicy?.referenceBindingsMaySatisfyProduction !== false) findings.push(finding("ASSET_010_SHIPPING_POLICY", "sourcePolicy", "Reference audio bytes and bindings must be excluded from shipping and production satisfaction."));
  if (policy?.runtimeMountPoint !== "combat.audio" || policy.logicalIdOnly !== true || policy.fallbackScope !== "development-only") findings.push(finding("ASSET_010_RUNTIME_BINDING_POLICY", "policy", "Audio must mount through logical IDs at combat.audio with a development-only boundary."));
  if (policy?.productionFormat !== "ogg" || policy.productionRejectsSynth !== true || policy.productionRejectsOscillator !== true || policy.productionRejectsReferenceOnly !== true) findings.push(finding("ASSET_010_PRODUCTION_FORMAT_POLICY", "policy", "Production audio must be owned/licensed OGG and reject synth, oscillator and reference-only fallbacks."));
  if (activeManifest.acceptanceGate?.productionStatus !== "blocked") findings.push(finding("ASSET_010_GATE_FALSE_OPEN", "acceptanceGate.productionStatus", "Audio production gate must remain blocked until owned/device evidence exists."));

  const status = findings.length === 0 ? "PASS WITH KNOWN LIMITATIONS" : "REVISE";
  return {
    valid: findings.length === 0,
    status,
    findings,
    taskId: activeManifest.taskId,
    productionStatus: activeManifest.acceptanceGate?.productionStatus,
    counts: {
      audioCueRows: manifestCues.size,
      configuredAudioCues: configured.size,
      referenceOnlyAudioCues: (activeManifest.audioCues || []).filter((row) => row.status === "reference-only").length,
      productionEligibleReferenceCandidates: activeManifest.referenceAudit?.productionEligibleCandidates?.length || 0,
      auditedReferenceCandidates: activeManifest.referenceAudit?.auditedReferenceCandidates?.length || 0
    }
  };
}

function run() {
  const result = validateCombatAudioAssetRequirements();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run();
