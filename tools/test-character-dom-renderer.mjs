import assert from "node:assert/strict";
import fs from "node:fs";

import { createCharacterComposer, createCharacterPartRegistry } from "../src/characterComposer.js";
import { CharacterDomRenderError, createCharacterDomRenderer } from "../src/characterDomRenderer.js";

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(key, value) { this.values.set(key, value); }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.attributes = new Map();
  }
  set className(value) { this._className = value; value.split(/\s+/).filter(Boolean).forEach((entry) => this.classList.add(entry)); }
  get className() { return this._className || ""; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  append(...nodes) { this.children.push(...nodes); }
  querySelectorAll(selector) {
    if (selector === "[data-wuxia-character-composition-id]") return this.hosts || [];
    return [];
  }
  contains(node) {
    if (node === this) return true;
    if (this.hosts?.includes(node)) return true;
    return this.children.some((child) => child.contains?.(node));
  }
}

const documentRef = { createElement: (tagName) => new FakeElement(tagName) };
const anchors = { origin: { x: 48, y: 88 }, head: { x: 48, y: 34 }, face: { x: 65, y: 37 }, "weapon-main": { x: 72, y: 61 }, "fx-center": { x: 48, y: 50 }, "ground-contact": { x: 48, y: 88 } };
const partTypes = ["body", "head-base", "eyes", "mouth", "hair"];
const clipsFor = (partType) => Object.fromEntries(["idle", "move", "attack", "hurt", "control", "defeat"].map((clipId) => {
  const frameCount = clipId === "move" ? 4 : 2;
  const frames = Array.from({ length: frameCount }, (_, index) => `${partType}-${clipId}-${index}`);
  return [clipId, {
    frameCount,
    fps: 8,
    playback: ["control", "defeat"].includes(clipId) ? "hold-last" : "loop",
    frames,
    bodyPhases: clipId === "move" ? ["neutral", "compress", "translate", "recover"] : frames.map(() => "neutral"),
  }];
}));
const parts = partTypes.map((partType) => {
  const clips = clipsFor(partType);
  const frames = Object.values(clips).flatMap((clip) => clip.frames);
  return {
    id: `part-${partType}`,
    partType,
    assetId: `asset-${partType}`,
    view: "side",
    canonicalFacing: "right",
    legSilhouette: "forbidden",
    canvas: { width: 96, height: 96 },
    atlas: { width: frames.length * 96, height: 96 },
    frameRegions: Object.fromEntries(frames.map((frame, index) => [frame, { x: index * 96, y: 0, width: 96, height: 96 }])),
    pivot: { x: 48, y: 88 },
    anchors,
    clips,
  };
});
const manifest = {
  registryId: "renderer-fixture",
  version: 2,
  requiredParts: partTypes,
  optionalParts: [],
  layerOrderBackToFront: partTypes,
  parts,
};
const assetRegistry = { resolve(assetId) { return { id: assetId, kind: "character-part", format: "png", path: `public/fixture/${assetId}.png` }; } };
const registry = createCharacterPartRegistry(manifest, { assetRegistry });
const composer = createCharacterComposer({
  registry,
  definitions: [{ id: "actor-fixture", parts: Object.fromEntries(partTypes.map((partType) => [partType, `part-${partType}`])), palette: { body: { primary: "#234765" } } }],
});

let clock = 0;
let nextHandle = 1;
const callbacks = new Map();
const schedule = (callback) => { const handle = nextHandle++; callbacks.set(handle, callback); return handle; };
const cancelSchedule = (handle) => callbacks.delete(handle);
const host = new FakeElement();
host.dataset.wuxiaCharacterCompositionId = "actor-fixture";
host.dataset.wuxiaCharacterClip = "move";
host.dataset.wuxiaCharacterFacing = "left";
host.dataset.wuxiaCharacterLabel = "fixture actor";
const root = new FakeElement();
root.hosts = [host];
const renderer = createCharacterDomRenderer({ composer, documentRef, now: () => clock, schedule, cancelSchedule, strict: true });
assert.equal(renderer.mount(root), 1);
assert.equal(host.classList.contains("has-modular-character"), true);
assert.equal(host.dataset.wuxiaCharacterRenderState, "mounted");
assert.equal(host.children.length, 1);
const stack = host.children[0];
assert.equal(stack.dataset.wuxiaCharacterMirror, "true");
assert.equal(stack.children.length, 5);
assert.equal(stack.children.every((layer) => layer.dataset.wuxiaCharacterFrameIndex === "0"), true);
assert.equal(stack.children[0].children[0].src, "public/fixture/asset-body.png");
clock = 260;
const [callbackHandle, callback] = callbacks.entries().next().value;
callbacks.delete(callbackHandle);
callback();
assert.equal(stack.dataset.wuxiaCharacterFrameIndex, "2");
assert.equal(stack.dataset.wuxiaCharacterBodyPhase, "translate");
assert.equal(stack.children.every((layer) => layer.dataset.wuxiaCharacterFrameIndex === "2"), true, "every layer must remain on the same frame");
assert.equal(stack.children[0].children[0].style.left, "-384px");
renderer.stop();
assert.equal(callbacks.size, 0);

{
  const badHost = new FakeElement();
  badHost.dataset.wuxiaCharacterCompositionId = "missing-composition";
  const badRoot = new FakeElement();
  badRoot.hosts = [badHost];
  const failures = [];
  const lenient = createCharacterDomRenderer({ composer, documentRef, schedule, cancelSchedule, onError: (error) => failures.push(error) });
  assert.equal(lenient.mount(badRoot), 0);
  assert.equal(badHost.dataset.wuxiaCharacterRenderState, "error");
  assert.equal(badHost.dataset.wuxiaCharacterRenderError, "CHARACTER_COMPOSITION_UNKNOWN_ID");
  assert.equal(failures.length, 1);
  const strict = createCharacterDomRenderer({ composer, documentRef, schedule, cancelSchedule, strict: true });
  assert.throws(() => strict.mount(badRoot), (error) => error.code === "CHARACTER_COMPOSITION_UNKNOWN_ID");
}

assert.throws(() => createCharacterDomRenderer({ composer, documentRef: {} }), (error) => error instanceof CharacterDomRenderError && error.code === "CHARACTER_DOM_DOCUMENT_INVALID");
const mainSource = fs.readFileSync("src/wuxia-main.js", "utf8");
const scope = JSON.parse(fs.readFileSync("config/project_scope.json", "utf8"));
const liveManifest = JSON.parse(fs.readFileSync("config/wuxia_character_compositions.json", "utf8"));
assert.match(mainSource, /visual\.compositionId/);
assert.match(mainSource, /characterDomRenderer\?\.mount\(stage\)/);
assert.match(mainSource, /status === "production-ready"/);
assert.equal(scope.shippingFiles.includes("src/characterDomRenderer.js"), true);
assert.equal(liveManifest.parts.length, 0);
assert.equal(liveManifest.compositions.length, 0);
assert.equal(liveManifest.shippingAllowed, false);
console.log("character DOM renderer tests: PASS (layer mount, atlas crop, mirror, frame sync, fail-closed paths)");
