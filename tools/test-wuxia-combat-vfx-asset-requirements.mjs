import assert from "node:assert/strict";
import fs from "node:fs";
import { validateCombatVfxAssetRequirements } from "./validate-wuxia-combat-vfx-asset-requirements.mjs";

const manifest = JSON.parse(fs.readFileSync("config/wuxia_combat_vfx_asset_requirements.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("config/wuxia_combat_presentation_contract.json", "utf8"));
const content = JSON.parse(fs.readFileSync("config/wuxia_combat_content.json", "utf8"));
const overlay = JSON.parse(fs.readFileSync("config/wuxia_combat_reference_asset_overlay.json", "utf8"));

const ok = validateCombatVfxAssetRequirements({ manifest, presentation, content, overlay });
assert.equal(ok.valid, true, JSON.stringify(ok.findings));
assert.equal(ok.status, "PASS WITH KNOWN LIMITATIONS");
assert.equal(ok.productionStatus, "blocked");
assert.equal(ok.counts.visualCueRows, 28);
assert.equal(ok.counts.missingVisualCues, 28);
assert.equal(ok.counts.buffIconRows, 16);
assert.equal(ok.counts.referenceOnlyBuffIcons, 16);
assert.equal(ok.counts.eligibleVfxCandidates, 0);
assert.equal(ok.counts.eligibleBuffCandidates, 6);

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.visualCues[0].id = "cue_unknown";
  const result = validateCombatVfxAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_009_PRESENTATION_CUE_UNKNOWN"));
}

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.buffIcons[0].status = "satisfied";
  const result = validateCombatVfxAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_009_BUFF_FALSE_SATISFACTION" || item.code === "ASSET_009_SCHEMA_INVALID"));
}

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.buffIcons[0].referenceAssetId = "ref-buff-unknown";
  const result = validateCombatVfxAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_009_BUFF_REFERENCE_DRIFT" || item.code === "ASSET_009_BUFF_REFERENCE_UNKNOWN"));
}

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.policy.runtimeBindingPolicy.fallbackScope = "production";
  const result = validateCombatVfxAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_009_SCHEMA_INVALID" || item.code === "ASSET_009_RUNTIME_BINDING_POLICY"));
}

console.log("ASSET-009 VFX/Buff requirements tests: PASS (schema, cue coverage, reference binding and negative paths)");
