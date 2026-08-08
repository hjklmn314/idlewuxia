import assert from "node:assert/strict";
import fs from "node:fs";
import { validateCombatSceneAssetRequirements } from "./validate-wuxia-combat-scene-asset-requirements.mjs";

const manifest = JSON.parse(fs.readFileSync("config/wuxia_combat_scene_asset_requirements.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("config/wuxia_combat_presentation_contract.json", "utf8"));
const overlay = JSON.parse(fs.readFileSync("config/wuxia_combat_reference_asset_overlay.json", "utf8"));
const ok = validateCombatSceneAssetRequirements({ manifest, presentation, overlay });
assert.equal(ok.valid, true, JSON.stringify(ok.findings));
assert.equal(ok.status, "PASS WITH KNOWN LIMITATIONS");
assert.equal(ok.productionStatus, "blocked");
assert.equal(ok.counts.sceneRows, 2);
{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.scenes[0].status = "satisfied";
  const result = validateCombatSceneAssetRequirements({ manifest: broken, presentation, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_008_FALSE_SATISFACTION"));
}
{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.scenes[0].referenceAssetId = "ref-scene-unknown";
  const result = validateCombatSceneAssetRequirements({ manifest: broken, presentation, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_008_REFERENCE_UNKNOWN"));
}
console.log("ASSET-008 scene requirements tests: PASS (schema, reference binding and production negative paths)");
