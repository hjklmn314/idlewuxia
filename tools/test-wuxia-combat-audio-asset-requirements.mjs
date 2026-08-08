import assert from "node:assert/strict";
import fs from "node:fs";
import { validateCombatAudioAssetRequirements } from "./validate-wuxia-combat-audio-asset-requirements.mjs";

const manifest = JSON.parse(fs.readFileSync("config/wuxia_combat_audio_asset_requirements.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("config/wuxia_combat_presentation_contract.json", "utf8"));
const content = JSON.parse(fs.readFileSync("config/wuxia_combat_content.json", "utf8"));
const overlay = JSON.parse(fs.readFileSync("config/wuxia_combat_reference_asset_overlay.json", "utf8"));

const ok = validateCombatAudioAssetRequirements({ manifest, presentation, content, overlay });
assert.equal(ok.valid, true, JSON.stringify(ok.findings));
assert.equal(ok.status, "PASS WITH KNOWN LIMITATIONS");
assert.equal(ok.productionStatus, "blocked");
assert.equal(ok.counts.audioCueRows, 5);
assert.equal(ok.counts.referenceOnlyAudioCues, 5);
assert.equal(ok.counts.productionEligibleReferenceCandidates, 0);
assert.equal(ok.counts.auditedReferenceCandidates, 4);

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.audioCues[0].referenceAssetId = "ref-audio-unknown";
  const result = validateCombatAudioAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_010_REFERENCE_DRIFT" || item.code === "ASSET_010_REFERENCE_UNKNOWN" || item.code === "ASSET_010_SCHEMA_INVALID"));
}

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.audioCues[0].status = "satisfied";
  const result = validateCombatAudioAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_010_FALSE_SATISFACTION" || item.code === "ASSET_010_SCHEMA_INVALID"));
}

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.policy.productionFormat = "mp3";
  const result = validateCombatAudioAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_010_PRODUCTION_FORMAT_POLICY" || item.code === "ASSET_010_SCHEMA_INVALID"));
}

{
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.referenceAudit.productionEligibleCandidates.push({ referenceAssetId: "ref-audio-hit" });
  const result = validateCombatAudioAssetRequirements({ manifest: broken, presentation, content, overlay });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.code === "ASSET_010_PRODUCTION_REFERENCE_ELIGIBLE" || item.code === "ASSET_010_SCHEMA_INVALID"));
}

console.log("ASSET-010 audio requirements tests: PASS (schema, cue coverage, overlay parity and negative paths)");
