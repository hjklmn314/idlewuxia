const DEFAULT_DOCUMENT = typeof document === "undefined" ? null : document;

export class CharacterDomRenderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CharacterDomRenderError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CharacterDomRenderError(code, message, details);
}

function requireDocument(documentRef) {
  if (!documentRef || typeof documentRef.createElement !== "function") {
    fail("CHARACTER_DOM_DOCUMENT_INVALID", "Character DOM renderer requires a document-like createElement API.");
  }
  return documentRef;
}

function setPaletteVariables(node, palette = {}) {
  for (const [channel, color] of Object.entries(palette)) {
    if (!/^[a-z][a-z0-9-]*$/.test(channel) || !/^#[a-fA-F0-9]{6}$/.test(color)) continue;
    node.style.setProperty(`--wuxia-character-${channel}`, color);
  }
}

function applyLayerPlan(layerNode, imageNode, layer) {
  const { atlas, region, path } = layer.source || {};
  if (!atlas || !region || typeof path !== "string" || !path) {
    fail("CHARACTER_DOM_LAYER_SOURCE_INVALID", `Character layer ${layer.partId || "unknown"} has no renderable atlas source.`, { partId: layer.partId });
  }
  layerNode.dataset.wuxiaCharacterFrame = layer.frame;
  layerNode.dataset.wuxiaCharacterFrameIndex = String(layer.frameIndex);
  layerNode.dataset.wuxiaCharacterBodyPhase = layer.bodyPhase;
  setPaletteVariables(layerNode, layer.palette);
  imageNode.src = path;
  imageNode.style.width = `${atlas.width}px`;
  imageNode.style.height = `${atlas.height}px`;
  imageNode.style.left = `${-region.x}px`;
  imageNode.style.top = `${-region.y}px`;
}

function createLayerNode(documentRef, layer) {
  const node = documentRef.createElement("span");
  node.className = "wuxia-character-layer";
  node.dataset.wuxiaCharacterPart = layer.partType;
  node.dataset.wuxiaCharacterPartId = layer.partId;
  node.setAttribute("aria-hidden", "true");
  const image = documentRef.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  node.append(image);
  applyLayerPlan(node, image, layer);
  return { node, image };
}

export function createCharacterDomRenderer({
  composer,
  documentRef = DEFAULT_DOCUMENT,
  strict = false,
  now = () => Date.now(),
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancelSchedule = (handle) => clearTimeout(handle),
  onError = () => {},
} = {}) {
  const documentObject = requireDocument(documentRef);
  if (!composer || typeof composer.compose !== "function") fail("CHARACTER_DOM_COMPOSER_INVALID", "Character DOM renderer requires CharacterComposer.");
  const scheduled = new Set();

  function stop() {
    for (const handle of [...scheduled]) {
      cancelSchedule(handle.id);
      scheduled.delete(handle);
    }
  }

  function report(error, host) {
    host.dataset.wuxiaCharacterRenderState = "error";
    host.dataset.wuxiaCharacterRenderError = error.code || "CHARACTER_DOM_RENDER_FAILED";
    onError(error, host);
    if (strict) throw error;
  }

  function mountHost(host) {
    const compositionId = host.dataset.wuxiaCharacterCompositionId || "";
    const clipId = host.dataset.wuxiaCharacterClip || "idle";
    const facing = host.dataset.wuxiaCharacterFacing || "right";
    const initialPlan = composer.compose(compositionId, { clipId, frameIndex: 0, facing });
    const stack = documentObject.createElement("span");
    stack.className = "wuxia-character-layer-stack";
    stack.dataset.wuxiaCharacterComposition = compositionId;
    stack.dataset.wuxiaCharacterFacing = facing;
    stack.dataset.wuxiaCharacterMirror = String(initialPlan.mirrorX);
    stack.setAttribute("role", "img");
    stack.setAttribute("aria-label", host.dataset.wuxiaCharacterLabel || compositionId);
    stack.style.width = `${initialPlan.canvas.width}px`;
    stack.style.height = `${initialPlan.canvas.height}px`;
    const layers = initialPlan.layers.map((layer) => createLayerNode(documentObject, layer));
    stack.append(...layers.map((entry) => entry.node));
    host.append(stack);
    host.classList.add("has-modular-character");
    host.dataset.wuxiaCharacterRenderState = "mounted";

    let frameIndex = initialPlan.frameIndex;
    const startedAt = now();
    const frameDurationMs = 1000 / initialPlan.fps;
    const tick = () => {
      const elapsedFrames = Math.max(0, Math.floor((now() - startedAt) / frameDurationMs));
      const nextFrame = initialPlan.playback === "hold-last"
        ? Math.min(initialPlan.frameCount - 1, elapsedFrames)
        : elapsedFrames % initialPlan.frameCount;
      if (nextFrame !== frameIndex) {
        const plan = composer.compose(compositionId, { clipId, frameIndex: nextFrame, facing });
        plan.layers.forEach((layer, index) => applyLayerPlan(layers[index].node, layers[index].image, layer));
        stack.dataset.wuxiaCharacterFrameIndex = String(plan.frameIndex);
        stack.dataset.wuxiaCharacterBodyPhase = plan.bodyPhase;
        frameIndex = plan.frameIndex;
      }
      if (initialPlan.frameCount <= 1 || (initialPlan.playback === "hold-last" && elapsedFrames >= initialPlan.frameCount - 1)) return;
      const token = { id: null, host };
      token.id = schedule(() => {
        scheduled.delete(token);
        tick();
      }, Math.max(16, Math.floor(frameDurationMs)));
      scheduled.add(token);
    };
    stack.dataset.wuxiaCharacterFrameIndex = String(initialPlan.frameIndex);
    stack.dataset.wuxiaCharacterBodyPhase = initialPlan.bodyPhase;
    tick();
  }

  function mount(root) {
    if (!root || typeof root.querySelectorAll !== "function") fail("CHARACTER_DOM_ROOT_INVALID", "Character DOM renderer requires a queryable root.");
    stop();
    const hosts = [...root.querySelectorAll("[data-wuxia-character-composition-id]")];
    let mounted = 0;
    for (const host of hosts) {
      try {
        mountHost(host);
        mounted += 1;
      } catch (error) {
        report(error instanceof CharacterDomRenderError || error?.code ? error : new CharacterDomRenderError("CHARACTER_DOM_RENDER_FAILED", error?.message || "Character render failed."), host);
      }
    }
    return mounted;
  }

  return Object.freeze({ mount, stop });
}
