import assert from "node:assert/strict";

import { clone, validateProductionAssetContract } from "./validate-production-asset-contract.mjs";
import { validateVisualStandard } from "./validate-visual-standard.mjs";

const liveContract = (await import("../config/production/asset_contract.json", { with: { type: "json" } })).default;
const liveProduction = (await import("../config/production/asset_registry.json", { with: { type: "json" } })).default;
const liveVisual = (await import("../config/production/visual_standard.json", { with: { type: "json" } })).default;
const liveUi = (await import("../config/production/ui_experience_registry.json", { with: { type: "json" } })).default;
const liveCombat = (await import("../config/wuxia_combat_content.json", { with: { type: "json" } })).default;

assert.equal(validateProductionAssetContract({ contract: liveContract, productionRegistry: liveProduction }).valid, true, "live asset contract must pass");
assert.equal(validateVisualStandard({ standard: liveVisual, uiExperience: liveUi }).valid, true, "live visual standard must pass");

function characterFixture() {
  const contract = clone(liveContract);
  contract.assets.push({
    assetId: "fixture-character",
    slotId: "combat-side-view-character-sprites",
    kind: "character",
    source: { path: "public/wuxia-brand/icon.svg", provenance: "project-owned", owner: "fixture", licenseStatus: "approved" },
    format: "png",
    sha256: liveContract.assets[0].sha256,
    bytes: 616,
    budgetBytes: 10000,
    dimensions: { width: 64, height: 192 },
    pivot: { x: 0.5, y: 1 },
    alphaPolicy: "preserve",
    containsBakedCharacters: false,
    runtimeMountPoints: ["combat.actor"],
    fallbackPolicy: "none",
    view: "side",
    headCount: 3,
    clipFrames: {
      idle: { frameCount: 2, fps: 8, footPhases: ["neutral", "neutral"] },
      walk_left: { frameCount: 2, fps: 8, footPhases: ["left", "right"] },
      walk_right: { frameCount: 2, fps: 8, footPhases: ["right", "left"] },
      attack: { frameCount: 2, fps: 8, footPhases: ["neutral", "neutral"] },
      hurt: { frameCount: 2, fps: 8, footPhases: ["neutral", "neutral"] },
      control: { frameCount: 2, fps: 8, footPhases: ["neutral", "neutral"] },
      defeat: { frameCount: 2, fps: 8, footPhases: ["neutral", "neutral"] },
    },
  });
  return contract;
}

{
  const contract = characterFixture();
  contract.assets[1].view = "front";
  assert.ok(validateProductionAssetContract({ contract, productionRegistry: liveProduction }).findings.some((item) => ["ASSET_CONTRACT_CHARACTER_VIEW_INVALID", "ASSET_CONTRACT_SCHEMA_INVALID"].includes(item.code)), "front-view characters must fail");
}
{
  const contract = characterFixture();
  contract.assets[1].headCount = 7;
  assert.ok(validateProductionAssetContract({ contract, productionRegistry: liveProduction }).findings.some((item) => item.code === "ASSET_CONTRACT_HEAD_PROPORTION_INVALID"), "wrong head proportion must fail");
}
{
  const contract = characterFixture();
  contract.assets[1].containsBakedCharacters = true;
  assert.ok(validateProductionAssetContract({ contract, productionRegistry: liveProduction }).findings.some((item) => item.code === "ASSET_CONTRACT_BAKED_CHARACTER"), "baked characters must fail");
}
{
  const contract = characterFixture();
  delete contract.assets[1].clipFrames.attack;
  assert.ok(validateProductionAssetContract({ contract, productionRegistry: liveProduction }).findings.some((item) => item.code === "ASSET_CONTRACT_CLIP_MISSING"), "missing animation clips must fail");
}
{
  const contract = characterFixture();
  contract.assets[1].clipFrames.walk_left.footPhases = ["left", "left"];
  assert.ok(validateProductionAssetContract({ contract, productionRegistry: liveProduction }).findings.some((item) => item.code === "ASSET_CONTRACT_WALK_FEET_NOT_ALTERNATING"), "non-alternating walk phases must fail");
}
{
  const contract = clone(liveContract);
  contract.assets.push({
    ...clone(liveContract.assets[0]),
    assetId: "fixture-audio",
    slotId: "combat-sfx-and-music-family",
    kind: "audio",
    format: "ogg",
    runtimeMountPoints: ["combat.audio"],
    fallbackPolicy: "explicit-configured-only",
  });
  assert.ok(validateProductionAssetContract({ contract, productionRegistry: liveProduction }).findings.some((item) => item.code === "ASSET_CONTRACT_AUDIO_FALLBACK"), "audio fallback must fail");
}
{
  const standard = clone(liveVisual);
  standard.portrait.touchTargetMinDp = 32;
  assert.equal(validateVisualStandard({ standard, uiExperience: liveUi }).valid, false, "touch target below 44dp must fail schema validation");
}
{
  const combat = clone(liveCombat);
  combat.assetBindings.scene_fb01_wuguan_courtyard.fallback = "silent-placeholder";
  const result = validateProductionAssetContract({ contract: liveContract, productionRegistry: liveProduction, combatContent: combat, requireSatisfiedSlots: true });
  assert.ok(result.findings.some((item) => item.code === "ASSET_CONTRACT_COMBAT_FALLBACK"), "production combat fallback must fail strict validation");
  assert.ok(result.findings.some((item) => item.code === "ASSET_CONTRACT_SYNTH_AUDIO"), "production synth audio must fail strict validation");
}

console.log("production asset and visual contract tests: PASS (10 cases)");
