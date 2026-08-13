import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "config", "production", "asset_contract.json");
const contractSchemaPath = path.join(root, "config", "production", "schemas", "asset_contract.schema.json");
const productionRegistryPath = path.join(root, "config", "production", "asset_registry.json");
const combatContentPath = path.join(root, "config", "wuxia_combat_content.json");
const outputPath = path.join(root, "outputs", "production_os", "asset-contract-validation.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function finding(code, subject, message, severity = "P0") {
  return { severity, code, subject, message };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validBodyMovement(phases) {
  if (!Array.isArray(phases) || phases.length < 4) return false;
  const requiredOrder = ["compress", "translate", "recover"];
  let cursor = -1;
  for (const phase of requiredOrder) {
    cursor = phases.indexOf(phase, cursor + 1);
    if (cursor < 0) return false;
  }
  return true;
}

function canonicalObject(value) {
  if (Array.isArray(value)) return value.map(canonicalObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalObject(value[key])]));
  return value;
}

function validateSchema(contract, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const valid = validate(contract);
  return { valid, errors: (validate.errors || []).map((error) => ({ instancePath: error.instancePath || "/", message: error.message || "Schema validation failed." })) };
}

export function validateProductionAssetContract({ rootDir = root, contract, productionRegistry, combatContent, requireSatisfiedSlots = false } = {}) {
  const activeRoot = rootDir;
  const activeContract = contract || readJson(path.join(activeRoot, "config", "production", "asset_contract.json"));
  const activeProduction = productionRegistry || readJson(path.join(activeRoot, "config", "production", "asset_registry.json"));
  const activeCombat = combatContent || readJson(path.join(activeRoot, "config", "wuxia_combat_content.json"));
  const schema = readJson(path.join(activeRoot, "config", "production", "schemas", "asset_contract.schema.json"));
  const findings = [];
  const schemaResult = validateSchema(activeContract, schema);
  for (const error of schemaResult.errors) findings.push(finding("ASSET_CONTRACT_SCHEMA_INVALID", error.instancePath, error.message));
  if (!schemaResult.valid) return { valid: false, findings, schema: schemaResult, counts: { slots: 0, assets: 0, satisfiedSlots: 0 } };

  const slots = new Map(activeContract.slotContracts.map((slot) => [slot.slotId, slot]));
  const mountPoints = new Map(activeContract.mountPoints.map((mount) => [mount.id, mount]));
  const productionSlots = new Map(activeProduction.requiredSlots.map((slot) => [slot.id, slot]));
  const productionAssets = new Map(activeProduction.assets.map((asset) => [asset.id, asset]));
  const records = new Map();

  for (const slotId of productionSlots.keys()) {
    if (!slots.has(slotId)) findings.push(finding("ASSET_CONTRACT_SLOT_MISSING", slotId, "Every production asset slot must have a frozen contract."));
  }
  for (const slotId of slots.keys()) {
    if (!productionSlots.has(slotId)) findings.push(finding("ASSET_CONTRACT_SLOT_UNKNOWN", slotId, "Contract contains an asset slot absent from the production registry."));
  }

  const packageBytes = activeContract.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (packageBytes > activeContract.policy.maxPackageBytes) findings.push(finding("ASSET_PACKAGE_BUDGET_EXCEEDED", activeContract.contractId, `Declared bytes ${packageBytes} exceed package budget ${activeContract.policy.maxPackageBytes}.`));

  for (const asset of activeContract.assets) {
    if (records.has(asset.assetId)) findings.push(finding("ASSET_CONTRACT_DUPLICATE_ID", asset.assetId, "Asset logical IDs must be unique."));
    records.set(asset.assetId, asset);
    const slot = slots.get(asset.slotId);
    if (!slot) {
      findings.push(finding("ASSET_CONTRACT_ASSET_UNKNOWN_SLOT", asset.assetId, `Unknown slot ${asset.slotId}.`));
      continue;
    }
    const productionAsset = productionAssets.get(asset.assetId);
    if (!productionAsset) findings.push(finding("ASSET_CONTRACT_PRODUCTION_ASSET_MISSING", asset.assetId, "Contract asset is not registered in production asset_registry.json."));
    if (productionAsset?.adoption === "ship" && asset.source.path !== productionAsset.shippingPath) findings.push(finding("ASSET_CONTRACT_SOURCE_PATH_DRIFT", asset.assetId, "Contract source path differs from production shipping path."));
    if (productionAsset?.provenance && productionAsset.provenance !== asset.source.provenance) findings.push(finding("ASSET_CONTRACT_PROVENANCE_DRIFT", asset.assetId, "Contract provenance differs from production registry."));
    if (asset.source.provenance === "licensed-third-party" && asset.source.licenseStatus !== "verified-license") findings.push(finding("ASSET_CONTRACT_LICENSE_UNVERIFIED", asset.assetId, "Licensed assets require verified-license status."));
    if (!activeContract.policy.allowedFormats[asset.kind]?.includes(asset.format)) findings.push(finding("ASSET_CONTRACT_FORMAT_FORBIDDEN", asset.assetId, `${asset.format} is not allowed for ${asset.kind}.`));
    if (asset.bytes > asset.budgetBytes) findings.push(finding("ASSET_CONTRACT_BUDGET_EXCEEDED", asset.assetId, `Declared bytes ${asset.bytes} exceed asset budget ${asset.budgetBytes}.`));
    for (const mountId of asset.runtimeMountPoints) {
      const mount = mountPoints.get(mountId);
      if (!mount) findings.push(finding("ASSET_CONTRACT_MOUNT_UNKNOWN", asset.assetId, `Unknown runtime mount point ${mountId}.`));
      else if (mount.kind !== asset.kind) findings.push(finding("ASSET_CONTRACT_MOUNT_KIND_MISMATCH", asset.assetId, `${mountId} expects ${mount.kind}, asset is ${asset.kind}.`));
      if (!slot.mountPoints.includes(mountId)) findings.push(finding("ASSET_CONTRACT_MOUNT_NOT_IN_SLOT", asset.assetId, `${mountId} is not allowed by slot ${slot.slotId}.`));
    }
    if (slot.rules.forbidBakedCharacters && asset.containsBakedCharacters) findings.push(finding("ASSET_CONTRACT_BAKED_CHARACTER", asset.assetId, "This slot forbids characters baked into the asset."));
    if (slot.rules.requiresSideView && asset.view !== "side") findings.push(finding("ASSET_CONTRACT_CHARACTER_VIEW_INVALID", asset.assetId, "Character assets must be side-view only."));
    if (slot.rules.requiresSideView) {
      if (slot.rules.characterConstruction !== "modular-head-body") findings.push(finding("ASSET_CONTRACT_CHARACTER_CONSTRUCTION", asset.assetId, "Character slot must use modular head/body construction."));
      if (slot.rules.legSilhouette !== "forbidden") findings.push(finding("ASSET_CONTRACT_LEG_SILHOUETTE", asset.assetId, "Character slot must forbid a separate leg silhouette."));
      if (!["body", "head-base", "eyes", "mouth", "hair"].every((part) => slot.rules.requiredParts.includes(part))) findings.push(finding("ASSET_CONTRACT_REQUIRED_PARTS", asset.assetId, "Character slot must require body, head-base, eyes, mouth and hair layers."));
      if (![...slot.rules.requiredParts, ...slot.rules.optionalParts].includes(asset.characterPart)) findings.push(finding("ASSET_CONTRACT_CHARACTER_PART_INVALID", asset.assetId, "Character assets must declare an allowed required or optional modular part type."));
      if (asset.dimensions.width !== 96 || asset.dimensions.height !== 96) findings.push(finding("ASSET_CONTRACT_CHARACTER_CANVAS_INVALID", asset.assetId, "Every modular character part atlas must use the frozen 96x96 logical canvas."));
      for (const anchor of ["origin", "head", "face", "weapon-main", "fx-center", "ground-contact"]) if (!asset.anchors[anchor]) findings.push(finding("ASSET_CONTRACT_CHARACTER_ANCHOR_MISSING", asset.assetId, `Required shared anchor is missing: ${anchor}.`));
      for (const clipId of slot.rules.requiredClips) {
        const clip = asset.clipFrames[clipId];
        if (!clip) findings.push(finding("ASSET_CONTRACT_CLIP_MISSING", asset.assetId, `Required animation clip is missing: ${clipId}.`));
        else if (clip.frameCount < 4 && clipId === "move") findings.push(finding("ASSET_CONTRACT_MOVE_FRAME_COUNT", asset.assetId, "move requires at least four body-phase frames."));
      }
      if (slot.rules.movementPhasePolicy === "body-compress-translate-recover" && asset.clipFrames.move && !validBodyMovement(asset.clipFrames.move.bodyPhases)) findings.push(finding("ASSET_CONTRACT_BODY_MOVEMENT_PHASES", asset.assetId, "move phases must include compress, translate and recover in order."));
    }
    if (asset.kind === "audio") {
      if (asset.format !== "ogg") findings.push(finding("ASSET_CONTRACT_AUDIO_FORMAT_INVALID", asset.assetId, "Production audio must be OGG."));
      if (asset.fallbackPolicy !== "none") findings.push(finding("ASSET_CONTRACT_AUDIO_FALLBACK", asset.assetId, "Production audio cannot silently fall back."));
    }
    if (asset.fallbackPolicy !== "none" && activeContract.policy.forbidSilentFallback && asset.fallbackPolicy !== "explicit-configured-only") findings.push(finding("ASSET_CONTRACT_SILENT_FALLBACK", asset.assetId, "Silent fallback is forbidden by the production contract."));
    const filePath = path.join(activeRoot, asset.source.path);
    if (!fs.existsSync(filePath)) findings.push(finding("ASSET_CONTRACT_SOURCE_MISSING", asset.assetId, `Source file does not exist: ${asset.source.path}.`));
    else {
      const actualBytes = fs.statSync(filePath).size;
      const actualHash = sha256(filePath);
      if (actualBytes !== asset.bytes) findings.push(finding("ASSET_CONTRACT_BYTES_DRIFT", asset.assetId, `Expected ${asset.bytes} bytes, got ${actualBytes}.`));
      if (actualHash !== asset.sha256) findings.push(finding("ASSET_CONTRACT_HASH_DRIFT", asset.assetId, "Source SHA-256 does not match the contract."));
    }
  }

  const characterAssets = activeContract.assets.filter((asset) => asset.slotId === "combat-side-view-character-sprites");
  if (characterAssets.length > 0) {
    const requiredParts = slots.get("combat-side-view-character-sprites")?.rules?.requiredParts || [];
    const availableParts = new Set(characterAssets.map((asset) => asset.characterPart));
    for (const part of requiredParts) if (!availableParts.has(part)) findings.push(finding("ASSET_CONTRACT_CHARACTER_PART_COVERAGE", part, `No approved character asset supplies required part ${part}.`));
    const timelineSignature = (asset) => JSON.stringify(canonicalObject({
      dimensions: asset.dimensions,
      pivot: asset.pivot,
      anchors: asset.anchors,
      clips: Object.fromEntries(Object.entries(asset.clipFrames).map(([clipId, clip]) => [clipId, { frameCount: clip.frameCount, fps: clip.fps, bodyPhases: clip.bodyPhases }])),
    }));
    const expectedSignature = timelineSignature(characterAssets[0]);
    for (const asset of characterAssets.slice(1)) if (timelineSignature(asset) !== expectedSignature) findings.push(finding("ASSET_CONTRACT_CHARACTER_TIMELINE_DRIFT", asset.assetId, "All modular character parts must share canvas, pivot, anchors, clip frames, FPS and body phases."));
  }

  for (const slot of activeProduction.requiredSlots) {
    if (slot.status === "satisfied") {
      if (!slot.assetId) findings.push(finding("ASSET_CONTRACT_SATISFIED_SLOT_NO_ASSET", slot.id, "Satisfied slots require assetId in the production registry."));
      else if (!records.has(slot.assetId)) findings.push(finding("ASSET_CONTRACT_SATISFIED_ASSET_MISSING", slot.id, `Satisfied slot points to missing contract asset ${slot.assetId}.`));
    }
    if (requireSatisfiedSlots && slot.status !== "satisfied") findings.push(finding("ASSET_CONTRACT_SLOT_OPEN", slot.id, "Strict production mode requires every asset slot to be satisfied."));
  }

  if (requireSatisfiedSlots && activeContract.policy.forbidCombatAssetFallbacks) {
    for (const [bindingId, binding] of Object.entries(activeCombat.assetBindings || {})) {
      if (binding.fallback) findings.push(finding("ASSET_CONTRACT_COMBAT_FALLBACK", bindingId, `Combat binding still declares a fallback: ${binding.fallback}.`));
      if (binding.assetId && !records.has(binding.assetId)) findings.push(finding("ASSET_CONTRACT_COMBAT_ASSET_UNRESOLVED", bindingId, `Combat binding references an asset not yet present in the contract: ${binding.assetId}.`));
    }
    for (const audioCue of activeCombat.audioCues || []) {
      if (audioCue.kind === "synth") findings.push(finding("ASSET_CONTRACT_SYNTH_AUDIO", audioCue.audioCueId, "Synthesized oscillator audio is not allowed in production."));
    }
  }

  return {
    valid: findings.length === 0,
    findings,
    schema: schemaResult,
    counts: {
      slots: slots.size,
      assets: records.size,
      satisfiedSlots: activeProduction.requiredSlots.filter((slot) => slot.status === "satisfied").length,
      openSlots: activeProduction.requiredSlots.filter((slot) => slot.status !== "satisfied").length,
    },
  };
}

function run() {
  const strict = process.argv.includes("--strict-production");
  const result = validateProductionAssetContract({ requireSatisfiedSlots: strict });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), mode: strict ? "strict-production" : "contract-only", status: result.valid ? "PASS" : "FAIL", ...result }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ status: result.valid ? "PASS" : "FAIL", mode: strict ? "strict-production" : "contract-only", ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run();

export { clone };
