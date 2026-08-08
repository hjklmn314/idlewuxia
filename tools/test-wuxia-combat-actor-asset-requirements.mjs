import assert from "node:assert/strict";
import fs from "node:fs";
import { validateCombatActorAssetRequirements } from "./validate-wuxia-combat-actor-asset-requirements.mjs";

const manifest = JSON.parse(fs.readFileSync("config/wuxia_combat_actor_asset_requirements.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("config/wuxia_combat_presentation_contract.json", "utf8"));

{
  const result = validateCombatActorAssetRequirements({ manifest, presentation });
  assert.equal(result.valid, true, JSON.stringify(result.findings));
  assert.equal(result.status, "PASS WITH KNOWN LIMITATIONS");
  assert.equal(result.productionStatus, "blocked");
  assert.equal(result.counts.actorRows, 2);
  assert.equal(result.counts.eligibleReferenceCandidates, 0);
}
{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.actors[0].status = "satisfied";
  const result = validateCombatActorAssetRequirements({ manifest: broken, presentation });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_007_FALSE_SATISFACTION"));
}
{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.sourcePolicy.referenceBytesMayShip = true;
  const result = validateCombatActorAssetRequirements({ manifest: broken, presentation });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_007_SHIPPING_POLICY"));
}
console.log("ASSET-007 actor requirements tests: PASS (schema, truthful missing state, reference/shipping negative paths)");
