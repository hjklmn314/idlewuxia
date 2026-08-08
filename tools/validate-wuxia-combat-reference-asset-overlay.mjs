import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { createReferenceAssetRegistry } from "../src/assetRegistry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overlayPath = path.join(root, "config", "wuxia_combat_reference_asset_overlay.json");
const schemaPath = path.join(root, "config", "wuxia_combat_reference_asset_overlay.schema.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function finding(code, subject, message) {
  return { code, subject, message };
}

export function validateCombatReferenceAssetOverlay({ rootDir = root, overlay, schema } = {}) {
  const doc = overlay || readJson(path.join(rootDir, "config", "wuxia_combat_reference_asset_overlay.json"));
  const schemaDoc = schema || readJson(path.join(rootDir, "config", "wuxia_combat_reference_asset_overlay.schema.json"));
  const findings = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schemaDoc);
  if (!validate(doc)) {
    for (const error of validate.errors || []) findings.push(finding("OVERLAY_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));
  }
  try {
    createReferenceAssetRegistry(doc);
  } catch (error) {
    findings.push(finding(error.code || "OVERLAY_RUNTIME_INVALID", "runtime", error.message));
  }
  const assets = new Map((doc.assets || []).map((asset) => [asset.id, asset]));
  for (const [bindingGroup, bindings] of Object.entries(doc.bindings || {})) {
    for (const [bindingId, assetId] of Object.entries(bindings || {})) {
      if (!assets.has(assetId)) findings.push(finding("OVERLAY_BINDING_UNKNOWN_ASSET", `${bindingGroup}.${bindingId}`, `Unknown reference asset: ${assetId}`));
    }
  }
  if (doc.shippingAllowed !== false) findings.push(finding("OVERLAY_SHIPPING_ALLOWED", "shippingAllowed", "Reference overlay must never be shippable."));
  const sourceProject = doc.sourceProject || {};
  if (sourceProject.projectId !== "fangzhijianghu-original-project") findings.push(finding("OVERLAY_SOURCE_PROJECT_ID", "sourceProject.projectId", "Development bindings must identify the original Fangzhi Jianghu project."));
  if (sourceProject.shippingAllowed !== false || sourceProject.referenceBytesMayShip !== false) findings.push(finding("OVERLAY_SOURCE_PROJECT_SHIPPING", "sourceProject", "Original project bytes must remain development-only and non-shipping."));
  if (sourceProject.usage !== "original-project-development-binding") findings.push(finding("OVERLAY_SOURCE_PROJECT_USAGE", "sourceProject.usage", "Original project assets must be explicitly marked as development bindings."));
  const coverage = doc.bindingCoverage || {};
  if (coverage.actor?.status !== "missing" || coverage.vfx?.status !== "missing") findings.push(finding("OVERLAY_MISSING_COVERAGE_DRIFT", "bindingCoverage", "Actor and VFX coverage must remain explicitly missing until approved source sets exist."));
  if (coverage.scene?.logicalCount !== Object.keys(doc.bindings?.scenes || {}).length) findings.push(finding("OVERLAY_SCENE_COVERAGE_DRIFT", "bindingCoverage.scene.logicalCount", "Scene coverage must match scene logical bindings."));
  if (coverage.buff?.logicalCount !== Object.keys(doc.bindings?.buffIcons || {}).length) findings.push(finding("OVERLAY_BUFF_COVERAGE_DRIFT", "bindingCoverage.buff.logicalCount", "Buff coverage must match Buff logical bindings."));
  if (coverage.audio?.logicalCount !== Object.keys(doc.bindings?.audio || {}).length) findings.push(finding("OVERLAY_AUDIO_COVERAGE_DRIFT", "bindingCoverage.audio.logicalCount", "Audio coverage must match audio logical bindings."));
  const sourceRoot = String(sourceProject.root || "").replace(/\\+$/, "");
  if (sourceRoot) {
    for (const asset of doc.assets || []) {
      if (!String(asset.path || "").startsWith(`${sourceRoot}/`)) findings.push(finding("OVERLAY_SOURCE_ROOT_DRIFT", asset.id, "Development asset path is outside the declared original project source root."));
    }
  }
  const requireLocal = process.argv.includes("--require-local");
  const localAssets = [];
  if (requireLocal) {
    for (const asset of doc.assets || []) {
      const filePath = path.join(rootDir, asset.path);
      if (!fs.existsSync(filePath)) findings.push(finding("OVERLAY_LOCAL_FILE_MISSING", asset.id, filePath));
      else localAssets.push(asset.id);
    }
  }
  return {
    valid: findings.length === 0,
    findings,
    overlayId: doc.overlayId,
    assetCount: (doc.assets || []).length,
    bindingCount: Object.values(doc.bindings || {}).reduce((sum, value) => sum + Object.keys(value || {}).length, 0),
    localAssets,
    requireLocal,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateCombatReferenceAssetOverlay();
  console.log(JSON.stringify({ status: result.valid ? "PASS" : "FAIL", ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
}
