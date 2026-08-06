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
