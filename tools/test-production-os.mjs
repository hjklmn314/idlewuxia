import assert from "node:assert/strict";

import {
  loadProductionDocuments,
  validateProductionDocuments,
} from "./validate-production-os.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function codesFor(documents) {
  return new Set(validateProductionDocuments(documents).findings.map((finding) => finding.code));
}

const baseline = loadProductionDocuments();
assert.equal(validateProductionDocuments(baseline).findings.length, 0, "live production contracts must pass");

{
  const documents = clone(baseline);
  documents.stagePlan.tasks.push(clone(documents.stagePlan.tasks[0]));
  assert.ok(codesFor(documents).has("DUPLICATE_ID"), "duplicate task IDs must fail");
}

{
  const documents = clone(baseline);
  const architecture = documents.stagePlan.tasks.find((task) => task.id === "ARCH-001");
  const reachability = documents.stagePlan.tasks.find((task) => task.id === "T03-00");
  architecture.dependsOn = ["T03-00"];
  reachability.dependsOn = ["ARCH-001"];
  assert.ok(codesFor(documents).has("TASK_DEPENDENCY_CYCLE"), "task cycles must fail");
}

{
  const documents = clone(baseline);
  documents.uiExperienceRegistry.acceptancePolicy.requiredScreenViewportPairs = 32;
  assert.ok(codesFor(documents).has("UI_MATRIX_COUNT_DRIFT"), "UI matrix drift must fail");
}

{
  const documents = clone(baseline);
  const referenceAsset = documents.assetRegistry.assets.find((asset) => asset.adoption !== "ship");
  referenceAsset.shippingPath = "public/wuxia-brand/icon.svg";
  assert.ok(
    codesFor(documents).has("NONSHIPPING_ASSET_HAS_SHIPPING_PATH"),
    "reference-only assets must not receive shipping paths",
  );
}

{
  const documents = clone(baseline);
  documents.toolchainRegistry.tools[0].taskId = "UNKNOWN-TASK";
  assert.ok(codesFor(documents).has("UNKNOWN_TOOL_TASK"), "tool task references must resolve");
}

console.log("production OS contract tests: PASS (6 cases)");
