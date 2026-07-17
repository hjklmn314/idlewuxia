import assert from "node:assert/strict";
import { evaluateWebBundleFreshness, materializeWebBundle } from "./lib/web-bundle-freshness.mjs";

const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const scope = {
  shippingFiles: ["index.html", "config/runtime.json"],
  shippingSanitization: {
    jsonFiles: ["config/runtime.json"],
    removeObjectKeys: ["sourceFiles"],
    forbiddenStringPatterns: ["competitor-reference", "G:\\codex"],
  },
};
const contract = {
  $schema: "idlewuxia.web_bundle_contract.v1",
  manifestSchema: "idlewuxia.web_bundle_manifest.v1",
  hashAlgorithm: "sha256",
  sourceRoot: ".",
  webRoot: "www",
  androidAssetsRoot: "android/app/src/main/assets/public",
  platformGeneratedFiles: [
    { path: "cordova.js", producer: "@capacitor/cli", bytes: 0, sha256: emptyHash },
    { path: "cordova_plugins.js", producer: "@capacitor/cli", bytes: 0, sha256: emptyHash },
  ],
};

function baseLayers() {
  const sourceFiles = new Map([
    ["index.html", Buffer.from("<main>武侠</main>\n")],
    ["config/runtime.json", Buffer.from(JSON.stringify({
      title: "武侠",
      sourceFiles: ["G:\\codex\\evidence.lua"],
      nested: ["keep", "competitor-reference/private"],
    }, null, 2))],
  ]);
  const materialized = materializeWebBundle({ scope, sourceFiles });
  assert.equal(materialized.findings.length, 0);
  const wwwFiles = new Map(materialized.outputFiles);
  const androidFiles = new Map(materialized.outputFiles);
  androidFiles.set("cordova.js", Buffer.alloc(0));
  androidFiles.set("cordova_plugins.js", Buffer.alloc(0));
  return { sourceFiles, wwwFiles, androidFiles };
}

function evaluate(layers, contractOverride = contract) {
  return evaluateWebBundleFreshness({
    scope,
    contract: contractOverride,
    ...layers,
    revision: { commit: "abc123", dirty: false },
    generatedAt: "2026-07-17T00:00:00.000Z",
  });
}

const cases = [];
function test(name, run) {
  cases.push({ name, run });
}
function findingTypes(report) {
  return report.findings.map((entry) => entry.type);
}

test("passes copy, sanitized JSON, and Capacitor generated files", () => {
  const report = evaluate(baseLayers());
  assert.equal(report.status, "pass");
  assert.equal(report.summary.shippingFiles, 2);
  assert.equal(report.summary.copyFiles, 1);
  assert.equal(report.summary.transformedFiles, 1);
  const copy = report.files.find((row) => row.path === "index.html");
  const sanitized = report.files.find((row) => row.path === "config/runtime.json");
  assert.equal(copy.source.sha256, copy.www.sha256);
  assert.notEqual(sanitized.source.sha256, sanitized.www.sha256);
  assert.equal(sanitized.expectedOutput.sha256, sanitized.www.sha256);
  assert.equal(sanitized.www.sha256, sanitized.android.sha256);
});

test("rejects a missing source input", () => {
  const layers = baseLayers();
  layers.sourceFiles.delete("index.html");
  assert.ok(findingTypes(evaluate(layers)).includes("MISSING_SOURCE_FILE"));
});

test("rejects stale www bytes", () => {
  const layers = baseLayers();
  layers.wwwFiles.set("index.html", Buffer.from("stale"));
  assert.ok(findingTypes(evaluate(layers)).includes("WWW_CONTENT_MISMATCH"));
});

test("rejects stale Android bytes", () => {
  const layers = baseLayers();
  layers.androidFiles.set("index.html", Buffer.from("stale"));
  assert.ok(findingTypes(evaluate(layers)).includes("ANDROID_CONTENT_MISMATCH"));
});

test("rejects unexpected www files", () => {
  const layers = baseLayers();
  layers.wwwFiles.set("old-template.js", Buffer.from("legacy"));
  assert.ok(findingTypes(evaluate(layers)).includes("WWW_UNEXPECTED_FILE"));
});

test("rejects unexpected Android files", () => {
  const layers = baseLayers();
  layers.androidFiles.set("old-template.js", Buffer.from("legacy"));
  assert.ok(findingTypes(evaluate(layers)).includes("ANDROID_UNEXPECTED_FILE"));
});

test("rejects changed Capacitor generated files", () => {
  const layers = baseLayers();
  layers.androidFiles.set("cordova.js", Buffer.from("unexpected"));
  assert.ok(findingTypes(evaluate(layers)).includes("ANDROID_GENERATED_FILE_MISMATCH"));
});

test("rejects invalid transformed JSON", () => {
  const layers = baseLayers();
  layers.sourceFiles.set("config/runtime.json", Buffer.from("{"));
  assert.ok(findingTypes(evaluate(layers)).includes("INVALID_SOURCE_JSON"));
});

for (const item of cases) {
  item.run();
  console.log("PASS " + item.name);
}
console.log("Web bundle freshness tests passed: " + cases.length);
