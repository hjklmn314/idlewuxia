import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = "config/wuxia_combat_actor_asset_requirements.json";
const schemaFile = "config/wuxia_combat_actor_asset_requirements.schema.json";
const presentationFile = "config/wuxia_combat_presentation_contract.json";
const outputPath = path.join(root, "outputs", "production_os", "combat-actor-asset-requirements-validation.json");

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
const finding = (code, subject, message, severity = "P0") => ({ severity, code, subject, message });

export function validateCombatActorAssetRequirements({ rootDir = root, manifest, presentation } = {}) {
  const activeRoot = rootDir;
  const activeManifest = manifest || JSON.parse(fs.readFileSync(path.join(activeRoot, manifestFile), "utf8"));
  const activePresentation = presentation || JSON.parse(fs.readFileSync(path.join(activeRoot, presentationFile), "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(activeRoot, schemaFile), "utf8"));
  const findings = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(activeManifest)) for (const error of validate.errors || []) findings.push(finding("ASSET_007_SCHEMA_INVALID", error.instancePath || "/", error.message || "Schema validation failed."));

  const actorIds = new Set((activeManifest.actors || []).map((row) => row.id));
  if (actorIds.size !== 2 || !actorIds.has("player") || !actorIds.has("enemy")) findings.push(finding("ASSET_007_ACTOR_COVERAGE", "actors", "ASSET-007 must specify exactly the player and enemy logical actor rows."));
  const presentationActors = new Map((activePresentation.actors || []).map((row) => [row.id, row]));
  for (const row of activeManifest.actors || []) {
    const presentationRow = presentationActors.get(row.id);
    if (!presentationRow) findings.push(finding("ASSET_007_PRESENTATION_BINDING_MISSING", row.id, "Actor requirements must correspond to a combat presentation binding."));
    else if (presentationRow.logicalAssetId !== row.logicalAssetId) findings.push(finding("ASSET_007_LOGICAL_ID_DRIFT", row.id, "Actor logicalAssetId differs from the presentation contract."));
    if (row.status !== "missing") findings.push(finding("ASSET_007_FALSE_SATISFACTION", row.id, "This requirements-only manifest may not claim an actor asset is satisfied."));
    if ((row.referenceCandidates || []).length > 0) findings.push(finding("ASSET_007_REFERENCE_BINDING_PRESENT", row.id, "No reference actor candidate passed the audit; reference bytes must not be bound."));
    if (row.runtimeBinding?.fallbackScope !== "development-only") findings.push(finding("ASSET_007_FALLBACK_SCOPE", row.id, "The CSS actor fallback must remain development-only."));
  }
  if (activeManifest.shippingAllowed !== false || activeManifest.sourcePolicy?.referenceBytesMayShip !== false || activeManifest.sourcePolicy?.referenceBindingsMaySatisfyProduction !== false) findings.push(finding("ASSET_007_SHIPPING_POLICY", "sourcePolicy", "Reference bytes and bindings must be explicitly excluded from shipping."));
  if ((activeManifest.referenceAudit?.eligibleCandidates || []).length > 0) findings.push(finding("ASSET_007_UNVERIFIED_CANDIDATE", "referenceAudit.eligibleCandidates", "Candidates may not be marked eligible without ownership, hash, clip and manual evidence."));
  const status = findings.length === 0 ? "PASS WITH KNOWN LIMITATIONS" : "REVISE";
  return { valid: findings.length === 0, status, findings, taskId: activeManifest.taskId, productionStatus: activeManifest.acceptanceGate?.productionStatus, counts: { actorRows: activeManifest.actors?.length || 0, eligibleReferenceCandidates: activeManifest.referenceAudit?.eligibleCandidates?.length || 0, ineligibleEvidence: activeManifest.referenceAudit?.ineligibleEvidence?.length || 0 } };
}

function run() {
  const result = validateCombatActorAssetRequirements();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run();
