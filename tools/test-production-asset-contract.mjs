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
  const anchors = {
    origin: { x: 48, y: 88 },
    head: { x: 48, y: 35 },
    face: { x: 68, y: 37 },
    "weapon-main": { x: 70, y: 61 },
    "fx-center": { x: 48, y: 50 },
    "ground-contact": { x: 48, y: 88 },
  };
  const clipFrames = {
    idle: { frameCount: 4, fps: 8, bodyPhases: ["neutral", "neutral", "neutral", "neutral"] },
    move: { frameCount: 4, fps: 8, bodyPhases: ["neutral", "compress", "translate", "recover"] },
    attack: { frameCount: 6, fps: 8, bodyPhases: ["neutral", "compress", "translate", "translate", "recover", "neutral"] },
    hurt: { frameCount: 4, fps: 8, bodyPhases: ["neutral", "compress", "translate", "recover"] },
    control: { frameCount: 4, fps: 8, bodyPhases: ["neutral", "compress", "compress", "neutral"] },
    defeat: { frameCount: 6, fps: 8, bodyPhases: ["neutral", "compress", "translate", "translate", "recover", "recover"] },
  };
  const base = {
    slotId: "combat-side-view-character-sprites",
    kind: "character",
    source: { path: "public/wuxia-brand/icon.svg", provenance: "project-owned", owner: "fixture", licenseStatus: "approved" },
    format: "png",
    sha256: liveContract.assets[0].sha256,
    bytes: 616,
    budgetBytes: 10000,
    dimensions: { width: 96, height: 96 },
    pivot: { x: 0.5, y: 1 },
    alphaPolicy: "preserve",
    containsBakedCharacters: false,
    runtimeMountPoints: ["combat.actor"],
    fallbackPolicy: "none",
    view: "side",
    anchors,
    clipFrames,
  };
  for (const part of ["body", "head-base", "eyes", "mouth", "hair"]) contract.assets.push({ ...clone(base), assetId: `fixture-character-${part}`, characterPart: part });
  return contract;
}

function validateCharacterFixture(contract) {
  const productionRegistry = clone(liveProduction);
  for (const asset of contract.assets.filter((row) => row.assetId.startsWith("fixture-character-"))) {
    productionRegistry.assets.push({
      id: asset.assetId,
      kind: "character-part",
      provenance: "project-owned",
      licenseStatus: "approved",
      adoption: "ship",
      shippingPath: asset.source.path,
      sha256: asset.sha256,
      bytes: asset.bytes,
      consumers: ["test-only"],
    });
  }
  return validateProductionAssetContract({ contract, productionRegistry });
}

assert.equal(validateCharacterFixture(characterFixture()).valid, true, "complete modular character family must pass");

{
  const contract = characterFixture();
  const headwear = clone(contract.assets.find((asset) => asset.characterPart === "hair"));
  headwear.assetId = "fixture-character-headwear";
  headwear.characterPart = "headwear";
  contract.assets.push(headwear);
  assert.equal(validateCharacterFixture(contract).valid, true, "configured optional character layers must pass without becoming required coverage");
}

{
  const contract = characterFixture();
  contract.assets.find((asset) => asset.characterPart === "body").view = "front";
  assert.ok(validateCharacterFixture(contract).findings.some((item) => ["ASSET_CONTRACT_CHARACTER_VIEW_INVALID", "ASSET_CONTRACT_SCHEMA_INVALID"].includes(item.code)), "front-view characters must fail");
}
{
  const contract = characterFixture();
  contract.slotContracts.find((slot) => slot.slotId === "combat-side-view-character-sprites").rules.legSilhouette = "not-applicable";
  assert.ok(validateCharacterFixture(contract).findings.some((item) => ["ASSET_CONTRACT_SCHEMA_INVALID", "ASSET_CONTRACT_LEG_SILHOUETTE"].includes(item.code)), "visible leg silhouettes must fail");
}
{
  const contract = characterFixture();
  contract.assets.find((asset) => asset.characterPart === "body").containsBakedCharacters = true;
  assert.ok(validateCharacterFixture(contract).findings.some((item) => item.code === "ASSET_CONTRACT_BAKED_CHARACTER"), "baked characters must fail");
}
{
  const contract = characterFixture();
  delete contract.assets.find((asset) => asset.characterPart === "body").clipFrames.attack;
  assert.ok(validateCharacterFixture(contract).findings.some((item) => item.code === "ASSET_CONTRACT_CLIP_MISSING"), "missing animation clips must fail");
}
{
  const contract = characterFixture();
  contract.assets.find((asset) => asset.characterPart === "body").clipFrames.move.bodyPhases = ["neutral", "translate", "translate", "recover"];
  assert.ok(validateCharacterFixture(contract).findings.some((item) => item.code === "ASSET_CONTRACT_BODY_MOVEMENT_PHASES"), "movement without a body compression phase must fail");
}
{
  const contract = characterFixture();
  contract.assets = contract.assets.filter((asset) => asset.characterPart !== "hair");
  assert.ok(validateCharacterFixture(contract).findings.some((item) => item.code === "ASSET_CONTRACT_CHARACTER_PART_COVERAGE"), "missing required character part family must fail");
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
    characterPart: "not-applicable",
    anchors: {},
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
