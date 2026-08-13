import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractFile = "config/wuxia_combat_presentation_contract.json";
const schemaFile = "config/wuxia_combat_presentation_contract.schema.json";
const combatFile = "config/wuxia_combat_content.json";
const overlayFile = "config/wuxia_combat_reference_asset_overlay.json";
const outputPath = path.join(root, "outputs", "production_os", "combat-presentation-contract-validation.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function finding(code, subject, message, severity = "P0") {
  return { severity, code, subject, message };
}

function ids(rows) {
  return new Set((rows || []).map((row) => row.id));
}

function duplicateIds(rows, label, findings) {
  const seen = new Set();
  for (const row of rows || []) {
    if (seen.has(row.id)) findings.push(finding("COMBAT_PRESENTATION_DUPLICATE_BINDING", `${label}.${row.id}`, "Binding IDs must be unique within a mount group."));
    seen.add(row.id);
  }
}

export function validateCombatPresentationContract({ rootDir = root, contract, combatContent, overlay, strictProduction = false } = {}) {
  const activeRoot = rootDir;
  const activeContract = contract || readJson(path.join(activeRoot, contractFile));
  const activeCombat = combatContent || readJson(path.join(activeRoot, combatFile));
  const activeOverlay = overlay || readJson(path.join(activeRoot, overlayFile));
  const schema = readJson(path.join(activeRoot, schemaFile));
  const findings = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(activeContract)) {
    for (const error of validate.errors || []) findings.push(finding("COMBAT_PRESENTATION_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));
  }

  const groups = {
    actors: activeContract.actors || [],
    scenes: activeContract.scenes || [],
    vfx: activeContract.vfx || [],
    audio: activeContract.audio || [],
    buffIcons: activeContract.buffIcons || [],
  };
  for (const [label, rows] of Object.entries(groups)) duplicateIds(rows, label, findings);

  const contentVisual = new Set((activeCombat.visualCues || []).map((row) => row.cueId));
  const contentAudio = new Set((activeCombat.audioCues || []).map((row) => row.audioCueId));
  const contentBuffs = new Set((activeCombat.buffs || []).map((row) => row.buffId));
  const contentScenes = new Set(Object.keys(activeCombat.assetBindings || {}).filter((id) => id.startsWith("scene_")));
  const contractVisual = ids(groups.vfx);
  const contractAudio = ids(groups.audio);
  const contractBuffs = ids(groups.buffIcons);
  const contractScenes = ids(groups.scenes);

  for (const cueId of contentVisual) if (!contractVisual.has(cueId)) findings.push(finding("COMBAT_PRESENTATION_VFX_COVERAGE_MISSING", cueId, "Every configured combat visual cue must have a presentation binding."));
  for (const cueId of contractVisual) if (!contentVisual.has(cueId)) findings.push(finding("COMBAT_PRESENTATION_VFX_UNKNOWN_CUE", cueId, "Presentation VFX binding is not present in combat content."));
  for (const cueId of contentAudio) if (!contractAudio.has(cueId)) findings.push(finding("COMBAT_PRESENTATION_AUDIO_COVERAGE_MISSING", cueId, "Every configured combat audio cue must have a presentation binding."));
  for (const cueId of contractAudio) if (!contentAudio.has(cueId)) findings.push(finding("COMBAT_PRESENTATION_AUDIO_UNKNOWN_CUE", cueId, "Presentation audio binding is not present in combat content."));
  for (const buffId of contentBuffs) if (!contractBuffs.has(buffId)) findings.push(finding("COMBAT_PRESENTATION_BUFF_COVERAGE_MISSING", buffId, "Every configured Buff must have a presentation icon binding."));
  for (const buffId of contractBuffs) if (!contentBuffs.has(buffId)) findings.push(finding("COMBAT_PRESENTATION_BUFF_UNKNOWN_ID", buffId, "Presentation Buff icon binding is not present in combat content."));
  for (const sceneId of contentScenes) if (!contractScenes.has(sceneId)) findings.push(finding("COMBAT_PRESENTATION_SCENE_COVERAGE_MISSING", sceneId, "Every configured combat scene must have a presentation binding."));

  const overlayAssets = new Map((activeOverlay.assets || []).map((asset) => [asset.id, asset]));
  const overlayBindings = activeOverlay.bindings || {};
  for (const [groupName, rows] of Object.entries(groups)) {
    for (const row of rows) {
      if (!row.referenceAssetId) continue;
      const asset = overlayAssets.get(row.referenceAssetId);
      if (!asset) findings.push(finding("COMBAT_PRESENTATION_REFERENCE_UNKNOWN", `${groupName}.${row.id}`, `Reference asset ${row.referenceAssetId} is absent from the development overlay.`));
      const overlayGroup = groupName === "buffIcons" ? "buffIcons" : groupName;
      if (asset && overlayBindings[overlayGroup]?.[row.id] !== row.referenceAssetId) {
        findings.push(finding("COMBAT_PRESENTATION_REFERENCE_BINDING_DRIFT", `${groupName}.${row.id}`, "Contract referenceAssetId does not match the overlay binding."));
      }
    }
    for (const overlayId of Object.keys(overlayBindings[groupName] || {})) {
      if (!ids(rows).has(overlayId)) findings.push(finding("COMBAT_PRESENTATION_OVERLAY_BINDING_UNKNOWN", `${groupName}.${overlayId}`, "Overlay binding has no presentation contract row."));
    }
  }

  const productionProfile = activeContract.policy?.profiles?.production || {};
  const productionBlocked = [];
  for (const [groupName, rows] of Object.entries(groups)) {
    for (const row of rows) {
      if (row.status !== "satisfied") productionBlocked.push({ group: groupName, id: row.id, status: row.status, requiredSlotId: row.requiredSlotId, requirements: row.requirements });
      if (strictProduction && row.status !== "satisfied") findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_ASSET_MISSING", `${groupName}.${row.id}`, `Production mode requires an approved asset for ${row.requiredSlotId}.`));
      if (strictProduction && row.referenceAssetId) findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_REFERENCE_FORBIDDEN", `${groupName}.${row.id}`, "Reference-only assets cannot satisfy the production presentation gate."));
      if (strictProduction && row.devFallback !== "none" && row.devFallback !== "") findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_FALLBACK_FORBIDDEN", `${groupName}.${row.id}`, `Production fallback is forbidden: ${row.devFallback}.`));
    }
  }
  if (productionProfile.referenceOverlayAllowed !== false) findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_OVERLAY_POLICY", "policy.profiles.production", "Production profile must forbid the development reference overlay."));
  if (productionProfile.cssActorFallback !== "forbidden") findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_ACTOR_FALLBACK_POLICY", "policy.profiles.production", "Production profile must forbid CSS actor fallback."));
  if (productionProfile.cssVfxFallback !== "forbidden") findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_VFX_FALLBACK_POLICY", "policy.profiles.production", "Production profile must forbid CSS VFX fallback."));
  if (productionProfile.synthAudioAllowed !== false) findings.push(finding("COMBAT_PRESENTATION_PRODUCTION_SYNTH_POLICY", "policy.profiles.production", "Production profile must forbid synthesized audio."));
  if (strictProduction && (activeCombat.audioCues || []).some((cue) => cue.kind === "synth")) findings.push(finding("COMBAT_PRESENTATION_SYNTH_AUDIO_CONFIGURED", "audioCues", "Combat content still contains synthesized audio cues."));

  const requirements = new Map((activeContract.requirements || []).map((row) => [row.taskId, row]));
  for (const row of [...Object.values(groups).flat(), ...(activeContract.requirements || [])]) {
    for (const taskId of row.requirements || []) if (!requirements.has(taskId)) findings.push(finding("COMBAT_PRESENTATION_REQUIREMENT_UNKNOWN", taskId, `Binding references missing requirement ${taskId}.`));
  }
  const actorRequirement = requirements.get("ASSET-007");
  const requiredActorInputs = ["body", "head-base", "eyes", "mouth", "hair", "idle", "move", "attack", "hurt", "control", "defeat", "shared anchors", "shared frame timeline"];
  if (!actorRequirement || requiredActorInputs.some((item) => !actorRequirement.mustProvide.includes(item))) findings.push(finding("COMBAT_PRESENTATION_MODULAR_ACTOR_REQUIREMENT", "ASSET-007", "ASSET-007 must require all five modular parts, six clips, shared anchors and a shared frame timeline."));
  if (actorRequirement && (!actorRequirement.acceptance.includes("No independent leg silhouette") || !actorRequirement.acceptance.includes("Every required part independently replaceable"))) findings.push(finding("COMBAT_PRESENTATION_MODULAR_ACTOR_ACCEPTANCE", "ASSET-007", "ASSET-007 must fail visible legs and require independent part replacement evidence."));
  const status = strictProduction
    ? (findings.length === 0 ? "PASS" : "BLOCKED")
    : (findings.length === 0 && productionBlocked.length === 0 ? "PASS" : findings.length === 0 ? "PASS WITH KNOWN LIMITATIONS" : "REVISE");
  return {
    valid: findings.length === 0,
    status,
    findings,
    strictProduction,
    contractId: activeContract.contractId,
    contentVersion: activeContract.contentVersion,
    counts: {
      actorBindings: groups.actors.length,
      sceneBindings: groups.scenes.length,
      visualCueBindings: groups.vfx.length,
      audioCueBindings: groups.audio.length,
      buffIconBindings: groups.buffIcons.length,
      productionBlocked: productionBlocked.length,
      requirementRows: activeContract.requirements?.length || 0,
    },
    productionBlocked,
  };
}

function run() {
  const strictProduction = process.argv.includes("--strict-production");
  const result = validateCombatPresentationContract({ strictProduction });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (strictProduction ? result.valid : result.findings.some((item) => item.severity === "P0" && item.code.startsWith("COMBAT_PRESENTATION_"))) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run();
