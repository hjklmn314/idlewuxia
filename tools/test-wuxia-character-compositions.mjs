import assert from "node:assert/strict";
import fs from "node:fs";

import { CharacterCompositionError, createCharacterComposer, createCharacterPartRegistry } from "../src/characterComposer.js";
import { validateWuxiaCharacterCompositions } from "./validate-wuxia-character-compositions.mjs";

const live = JSON.parse(fs.readFileSync("config/wuxia_character_compositions.json", "utf8"));
assert.equal(validateWuxiaCharacterCompositions({ manifest: live }).valid, true, "truthful requirements-only manifest must pass");
{
  const malformed = JSON.parse(JSON.stringify(live));
  delete malformed.parts;
  const result = validateWuxiaCharacterCompositions({ manifest: malformed });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "CHARACTER_COMPOSITION_SCHEMA_INVALID"));
}

const anchors = { origin: { x: 48, y: 88 }, head: { x: 48, y: 34 }, face: { x: 65, y: 37 }, "weapon-main": { x: 72, y: 61 }, "fx-center": { x: 48, y: 50 }, "ground-contact": { x: 48, y: 88 } };
const phaseSequence = (clipId, count) => clipId === "move"
  ? ["compress", "translate", "recover", "neutral"]
  : Array.from({ length: count }, () => "neutral");
const createClips = (partType) => Object.fromEntries([["idle", 4], ["move", 4], ["attack", 6], ["hurt", 4], ["control", 4], ["defeat", 6]].map(([id, count]) => [id, { frameCount: count, fps: 8, frames: Array.from({ length: count }, (_, index) => `${partType}-${id}-${index}`), bodyPhases: phaseSequence(id, count) }]));
const withPlayback = (clips) => Object.fromEntries(Object.entries(clips).map(([clipId, clip]) => [clipId, { ...clip, playback: ["defeat", "control"].includes(clipId) ? "hold-last" : "loop" }]));
const createPart = (partType) => {
  const clips = withPlayback(createClips(partType));
  const frames = [...new Set(Object.values(clips).flatMap((clip) => clip.frames))];
  return {
    id: `part-${partType}`,
    partType,
    assetId: `asset-${partType}`,
    view: "side",
    canonicalFacing: "right",
    legSilhouette: "forbidden",
    canvas: { width: 96, height: 96 },
    atlas: { width: 96 * frames.length, height: 96 },
    frameRegions: Object.fromEntries(frames.map((frame, index) => [frame, { x: 96 * index, y: 0, width: 96, height: 96 }])),
    pivot: { x: 48, y: 88 },
    anchors,
    clips,
  };
};
const parts = ["body", "head-base", "eyes", "mouth", "hair", "headwear"].map(createPart);
const manifest = { ...live, status: "development-ready", parts };
const assetRegistry = { resolve(assetId) { return { id: assetId, kind: "character-part", format: "png", path: `public/test/${assetId}.png` }; } };
const registry = createCharacterPartRegistry(manifest, { assetRegistry });
const assetManifest = {
  registryId: "character-test-assets",
  version: 1,
  assets: parts.map((part) => ({ id: part.assetId, kind: "character-part", format: "png", path: `public/test/${part.assetId}.png`, adoption: "ship", approval: "approved", sha256: "a".repeat(64), bytes: 1 })),
  bindings: [],
};
assert.equal(validateWuxiaCharacterCompositions({ manifest: { ...manifest, compositions: [{ id: "actor-probe", parts: { body: "part-body", "head-base": "part-head-base", eyes: "part-eyes", mouth: "part-mouth", hair: "part-hair", headwear: "part-headwear" }, palette: {} }] }, assetManifest }).valid, true, "approved AssetRegistry-backed modular composition must pass");
const definition = { id: "actor-probe", parts: { body: "part-body", "head-base": "part-head-base", eyes: "part-eyes", mouth: "part-mouth", hair: "part-hair", headwear: "part-headwear" }, palette: { body: { primary: "#234765" } } };
const composer = createCharacterComposer({ registry, definitions: [definition] });
const right = composer.compose("actor-probe", { clipId: "move", frameIndex: 2, facing: "right" });
const left = composer.compose("actor-probe", { clipId: "move", frameIndex: 2, facing: "left" });
assert.equal(right.layers.length, 6);
assert.deepEqual(right.layers.map((layer) => layer.partType), ["body", "head-base", "eyes", "mouth", "hair", "headwear"]);
assert.equal(right.layers.every((layer) => layer.frame.endsWith("-move-2") && layer.frameIndex === 2), true);
assert.equal(right.layers.every((layer) => layer.bodyPhase === "recover" && layer.source.region.width === 96 && layer.source.path.endsWith(`${layer.assetId}.png`)), true);
assert.equal(right.playback, "loop");
assert.equal(right.mirrorX, false);
assert.equal(left.mirrorX, true);
assert.deepEqual(right.layers.find((layer) => layer.partType === "body").palette, { primary: "#234765" });

