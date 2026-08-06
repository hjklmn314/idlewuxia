const DEFAULT_FORMATS = new Set(["svg", "webp", "png", "woff2"]);
const DEVELOPMENT_REFERENCE_FORMATS = new Set(["png", "webp", "jpg", "mp3"]);

export class AssetActivationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AssetActivationError";
    this.code = code;
    this.details = details;
  }
}

function assertManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new AssetActivationError("ASSET_REGISTRY_MISSING", "Runtime asset registry is missing.");
  }
  if (!Array.isArray(manifest.assets)) {
    throw new AssetActivationError("ASSET_REGISTRY_INVALID", "Runtime asset registry must define assets[].");
  }
  const seen = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.id !== "string" || !asset.id) {
      throw new AssetActivationError("ASSET_RECORD_INVALID", "Every runtime asset requires a logical id.");
    }
    if (seen.has(asset.id)) {
      throw new AssetActivationError("ASSET_DUPLICATE_ID", `Duplicate runtime asset id: ${asset.id}`);
    }
    seen.add(asset.id);
    if (asset.adoption !== "ship" || asset.approval !== "approved") {
      throw new AssetActivationError("ASSET_NOT_APPROVED", `Runtime asset is not approved for shipping: ${asset.id}`, { assetId: asset.id });
    }
    if (typeof asset.path !== "string" || !asset.path || asset.path.startsWith("/") || asset.path.includes("..")) {
      throw new AssetActivationError("ASSET_PATH_INVALID", `Runtime asset path is invalid: ${asset.id}`, { assetId: asset.id });
    }
    if (!/^[a-f0-9]{64}$/.test(asset.sha256 || "") || !Number.isInteger(asset.bytes) || asset.bytes < 0) {
      throw new AssetActivationError("ASSET_INTEGRITY_MISSING", `Runtime asset integrity is incomplete: ${asset.id}`, { assetId: asset.id });
    }
  }
}

function assertReferenceOverlayShape(overlay) {
  if (!overlay || typeof overlay !== "object") {
    throw new AssetActivationError("REFERENCE_ASSET_OVERLAY_MISSING", "Development reference asset overlay is missing.");
  }
  if (overlay.mode !== "development-only" || overlay.shippingAllowed !== false || overlay.sourcePolicy !== "reference-only") {
    throw new AssetActivationError("REFERENCE_ASSET_OVERLAY_POLICY", "Development reference overlay must be explicitly non-shipping.");
  }
  if (!Array.isArray(overlay.assets)) {
    throw new AssetActivationError("REFERENCE_ASSET_OVERLAY_INVALID", "Development reference asset overlay must define assets[].");
  }
  const seen = new Set();
  for (const asset of overlay.assets) {
    if (!asset || typeof asset.id !== "string" || !asset.id) {
      throw new AssetActivationError("REFERENCE_ASSET_RECORD_INVALID", "Every development reference asset requires a logical id.");
    }
    if (seen.has(asset.id)) {
      throw new AssetActivationError("REFERENCE_ASSET_DUPLICATE_ID", `Duplicate development reference asset id: ${asset.id}`);
    }
    seen.add(asset.id);
    if (asset.adoption !== "reference-only" || asset.approval !== "development-only") {
      throw new AssetActivationError("REFERENCE_ASSET_POLICY_INVALID", `Reference asset is not explicitly development-only: ${asset.id}`, { assetId: asset.id });
    }
    if (typeof asset.path !== "string" || !asset.path || asset.path.startsWith("/") || asset.path.includes("..") || asset.path.includes("\\")) {
      throw new AssetActivationError("REFERENCE_ASSET_PATH_INVALID", `Development reference asset path is invalid: ${asset.id}`, { assetId: asset.id });
    }
  }
}

export function createAssetRegistry(manifest, { allowedFormats = DEFAULT_FORMATS } = {}) {
  assertManifestShape(manifest);
  const assets = new Map(manifest.assets.map((asset) => [asset.id, Object.freeze({ ...asset })]));
  for (const asset of assets.values()) {
    if (!allowedFormats.has(asset.format)) {
      throw new AssetActivationError("ASSET_FORMAT_UNSUPPORTED", `Runtime asset format is not allowed: ${asset.id}`, { assetId: asset.id, format: asset.format });
    }
  }
  return Object.freeze({
    registryId: manifest.registryId || "",
    version: manifest.version || 1,
    resolve(assetId) {
      const asset = assets.get(assetId);
      if (!asset) throw new AssetActivationError("ASSET_UNKNOWN_ID", `Unknown runtime asset id: ${assetId}`, { assetId });
      return asset;
    },
    list() {
      return [...assets.values()];
    },
    applyBindings(documentRef) {
      if (!documentRef?.querySelectorAll) return 0;
      let applied = 0;
      for (const binding of manifest.bindings || []) {
        const nodes = documentRef.querySelectorAll(binding.selector || "");
        for (const node of nodes) {
          const assetId = binding.assetId || node.getAttribute(binding.assetAttribute || "data-wuxia-asset");
          if (!assetId) throw new AssetActivationError("ASSET_BINDING_ID_MISSING", "Asset binding has no logical asset id.");
          const asset = assets.get(assetId);
          if (!asset) throw new AssetActivationError("ASSET_BINDING_UNKNOWN_ID", `Asset binding references unknown id: ${assetId}`, { assetId });
          node.setAttribute(binding.attribute || "src", asset.path);
          applied += 1;
        }
      }
      return applied;
    },
  });
}

/**
 * Build the same logical-ID resolver used by the shipping registry for local
 * development previews.  This path is intentionally separate from
 * createAssetRegistry: reference-only records can never become shipping
 * records by accident.
 */
export function createReferenceAssetRegistry(overlay, { allowedFormats = DEVELOPMENT_REFERENCE_FORMATS } = {}) {
  assertReferenceOverlayShape(overlay);
  const assets = new Map(overlay.assets.map((asset) => [asset.id, Object.freeze({ ...asset })]));
  for (const asset of assets.values()) {
    if (!allowedFormats.has(asset.format)) {
      throw new AssetActivationError("REFERENCE_ASSET_FORMAT_UNSUPPORTED", `Development reference asset format is not allowed: ${asset.id}`, { assetId: asset.id, format: asset.format });
    }
  }
  return Object.freeze({
    registryId: overlay.overlayId || "",
    version: overlay.version || 1,
    resolve(assetId) {
      const asset = assets.get(assetId);
      if (!asset) throw new AssetActivationError("REFERENCE_ASSET_UNKNOWN_ID", `Unknown development reference asset id: ${assetId}`, { assetId });
      return asset;
    },
    list() {
      return [...assets.values()];
    },
  });
}

export function validateRuntimeAssetManifest(manifest, { allowedFormats = DEFAULT_FORMATS } = {}) {
  try {
    createAssetRegistry(manifest, { allowedFormats });
    return { valid: true, findings: [] };
  } catch (error) {
    return {
      valid: false,
      findings: [{ code: error.code || "ASSET_REGISTRY_INVALID", message: error.message, details: error.details || {} }],
    };
  }
}
