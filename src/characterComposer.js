const REQUIRED_PARTS = Object.freeze(["body", "head-base", "eyes", "mouth", "hair"]);
const DEFAULT_LAYER_ORDER = Object.freeze(["contact-shadow", "weapon-rear", ...REQUIRED_PARTS, "headwear", "face-accessory", "weapon-front"]);
const REQUIRED_ANCHORS = Object.freeze(["origin", "head", "face", "weapon-main", "fx-center", "ground-contact"]);

export class CharacterCompositionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CharacterCompositionError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CharacterCompositionError(code, message, details);
}

function objectEntries(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function timelineSignature(part) {
  return JSON.stringify(canonical({
    canvas: part.canvas,
    pivot: part.pivot,
    anchors: part.anchors,
    clips: Object.fromEntries(objectEntries(part.clips).map(([clipId, clip]) => [clipId, {
      frameCount: clip.frameCount,
      fps: clip.fps,
      playback: clip.playback,
      bodyPhases: clip.bodyPhases,
    }])),
  }));
}

function assertPartRecord(part, allowedPartTypes, asset) {
  if (!part || typeof part.id !== "string" || !part.id) fail("CHARACTER_PART_ID_INVALID", "Every modular character part requires a logical id.");
  if (!allowedPartTypes.has(part.partType)) fail("CHARACTER_PART_TYPE_INVALID", `Unknown modular character part type: ${part.partType || "missing"}.`, { partId: part.id });
  if (part.view !== "side" || part.canonicalFacing !== "right") fail("CHARACTER_PART_VIEW_INVALID", `Character part must use the canonical right-facing side view: ${part.id}.`, { partId: part.id });
  if (part.legSilhouette !== "forbidden") fail("CHARACTER_PART_LEG_SILHOUETTE", `Character part may not expose an independent leg silhouette: ${part.id}.`, { partId: part.id });
  if (part.canvas?.width !== 96 || part.canvas?.height !== 96) fail("CHARACTER_PART_CANVAS_INVALID", `Character part must use the 96x96 logical canvas: ${part.id}.`, { partId: part.id });
  if (!part.pivot || !Number.isInteger(part.pivot.x) || !Number.isInteger(part.pivot.y)) fail("CHARACTER_PART_PIVOT_INVALID", `Character part pivot must use integer pixels: ${part.id}.`, { partId: part.id });
  if (!part.atlas || !Number.isInteger(part.atlas.width) || part.atlas.width < 96 || !Number.isInteger(part.atlas.height) || part.atlas.height < 96) fail("CHARACTER_PART_ATLAS_INVALID", `Character part ${part.id} requires integer atlas dimensions of at least 96x96.`, { partId: part.id });
  if (!part.frameRegions || typeof part.frameRegions !== "object" || Array.isArray(part.frameRegions)) fail("CHARACTER_PART_FRAME_REGIONS_MISSING", `Character part ${part.id} requires frameRegions.`, { partId: part.id });
  if (!asset || !["png", "webp"].includes(asset.format) || typeof asset.path !== "string" || !asset.path) fail("CHARACTER_PART_RENDER_ASSET_INVALID", `Character part ${part.id} requires an approved PNG or WebP atlas.`, { partId: part.id, assetId: part.assetId, format: asset?.format || "missing" });
  for (const anchor of REQUIRED_ANCHORS) if (!part.anchors?.[anchor]) fail("CHARACTER_PART_ANCHOR_MISSING", `Character part ${part.id} is missing anchor ${anchor}.`, { partId: part.id, anchor });
  if (!part.clips || objectEntries(part.clips).length === 0) fail("CHARACTER_PART_CLIPS_MISSING", `Character part has no animation clips: ${part.id}.`, { partId: part.id });
  for (const [clipId, clip] of objectEntries(part.clips)) {
    if (!Number.isInteger(clip.frameCount) || clip.frameCount < 1 || !Number.isFinite(clip.fps) || clip.fps <= 0) fail("CHARACTER_PART_CLIP_INVALID", `Character part ${part.id} has an invalid clip: ${clipId}.`, { partId: part.id, clipId });
    if (!["loop", "hold-last"].includes(clip.playback)) fail("CHARACTER_PART_CLIP_PLAYBACK_INVALID", `Character part ${part.id} clip ${clipId} requires loop or hold-last playback.`, { partId: part.id, clipId, playback: clip.playback });
    if (!Array.isArray(clip.frames) || clip.frames.length !== clip.frameCount) fail("CHARACTER_PART_CLIP_FRAMES_INVALID", `Character part ${part.id} clip ${clipId} must provide exactly frameCount frames.`, { partId: part.id, clipId });
    if (!Array.isArray(clip.bodyPhases) || clip.bodyPhases.length !== clip.frameCount) fail("CHARACTER_PART_CLIP_PHASES_INVALID", `Character part ${part.id} clip ${clipId} must provide one body phase per frame.`, { partId: part.id, clipId });
    for (const phase of clip.bodyPhases) if (!["neutral", "compress", "translate", "recover"].includes(phase)) fail("CHARACTER_PART_CLIP_PHASE_INVALID", `Character part ${part.id} clip ${clipId} contains unsupported body phase ${phase}.`, { partId: part.id, clipId, phase });
    for (const frameId of clip.frames) {
      const region = part.frameRegions[frameId];
      if (!region) fail("CHARACTER_PART_FRAME_REGION_UNKNOWN", `Character part ${part.id} clip ${clipId} references unknown frame region ${frameId}.`, { partId: part.id, clipId, frameId });
      if (![region.x, region.y, region.width, region.height].every(Number.isInteger) || region.x < 0 || region.y < 0 || region.width !== 96 || region.height !== 96 || region.x + region.width > part.atlas.width || region.y + region.height > part.atlas.height) {
        fail("CHARACTER_PART_FRAME_REGION_INVALID", `Character part ${part.id} frame region ${frameId} must be a 96x96 integer cell inside the atlas.`, { partId: part.id, frameId, region, atlas: part.atlas });
      }
    }
  }
}

export function createCharacterPartRegistry(manifest, { assetRegistry = null } = {}) {
  if (!manifest || typeof manifest !== "object") fail("CHARACTER_PART_REGISTRY_MISSING", "Modular character part registry is missing.");
  const requiredPartTypes = Array.isArray(manifest.requiredParts) ? manifest.requiredParts : REQUIRED_PARTS;
  const optionalPartTypes = Array.isArray(manifest.optionalParts) ? manifest.optionalParts : [];
  if (REQUIRED_PARTS.some((part) => !requiredPartTypes.includes(part))) fail("CHARACTER_REQUIRED_PART_POLICY_INVALID", "Part registry must require body, head-base, eyes, mouth and hair.");
  const layerOrder = Array.isArray(manifest.layerOrderBackToFront) ? manifest.layerOrderBackToFront : DEFAULT_LAYER_ORDER;
  const allowedPartTypes = new Set([...requiredPartTypes, ...optionalPartTypes]);
  for (const partType of allowedPartTypes) if (!layerOrder.includes(partType)) fail("CHARACTER_LAYER_ORDER_INCOMPLETE", `Layer order is missing part type ${partType}.`, { partType });

  const parts = new Map();
  for (const part of manifest.parts || []) {
    if (parts.has(part.id)) fail("CHARACTER_PART_DUPLICATE_ID", `Duplicate modular character part id: ${part.id}.`, { partId: part.id });
    if (!assetRegistry?.resolve) fail("CHARACTER_PART_ASSET_REGISTRY_REQUIRED", `Character part ${part.id} cannot activate without the approved runtime AssetRegistry.`, { partId: part.id, assetId: part.assetId });
    let asset;
    try {
      asset = assetRegistry.resolve(part.assetId);
    } catch (error) {
      fail("CHARACTER_PART_ASSET_UNKNOWN", `Character part ${part.id} references unknown approved asset ${part.assetId}.`, { partId: part.id, assetId: part.assetId, cause: error?.code || error?.message || "unknown" });
    }
    if (!["character-part", "character"].includes(asset?.kind)) fail("CHARACTER_PART_ASSET_KIND_INVALID", `Character part ${part.id} must resolve to a character-part asset.`, { partId: part.id, assetId: part.assetId, kind: asset?.kind || "missing" });
    assertPartRecord(part, allowedPartTypes, asset);
    parts.set(part.id, Object.freeze(canonical({
      ...part,
      sourceAsset: {
        id: asset.id || part.assetId,
        path: asset.path,
        format: asset.format,
      },
    })));
  }

  return Object.freeze({
    registryId: manifest.registryId || "",
    version: manifest.version || 1,
    requiredPartTypes: Object.freeze([...requiredPartTypes]),
    optionalPartTypes: Object.freeze([...optionalPartTypes]),
    layerOrder: Object.freeze([...layerOrder]),
    resolve(partId) {
      const part = parts.get(partId);
      if (!part) fail("CHARACTER_PART_UNKNOWN_ID", `Unknown modular character part id: ${partId}.`, { partId });
      return part;
    },
    list() {
      return [...parts.values()];
    },
  });
}

function assertCompatibleParts(parts) {
  const expected = timelineSignature(parts[0]);
  for (const part of parts.slice(1)) if (timelineSignature(part) !== expected) fail("CHARACTER_PART_TIMELINE_DRIFT", `Part ${part.id} does not share the canvas, pivot, anchors and animation timeline.`, { partId: part.id });
}

function resolveFrame(part, clipId, frameIndex) {
  const clip = part.clips[clipId];
  if (!clip) fail("CHARACTER_CLIP_UNKNOWN", `Part ${part.id} does not provide clip ${clipId}.`, { partId: part.id, clipId });
  const normalizedIndex = ((Number(frameIndex) || 0) % clip.frameCount + clip.frameCount) % clip.frameCount;
  return { clip, frameIndex: normalizedIndex, frame: clip.frames[normalizedIndex] };
}

export function createCharacterComposer({ registry, definitions = [] } = {}) {
  if (!registry?.resolve || !Array.isArray(registry.requiredPartTypes)) fail("CHARACTER_COMPOSER_REGISTRY_INVALID", "CharacterComposer requires a character part registry.");
  const compositions = new Map();
  for (const definition of definitions) {
    if (!definition || typeof definition.id !== "string" || !definition.id) fail("CHARACTER_COMPOSITION_ID_INVALID", "Every composition requires an id.");
    if (compositions.has(definition.id)) fail("CHARACTER_COMPOSITION_DUPLICATE_ID", `Duplicate character composition id: ${definition.id}.`, { compositionId: definition.id });
    const selectedIds = definition.parts || {};
    for (const partType of registry.requiredPartTypes) if (!selectedIds[partType]) fail("CHARACTER_COMPOSITION_REQUIRED_PART_MISSING", `Composition ${definition.id} is missing required part ${partType}.`, { compositionId: definition.id, partType });
    const selectedParts = registry.layerOrder.filter((partType) => selectedIds[partType]).map((partType) => {
      const part = registry.resolve(selectedIds[partType]);
      if (part.partType !== partType) fail("CHARACTER_COMPOSITION_PART_TYPE_MISMATCH", `Composition ${definition.id} assigns ${part.id} to ${partType}.`, { compositionId: definition.id, partId: part.id, expected: partType, actual: part.partType });
      return part;
    });
    assertCompatibleParts(selectedParts);
    compositions.set(definition.id, Object.freeze({ ...canonical(definition), selectedParts: Object.freeze(selectedParts) }));
  }

  return Object.freeze({
    list() {
      return [...compositions.values()].map(({ selectedParts, ...definition }) => definition);
    },
    compose(compositionId, { clipId = "idle", frameIndex = 0, facing = "right" } = {}) {
      const composition = compositions.get(compositionId);
      if (!composition) fail("CHARACTER_COMPOSITION_UNKNOWN_ID", `Unknown character composition id: ${compositionId}.`, { compositionId });
      if (!new Set(["right", "left"]).has(facing)) fail("CHARACTER_FACING_INVALID", `Unsupported character facing: ${facing}.`, { facing });
      const layers = composition.selectedParts.map((part) => {
        const resolved = resolveFrame(part, clipId, frameIndex);
        const region = part.frameRegions[resolved.frame];
        return Object.freeze({
          partType: part.partType,
          partId: part.id,
          assetId: part.assetId,
          frame: resolved.frame,
          frameIndex: resolved.frameIndex,
          frameCount: resolved.clip.frameCount,
          fps: resolved.clip.fps,
          playback: resolved.clip.playback,
          bodyPhase: resolved.clip.bodyPhases[resolved.frameIndex],
          pivot: part.pivot,
          anchors: part.anchors,
          palette: composition.palette?.[part.partType] || {},
          source: Object.freeze({
            path: part.sourceAsset.path,
            format: part.sourceAsset.format,
            atlas: part.atlas,
            region,
          }),
        });
      });
      const first = composition.selectedParts[0];
      return Object.freeze({
        compositionId,
        facing,
        mirrorX: facing === "left",
        clipId,
        frameIndex: layers[0]?.frameIndex || 0,
        frameCount: layers[0]?.frameCount || 0,
        fps: layers[0]?.fps || 0,
        playback: layers[0]?.playback || "loop",
        bodyPhase: layers[0]?.bodyPhase || "neutral",
        canvas: first.canvas,
        pivot: first.pivot,
        anchors: first.anchors,
        layers: Object.freeze(layers),
      });
    },
  });
}

export function validateCharacterCompositionRuntime({ manifest, definitions = [], assetRegistry = null } = {}) {
  try {
    const registry = createCharacterPartRegistry(manifest, { assetRegistry });
    createCharacterComposer({ registry, definitions });
    return { valid: true, findings: [], counts: { parts: registry.list().length, compositions: definitions.length } };
  } catch (error) {
    return { valid: false, findings: [{ code: error.code || "CHARACTER_COMPOSITION_INVALID", message: error.message, details: error.details || {} }], counts: { parts: manifest?.parts?.length || 0, compositions: definitions.length } };
  }
}
