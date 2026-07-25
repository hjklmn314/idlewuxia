import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { validateRuntimeAssetManifest } from "../src/assetRegistry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionPath = path.join(root, "config", "production", "asset_registry.json");
const runtimePath = path.join(root, "config", "wuxia_runtime_asset_registry.json");
const scopePath = path.join(root, "config", "project_scope.json");
const schemaPath = path.join(root, "config", "wuxia_runtime_asset_registry.schema.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function finding(code, subject, message) {
  return { code, subject, message };
}

export function validateWuxiaAssetRegistry({ rootDir = root, production, runtime, scope } = {}) {
  const productionDoc = production || readJson(path.join(rootDir, "config", "production", "asset_registry.json"));
  const runtimeDoc = runtime || readJson(path.join(rootDir, "config", "wuxia_runtime_asset_registry.json"));
  const scopeDoc = scope || readJson(path.join(rootDir, "config", "project_scope.json"));
  const findings = [];
  const runtimeResult = validateRuntimeAssetManifest(runtimeDoc);
  findings.push(...runtimeResult.findings.map((item) => finding(item.code, "runtime", item.message)));

  const shippingAssets = productionDoc.assets.filter((asset) => asset.adoption === "ship");
  const expectedIds = new Set(shippingAssets.map((asset) => asset.id));
  const actualIds = new Set((runtimeDoc.assets || []).map((asset) => asset.id));
  for (const id of expectedIds) if (!actualIds.has(id)) findings.push(finding("RUNTIME_ASSET_MISSING", id, "Approved shipping asset is missing from runtime projection."));
  for (const id of actualIds) if (!expectedIds.has(id)) findings.push(finding("RUNTIME_ASSET_NOT_SHIPPING", id, "Runtime projection contains an asset that is not adoption=ship in production registry."));

  const shippingFiles = new Set(scopeDoc.shippingFiles || []);
  for (const asset of runtimeDoc.assets || []) {
    const source = productionDoc.assets.find((item) => item.id === asset.id);
    if (!source) continue;
    if (asset.path !== source.shippingPath) findings.push(finding("RUNTIME_ASSET_PATH_DRIFT", asset.id, `${asset.path} does not match production shippingPath ${source.shippingPath}.`));
    if (asset.sha256 !== source.sha256 || asset.bytes !== source.bytes) findings.push(finding("RUNTIME_ASSET_INTEGRITY_DRIFT", asset.id, "Runtime projection hash or byte count differs from production registry."));
    if (!shippingFiles.has(asset.path)) findings.push(finding("RUNTIME_ASSET_OUTSIDE_SCOPE", asset.id, `${asset.path} is not in project_scope.shippingFiles.`));
    const filePath = path.join(rootDir, asset.path);
    if (!fs.existsSync(filePath)) findings.push(finding("RUNTIME_ASSET_FILE_MISSING", asset.id, `Missing ${asset.path}.`));
    else if (sha256(filePath) !== asset.sha256 || fs.statSync(filePath).size !== asset.bytes) findings.push(finding("RUNTIME_ASSET_FILE_DRIFT", asset.id, `File bytes or hash drifted for ${asset.path}.`));
  }
  const serialized = JSON.stringify(runtimeDoc);
  for (const forbidden of ["fangzhijianghu", "original-game", "reference-only", "research-only", "G:\\codex"]) {
    if (serialized.includes(forbidden)) findings.push(finding("RUNTIME_REFERENCE_LEAK", "runtime", `Runtime projection contains forbidden reference token: ${forbidden}.`));
  }
  for (const binding of runtimeDoc.bindings || []) {
    if (!binding.assetId && !binding.assetAttribute) findings.push(finding("RUNTIME_BINDING_INVALID", "bindings", "Every binding needs assetId or assetAttribute."));
    if (binding.assetId && !actualIds.has(binding.assetId)) findings.push(finding("RUNTIME_BINDING_UNKNOWN_ASSET", binding.assetId, "Binding references an unknown runtime asset."));
  }
  return { valid: findings.length === 0, findings, counts: { productionShippingAssets: shippingAssets.length, runtimeAssets: (runtimeDoc.assets || []).length } };
}

export function validateRuntimeAssetRegistrySchema(runtime = readJson(runtimePath)) {
  const schema = readJson(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const valid = validate(runtime);
  return { valid, errors: validate.errors || [] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const schemaResult = validateRuntimeAssetRegistrySchema();
  const result = validateWuxiaAssetRegistry();
  if (!schemaResult.valid) result.findings.push(...schemaResult.errors.map((error) => finding("RUNTIME_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed.")));
  console.log(JSON.stringify({ status: result.findings.length ? "FAIL" : "PASS", ...result, schema: schemaResult }, null, 2));
  if (result.findings.length) process.exitCode = 1;
}
