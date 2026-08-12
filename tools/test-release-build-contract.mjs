import assert from "node:assert/strict";
import contract from "../config/production/release_build_contract.json" with { type: "json" };
import { auditCycloneDx16Bom, auditReleaseBuildContract, deterministicUuidFromHex, parseGradleCoordinates } from "./lib/release-build.mjs";

const buildGradle = `
applicationId "com.idlewuxia.app"
versionCode 1
versionName "0.1.0"
System.getenv('IDLEWUXIA_RELEASE_KEYSTORE')
System.getenv('IDLEWUXIA_RELEASE_STORE_PASSWORD')
System.getenv('IDLEWUXIA_RELEASE_KEY_ALIAS')
System.getenv('IDLEWUXIA_RELEASE_KEY_PASSWORD')
release {
  minifyEnabled true
  shrinkResources true
  proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
}
`;
const environment = Object.fromEntries(contract.externalSigning.requiredEnvironment.map((name) => [name, name.endsWith("CERT_SHA256") ? "a".repeat(64) : "external-value"]));
const base = {
  contract,
  buildGradle,
  proguardRules: "-keepattributes SourceFile,LineNumberTable",
  plan: { tasks: contract.releaseReadiness.requiredTaskIds.map((id) => ({ id, status: "done" })) },
  trackedFiles: ["package-lock.json"],
  inputInventory: contract.traceability.requiredInputFiles.map((path) => ({ path, exists: true })),
  environment,
  gitState: { clean: true, head: "abc", upstream: "abc", greenCiCommit: "abc" },
  phase: "prebuild"
};
assert.equal(auditReleaseBuildContract(base).releaseEligible, true);

const noR8 = { ...base, buildGradle: buildGradle.replace("minifyEnabled true", "minifyEnabled false") };
assert.equal(auditReleaseBuildContract(noR8).findings.some((row) => row.type === "r8-minify-not-enabled"), true);

const literalSecret = { ...base, buildGradle: `${buildGradle}\nstorePassword "secret"` };
assert.equal(auditReleaseBuildContract(literalSecret).findings.some((row) => row.type === "literal-signing-secret-in-gradle"), true);

const blockedDependency = structuredClone(base);
blockedDependency.plan.tasks[0].status = "blocked";
assert.equal(auditReleaseBuildContract(blockedDependency).releaseBlockers.some((row) => row.type === "release-dependency-not-done"), true);

const missingSigning = { ...base, environment: {} };
assert.equal(auditReleaseBuildContract(missingSigning).releaseBlockers.filter((row) => row.type === "release-environment-missing").length, contract.externalSigning.requiredEnvironment.length);

const dirty = { ...base, gitState: { ...base.gitState, clean: false } };
assert.equal(auditReleaseBuildContract(dirty).releaseBlockers.some((row) => row.type === "git-worktree-not-clean"), true);

const postbuild = { ...base, phase: "postbuild", sbom: { properties: [{ name: "idlewuxia:completeness", value: "complete" }] }, artifactManifest: { reproducibility: { pass: true }, signingCertificateSha256: "a".repeat(64) } };
assert.equal(auditReleaseBuildContract(postbuild).releaseBlockers.some((row) => row.type === "artifact-manifest-field-missing"), true);

const coordinates = parseGradleCoordinates(`releaseRuntimeClasspath\n+--- androidx.core:core:1.9.0 -> 1.12.0\n\\--- com.example:demo:2.0`);
assert.deepEqual(coordinates, [
  { group: "androidx.core", name: "core", version: "1.12.0" },
  { group: "com.example", name: "demo", version: "2.0" }
]);
assert.match(deterministicUuidFromHex("a".repeat(64)), /^[0-9a-f-]{36}$/);

const validBom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${deterministicUuidFromHex("b".repeat(64))}`,
  version: 1,
  metadata: { timestamp: "2026-08-12T00:00:00.000Z", component: { type: "application", "bom-ref": "pkg:npm/app@1.0.0", name: "app", version: "1.0.0" } },
  components: [{ type: "library", "bom-ref": "pkg:npm/lib@1.0.0", name: "lib", version: "1.0.0", purl: "pkg:npm/lib@1.0.0", hashes: [{ alg: "SHA-512", content: "c".repeat(128) }] }],
  dependencies: [{ ref: "pkg:npm/app@1.0.0", dependsOn: ["pkg:npm/lib@1.0.0"] }],
  properties: [{ name: "idlewuxia:completeness", value: "complete" }]
};
assert.equal(auditCycloneDx16Bom(validBom).pass, true);
assert.equal(auditCycloneDx16Bom({ ...validBom, components: [...validBom.components, validBom.components[0]] }).findings.some((row) => row.type === "sbom-component-ref-invalid-or-duplicate"), true);
assert.equal(auditCycloneDx16Bom({ ...validBom, properties: [] }).findings.some((row) => row.type === "sbom-incomplete"), true);

console.log("release build contract tests: PASS (R8, signing, dependency, Git, manifest and SBOM coordinate negative paths)");
