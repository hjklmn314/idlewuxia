import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import { createAssetRegistry } from "../src/assetRegistry.js";
import { validateCharacterCompositionRuntime } from "../src/characterComposer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

export function validateWuxiaCharacterCompositions({ rootDir = root, manifest, schema, assetManifest } = {}) {
  const activeManifest = manifest || readJson(path.join(rootDir, "config", "wuxia_character_compositions.json"));
  const activeSchema = schema || readJson(path.join(rootDir, "config", "wuxia_character_compositions.schema.json"));
  const activeAssetManifest = assetManifest || readJson(path.join(rootDir, "config", "wuxia_runtime_asset_registry.json"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(activeSchema);
  const schemaValid = validate(activeManifest);
  const findings = (validate.errors || []).map((error) => ({ code: "CHARACTER_COMPOSITION_SCHEMA_INVALID", subject: error.instancePath || "/", message: error.message || "Schema validation failed." }));
  const parts = Array.isArray(activeManifest.parts) ? activeManifest.parts : [];
  const compositions = Array.isArray(activeManifest.compositions) ? activeManifest.compositions : [];
  if (schemaValid) {
    let assetRegistry = null;
    try {
      assetRegistry = createAssetRegistry(activeAssetManifest);
    } catch (error) {
      findings.push({ code: error.code || "CHARACTER_COMPOSITION_ASSET_REGISTRY_INVALID", subject: "assetRegistry", message: error.message });
    }
    if (assetRegistry) findings.push(...validateCharacterCompositionRuntime({ manifest: activeManifest, definitions: compositions, assetRegistry }).findings);
  }
  if (schemaValid && activeManifest.status === "requirements-ready-assets-missing" && (parts.length > 0 || compositions.length > 0 || activeManifest.shippingAllowed !== false)) findings.push({ code: "CHARACTER_COMPOSITION_FALSE_READINESS", subject: "status", message: "The requirements-only state must remain empty and non-shipping until approved part assets exist." });
  if (schemaValid && activeManifest.status !== "production-ready" && activeManifest.shippingAllowed !== false) findings.push({ code: "CHARACTER_COMPOSITION_NON_PRODUCTION_SHIPPING", subject: "shippingAllowed", message: "Only a production-ready modular character manifest may enable shipping." });
  if (schemaValid && activeManifest.status === "production-ready" && (parts.length === 0 || compositions.length === 0 || activeManifest.shippingAllowed !== true)) findings.push({ code: "CHARACTER_COMPOSITION_PRODUCTION_INCOMPLETE", subject: "status", message: "Production-ready requires approved parts, compositions and shippingAllowed=true." });
  return { valid: findings.length === 0, status: findings.length ? "REVISE" : activeManifest.status === "production-ready" ? "PASS" : "PASS WITH KNOWN LIMITATIONS", findings, counts: { parts: parts.length, compositions: compositions.length } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateWuxiaCharacterCompositions();
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
