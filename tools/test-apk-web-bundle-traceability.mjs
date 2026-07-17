import assert from "node:assert/strict";
import crypto from "node:crypto";
import { evaluateApkWebBundleTraceability } from "./lib/apk-web-bundle-traceability.mjs";

function digest(bytes) {
  return {
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function baseInput() {
  const index = Buffer.from("<main>武侠</main>\n");
  const runtime = Buffer.from("{\"chapter\":\"fb01\"}\n");
  const empty = Buffer.alloc(0);
  const manifest = {
    $schema: "idlewuxia.web_bundle_manifest.v1",
    generatedAt: "2026-07-17T01:00:00.000Z",
    status: "pass",
    revision: { commit: "abc123", dirty: false },
    summary: { shippingFiles: 2, findings: 0 },
    files: [
      { path: "index.html", transform: "copy", expectedOutput: digest(index), android: digest(index) },
      { path: "config/runtime.json", transform: "sanitize_json", expectedOutput: digest(runtime), android: digest(runtime) },
    ],
    platformGeneratedFiles: [
      { path: "cordova.js", producer: "@capacitor/cli", expected: digest(empty), actual: digest(empty), matches: true },
    ],
    findings: [],
  };
  return {
    scope: { shippingFiles: ["index.html", "config/runtime.json"] },
    manifest,
    manifestBytes: Buffer.from(JSON.stringify(manifest)),
    apkAssets: new Map([
      ["index.html", index],
      ["config/runtime.json", runtime],
      ["cordova.js", empty],
    ]),
    revision: { commit: "abc123", dirty: false },
    apkBuiltAt: "2026-07-17T01:01:00.000Z",
    auditGeneratedAt: "2026-07-17T01:02:00.000Z",
    requireCleanRevision: true,
  };
}

function cloneInput() {
  const input = baseInput();
  input.manifest = JSON.parse(JSON.stringify(input.manifest));
  input.manifestBytes = Buffer.from(JSON.stringify(input.manifest));
  input.apkAssets = new Map([...input.apkAssets].map(([key, value]) => [key, Buffer.from(value)]));
  input.revision = { ...input.revision };
  return input;
}

function types(report) {
  return report.findings.map((entry) => entry.type);
}

const cases = [];
function test(name, run) {
  cases.push({ name, run });
}
function expectFinding(type, mutate) {
  const input = cloneInput();
  mutate(input);
  input.manifestBytes = Buffer.from(JSON.stringify(input.manifest));
  assert.ok(types(evaluateApkWebBundleTraceability(input)).includes(type));
}

test("passes a clean commit with ordered evidence and exact APK bytes", () => {
  const report = evaluateApkWebBundleTraceability(cloneInput());
  assert.equal(report.status, "pass");
  assert.equal(report.formalReady, true);
  assert.equal(report.summary.productFilesMatched, 2);
  assert.equal(report.summary.platformGeneratedFilesMatched, 1);
  assert.equal(report.summary.unexpectedAssets, 0);
});
test("rejects a dirty formal audit", () => {
  expectFinding("GIT_WORKTREE_DIRTY", (input) => { input.revision.dirty = true; });
});
test("rejects a manifest from a dirty revision", () => {
  expectFinding("WEB_MANIFEST_REVISION_DIRTY", (input) => { input.manifest.revision.dirty = true; });
});
test("rejects a manifest from another commit", () => {
  expectFinding("WEB_MANIFEST_COMMIT_MISMATCH", (input) => { input.manifest.revision.commit = "other"; });
});
test("rejects a manifest shipping-set mismatch", () => {
  expectFinding("WEB_MANIFEST_SHIPPING_SET_MISMATCH", (input) => { input.manifest.files.pop(); });
});
test("rejects a missing APK product asset", () => {
  expectFinding("APK_PRODUCT_ASSET_MISSING", (input) => { input.apkAssets.delete("index.html"); });
});
test("rejects changed APK product bytes", () => {
  expectFinding("APK_PRODUCT_ASSET_HASH_MISMATCH", (input) => { input.apkAssets.set("index.html", Buffer.from("stale")); });
});
test("rejects changed APK platform bytes", () => {
  expectFinding("APK_PLATFORM_ASSET_HASH_MISMATCH", (input) => { input.apkAssets.set("cordova.js", Buffer.from("stale")); });
});
test("rejects undeclared APK web assets", () => {
  expectFinding("APK_WEB_ASSET_UNEXPECTED", (input) => { input.apkAssets.set("legacy.js", Buffer.from("legacy")); });
});
test("rejects an APK older than its web manifest", () => {
  expectFinding("APK_BUILT_BEFORE_WEB_MANIFEST", (input) => { input.apkBuiltAt = "2026-07-17T00:59:00.000Z"; });
});
test("rejects an audit timestamp older than the APK", () => {
  expectFinding("AUDIT_GENERATED_BEFORE_APK", (input) => { input.auditGeneratedAt = "2026-07-17T01:00:30.000Z"; });
});
test("rejects a failed web manifest", () => {
  expectFinding("WEB_MANIFEST_NOT_PASSING", (input) => { input.manifest.status = "fail"; });
});

for (const item of cases) {
  item.run();
  console.log("PASS " + item.name);
}
console.log("APK web bundle traceability tests passed: " + cases.length);
