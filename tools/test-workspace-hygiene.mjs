import assert from "node:assert/strict";
import { classifyTrackedFiles, compareShippingClosures } from "./lib/workspace-hygiene.mjs";

const clean = classifyTrackedFiles({
  trackedFiles: ["src/wuxia-main.js", "src/main.js", "config/reference.json", "tools/test.mjs"],
  shippingFiles: ["src/wuxia-main.js"],
  legacyFiles: ["src/main.js"],
  referenceFiles: ["config/reference.json"],
});
assert.deepEqual(clean.overlaps, []);
assert.deepEqual(clean.records.map((row) => row.classification), ["reference_only", "dormant_legacy", "active_authority", "shared_governance"]);

const overlap = classifyTrackedFiles({
  trackedFiles: ["src/main.js"],
  shippingFiles: ["src/main.js"],
  legacyFiles: ["src/main.js"],
  referenceFiles: [],
});
assert.equal(overlap.overlaps.length, 1);

const closure = [{ file: "index.html", bytes: 10, sha256: "a" }];
assert.deepEqual(compareShippingClosures(closure, structuredClone(closure)), []);
assert.equal(compareShippingClosures(closure, [{ file: "index.html", bytes: 11, sha256: "b" }]).length, 1);
assert.equal(compareShippingClosures(closure, []).length, 1);

console.log("workspace hygiene tests: PASS (classification overlap and shipping closure regression)");