assert.throws(() => createCharacterComposer({ registry, definitions: [{ ...definition, parts: { ...definition.parts, mouth: undefined } }] }), (error) => error instanceof CharacterCompositionError && error.code === "CHARACTER_COMPOSITION_REQUIRED_PART_MISSING");
{
  const drifted = JSON.parse(JSON.stringify(manifest));
  drifted.parts.find((part) => part.partType === "hair").clips.attack.fps = 9;
  const driftRegistry = createCharacterPartRegistry(drifted, { assetRegistry });
  assert.throws(() => createCharacterComposer({ registry: driftRegistry, definitions: [definition] }), (error) => error.code === "CHARACTER_PART_TIMELINE_DRIFT");
}
{
  const legs = JSON.parse(JSON.stringify(manifest));
  legs.parts[0].legSilhouette = "allowed";
  assert.throws(() => createCharacterPartRegistry(legs, { assetRegistry }), (error) => error.code === "CHARACTER_PART_LEG_SILHOUETTE");
}
{
  const missingPhase = JSON.parse(JSON.stringify(manifest));
  missingPhase.parts[0].clips.move.bodyPhases.pop();
  assert.throws(() => createCharacterPartRegistry(missingPhase, { assetRegistry }), (error) => error.code === "CHARACTER_PART_CLIP_PHASES_INVALID");
}
{
  const missingRegion = JSON.parse(JSON.stringify(manifest));
  delete missingRegion.parts[0].frameRegions[missingRegion.parts[0].clips.idle.frames[0]];
  assert.throws(() => createCharacterPartRegistry(missingRegion, { assetRegistry }), (error) => error.code === "CHARACTER_PART_FRAME_REGION_UNKNOWN");
}
{
  const overflowRegion = JSON.parse(JSON.stringify(manifest));
  const frameId = overflowRegion.parts[0].clips.idle.frames[0];
  overflowRegion.parts[0].frameRegions[frameId].x = overflowRegion.parts[0].atlas.width;
  assert.throws(() => createCharacterPartRegistry(overflowRegion, { assetRegistry }), (error) => error.code === "CHARACTER_PART_FRAME_REGION_INVALID");
}
{
  const missingPlayback = JSON.parse(JSON.stringify(manifest));
  delete missingPlayback.parts[0].clips.idle.playback;
  assert.throws(() => createCharacterPartRegistry(missingPlayback, { assetRegistry }), (error) => error.code === "CHARACTER_PART_CLIP_PLAYBACK_INVALID");
}
{
  assert.throws(() => createCharacterPartRegistry(manifest), (error) => error.code === "CHARACTER_PART_ASSET_REGISTRY_REQUIRED");
  assert.throws(() => createCharacterPartRegistry(manifest, { assetRegistry: { resolve() { return { kind: "brand-icon" }; } } }), (error) => error.code === "CHARACTER_PART_ASSET_KIND_INVALID");
}
{
  const wrong = JSON.parse(JSON.stringify(definition));
  wrong.parts.eyes = "part-hair";
  assert.throws(() => createCharacterComposer({ registry, definitions: [wrong] }), (error) => error.code === "CHARACTER_COMPOSITION_PART_TYPE_MISMATCH");
}
{
  const missingBytes = { ...live, status: "production-ready", shippingAllowed: true };
  const result = validateWuxiaCharacterCompositions({ manifest: missingBytes });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "CHARACTER_COMPOSITION_PRODUCTION_INCOMPLETE"));
}
{
  const falseDevelopmentShipping = { ...live, status: "development-ready", shippingAllowed: true };
  const result = validateWuxiaCharacterCompositions({ manifest: falseDevelopmentShipping });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "CHARACTER_COMPOSITION_NON_PRODUCTION_SHIPPING"));
}

console.log("modular character composition tests: PASS (layers, facing, frame parity, fail-closed negatives)");
