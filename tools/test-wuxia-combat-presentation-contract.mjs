import assert from "node:assert/strict";
import fs from "node:fs";
import { validateCombatPresentationContract } from "./validate-wuxia-combat-presentation-contract.mjs";

const contract = JSON.parse(fs.readFileSync("config/wuxia_combat_presentation_contract.json", "utf8"));
const combatContent = JSON.parse(fs.readFileSync("config/wuxia_combat_content.json", "utf8"));
const overlay = JSON.parse(fs.readFileSync("config/wuxia_combat_reference_asset_overlay.json", "utf8"));

{
  const result = validateCombatPresentationContract({ contract, combatContent, overlay });
  assert.equal(result.valid, true, JSON.stringify(result.findings));
  assert.equal(result.status, "PASS WITH KNOWN LIMITATIONS");
  assert.equal(result.counts.visualCueBindings, combatContent.visualCues.length);
  assert.equal(result.counts.audioCueBindings, combatContent.audioCues.length);
  assert.equal(result.counts.buffIconBindings, combatContent.buffs.length);
  assert.ok(result.counts.productionBlocked > 0, "missing production assets must remain visible");
}
{
  const broken = JSON.parse(JSON.stringify(contract));
  broken.vfx.pop();
  const result = validateCombatPresentationContract({ contract: broken, combatContent, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "COMBAT_PRESENTATION_VFX_COVERAGE_MISSING"));
}
{
  const broken = JSON.parse(JSON.stringify(contract));
  broken.audio[0].referenceAssetId = "ref-audio-does-not-exist";
  const result = validateCombatPresentationContract({ contract: broken, combatContent, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "COMBAT_PRESENTATION_REFERENCE_UNKNOWN"));
}
{
  const result = validateCombatPresentationContract({ contract, combatContent, overlay, strictProduction: true });
  assert.equal(result.valid, false);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.findings.some((item) => item.code === "COMBAT_PRESENTATION_PRODUCTION_ASSET_MISSING"));
  assert.ok(result.findings.some((item) => item.code === "COMBAT_PRESENTATION_SYNTH_AUDIO_CONFIGURED"));
}
{
  const broken = JSON.parse(JSON.stringify(contract));
  broken.requirements.find((row) => row.taskId === "ASSET-007").mustProvide = ["idle", "attack"];
  const result = validateCombatPresentationContract({ contract: broken, combatContent, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "COMBAT_PRESENTATION_MODULAR_ACTOR_REQUIREMENT"));
}
console.log("combat presentation contract tests: PASS (coverage, reference provenance, strict production blocking)");
