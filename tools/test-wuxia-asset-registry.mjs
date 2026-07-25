import assert from "node:assert/strict";
import fs from "node:fs";

import { AssetActivationError, createAssetRegistry } from "../src/assetRegistry.js";
import { validateRuntimeAssetRegistrySchema, validateWuxiaAssetRegistry } from "./validate-wuxia-asset-registry.mjs";

const manifest = JSON.parse(fs.readFileSync("config/wuxia_runtime_asset_registry.json", "utf8"));
assert.equal(validateRuntimeAssetRegistrySchema(manifest).valid, true, "runtime asset manifest must satisfy its schema");
assert.equal(validateWuxiaAssetRegistry().valid, true, "runtime projection must match production registry and scope");

const registry = createAssetRegistry(manifest);
assert.equal(registry.resolve("brand-icon-primary").path, "public/wuxia-brand/icon.svg");
assert.throws(() => registry.resolve("missing-asset"), (error) => error instanceof AssetActivationError && error.code === "ASSET_UNKNOWN_ID");
assert.throws(() => createAssetRegistry({ ...manifest, assets: [{ ...manifest.assets[0], approval: "pending" }] }), (error) => error.code === "ASSET_NOT_APPROVED");
assert.throws(() => createAssetRegistry({ ...manifest, assets: [{ ...manifest.assets[0], path: "../reference.svg" }] }), (error) => error.code === "ASSET_PATH_INVALID");

const fakeNode = {
  attrs: { "data-wuxia-asset": "brand-icon-primary" },
  getAttribute(name) { return this.attrs[name] || null; },
  setAttribute(name, value) { this.attrs[name] = value; },
};
const fakeDocument = { querySelectorAll() { return [fakeNode]; } };
assert.equal(registry.applyBindings(fakeDocument), 1);
assert.equal(fakeNode.attrs.href, "public/wuxia-brand/icon.svg");

console.log("runtime asset registry tests: PASS (schema, parity, resolution, rejection, binding)");
