import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

export function normalizeFingerprint(value) {
  return String(value || "").replaceAll(":", "").trim().toLowerCase();
}

export function releaseInputInventory(root, contract) {
  return contract.traceability.requiredInputFiles.map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return { path: relativePath, exists: false, bytes: 0, sha256: null };
    }
    const bytes = fs.readFileSync(absolutePath);
    return { path: relativePath, exists: true, bytes: bytes.length, sha256: sha256Bytes(bytes) };
  });
}

function add(rows, severity, type, detail = {}) {
  rows.push({ severity, type, ...detail });
}

function extractQuotedValue(text, key) {
  return text.match(new RegExp(`\\b${key}\\s+[\"']([^\"']+)[\"']`))?.[1] || null;
}

export function auditReleaseBuildContract({
  contract,
  buildGradle,
  proguardRules,
  plan,
  trackedFiles,
  inputInventory,
  environment = {},
  gitState = {},
  phase = "tooling",
  artifactManifest = null,
  sbom = null,
}) {
  const findings = [];
  const releaseBlockers = [];
  const taskById = new Map((plan.tasks || []).map((task) => [task.id, task]));

  const expectedVersionCode = Number(buildGradle.match(/\bversionCode\s+(\d+)/)?.[1]);
  const expectedVersionName = extractQuotedValue(buildGradle, "versionName");
  const applicationId = extractQuotedValue(buildGradle, "applicationId");
  if (expectedVersionCode !== contract.releaseVersion.versionCode) add(findings, "P0", "version-code-drift", { expected: contract.releaseVersion.versionCode, actual: expectedVersionCode });
  if (expectedVersionName !== contract.releaseVersion.versionName) add(findings, "P0", "version-name-drift", { expected: contract.releaseVersion.versionName, actual: expectedVersionName });
  if (applicationId !== contract.applicationId) add(findings, "P0", "application-id-drift", { expected: contract.applicationId, actual: applicationId });

  if (!/minifyEnabled\s+true/.test(buildGradle)) add(findings, "P0", "r8-minify-not-enabled");
  if (!/shrinkResources\s+true/.test(buildGradle)) add(findings, "P0", "resource-shrink-not-enabled");
  if (!/proguard-android-optimize\.txt/.test(buildGradle)) add(findings, "P0", "optimized-default-proguard-missing");
  if (!/-keepattributes\s+SourceFile,LineNumberTable/.test(proguardRules)) add(findings, "P1", "release-line-number-metadata-missing");

  for (const name of contract.externalSigning.requiredEnvironment.filter((name) => name !== contract.externalSigning.certificateFingerprintEnvironment)) {
    if (!buildGradle.includes(`System.getenv('${name}')`)) add(findings, "P0", "signing-environment-not-wired", { name });
  }
  if (/\b(?:storePassword|keyPassword)\s+[\"'][^\"']+[\"']/.test(buildGradle)) add(findings, "P0", "literal-signing-secret-in-gradle");
  for (const file of trackedFiles) {
    const lower = file.toLowerCase();
    if (contract.externalSigning.forbiddenTrackedSuffixes.some((suffix) => lower.endsWith(suffix.toLowerCase()))) add(findings, "P0", "tracked-signing-material", { file });
  }
  for (const input of inputInventory.filter((row) => !row.exists)) add(findings, "P0", "release-input-missing", { path: input.path });
  if ([...new Set(contract.androidBuild.artifacts.map((row) => row.kind))].sort().join(",") !== "aab,apk") add(findings, "P0", "artifact-set-invalid");

  for (const taskId of contract.releaseReadiness.requiredTaskIds) {
    const task = taskById.get(taskId);
    if (!task) add(findings, "P0", "release-dependency-unknown", { taskId });
    else if (task.status !== "done") add(releaseBlockers, "P0", "release-dependency-not-done", { taskId, status: task.status });
  }
  for (const name of contract.externalSigning.requiredEnvironment) {
    if (!String(environment[name] || "").trim()) add(releaseBlockers, "P0", "release-environment-missing", { name });
  }
  const expectedFingerprint = normalizeFingerprint(environment[contract.externalSigning.certificateFingerprintEnvironment]);
  if (expectedFingerprint && !/^[0-9a-f]{64}$/.test(expectedFingerprint)) add(releaseBlockers, "P0", "release-certificate-fingerprint-invalid");
  if (contract.releaseReadiness.requireCleanWorktree && gitState.clean !== true) add(releaseBlockers, "P0", "git-worktree-not-clean");
  if (contract.releaseReadiness.requireUpstreamEquality && (!gitState.head || gitState.head !== gitState.upstream)) add(releaseBlockers, "P0", "git-upstream-mismatch", { head: gitState.head || null, upstream: gitState.upstream || null });
  if (contract.releaseReadiness.requireGreenCi && (!gitState.greenCiCommit || gitState.greenCiCommit !== gitState.head)) add(releaseBlockers, "P0", "green-ci-commit-unproven", { head: gitState.head || null, greenCiCommit: gitState.greenCiCommit || null });

  if (phase === "postbuild") {
    const sbomCompleteness = sbom?.properties?.find((row) => row.name === "idlewuxia:completeness")?.value || sbom?.completeness;
    if (!sbom || sbomCompleteness !== "complete") add(releaseBlockers, "P0", "complete-sbom-missing");
    if (!artifactManifest) add(releaseBlockers, "P0", "artifact-manifest-missing");
    else {
      for (const field of contract.traceability.requiredManifestFields) {
        if (artifactManifest[field] === undefined || artifactManifest[field] === null) add(releaseBlockers, "P0", "artifact-manifest-field-missing", { field });
      }
      if (normalizeFingerprint(artifactManifest.signingCertificateSha256) !== expectedFingerprint) add(releaseBlockers, "P0", "artifact-certificate-mismatch");
      if (artifactManifest.reproducibility?.pass !== true) add(releaseBlockers, "P0", "reproducibility-unproven");
    }
  }

  return {
    staticPass: findings.every((row) => row.severity !== "P0"),
    releaseEligible: findings.every((row) => row.severity !== "P0") && releaseBlockers.length === 0,
    findings,
    releaseBlockers,
  };
}

export function parseGradleCoordinates(text) {
  const coordinates = new Map();
  const pattern = /(?:^|\s)([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):([^\s()]+?)(?:\s+->\s+([^\s()]+))?(?=\s|\s*\(|$)/gm;
  for (const match of String(text || "").matchAll(pattern)) {
    const version = (match[4] || match[3]).replace(/[,*]$/, "");
    if (!version || version === "FAILED") continue;
    const key = `${match[1]}:${match[2]}:${version}`;
    coordinates.set(key, { group: match[1], name: match[2], version });
  }
  return [...coordinates.values()].sort((left, right) => `${left.group}:${left.name}:${left.version}`.localeCompare(`${right.group}:${right.name}:${right.version}`, "en"));
}

export function deterministicUuidFromHex(hex) {
  const raw = String(hex).padEnd(32, "0").slice(0, 32).split("");
  raw[12] = "5";
  raw[16] = ((Number.parseInt(raw[16], 16) & 0x3) | 0x8).toString(16);
  const value = raw.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function auditCycloneDx16Bom(bom, { requireComplete = true } = {}) {
  const findings = [];
  const topLevelAllowed = new Set(["bomFormat", "specVersion", "serialNumber", "version", "metadata", "components", "dependencies", "properties"]);
  for (const key of Object.keys(bom || {})) if (!topLevelAllowed.has(key)) add(findings, "P0", "sbom-unknown-top-level-field", { key });
  if (bom?.bomFormat !== "CycloneDX") add(findings, "P0", "sbom-format-invalid");
  if (bom?.specVersion !== "1.6") add(findings, "P0", "sbom-spec-version-invalid");
  if (!/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bom?.serialNumber || "")) add(findings, "P0", "sbom-serial-number-invalid");
  if (!Number.isInteger(bom?.version) || bom.version < 1) add(findings, "P0", "sbom-version-invalid");
  if (!bom?.metadata?.timestamp || Number.isNaN(Date.parse(bom.metadata.timestamp))) add(findings, "P0", "sbom-timestamp-invalid");
  const components = Array.isArray(bom?.components) ? bom.components : [];
  if (!components.length) add(findings, "P0", "sbom-components-empty");
  const refs = new Set();
  for (const component of components) {
    const ref = component?.["bom-ref"];
    if (!ref || refs.has(ref)) add(findings, "P0", "sbom-component-ref-invalid-or-duplicate", { ref: ref || null });
    else refs.add(ref);
    if (!component?.name || !component?.version || !component?.purl?.startsWith("pkg:")) add(findings, "P0", "sbom-component-identity-invalid", { ref: ref || null });
    for (const hash of component?.hashes || []) {
      const expectedLength = { "SHA-256": 64, "SHA-512": 128 }[hash.alg];
      if (!expectedLength || !new RegExp(`^[0-9a-f]{${expectedLength}}$`, "i").test(hash.content || "")) add(findings, "P0", "sbom-component-hash-invalid", { ref: ref || null, alg: hash.alg || null });
    }
  }
  const rootRef = bom?.metadata?.component?.["bom-ref"];
  const validRefs = new Set([...refs, rootRef].filter(Boolean));
  for (const dependency of bom?.dependencies || []) {
    if (!validRefs.has(dependency.ref)) add(findings, "P0", "sbom-dependency-ref-unknown", { ref: dependency.ref });
    for (const target of dependency.dependsOn || []) if (!refs.has(target)) add(findings, "P0", "sbom-dependency-target-unknown", { target });
  }
  const completeness = bom?.properties?.find((row) => row.name === "idlewuxia:completeness")?.value;
  if (requireComplete && completeness !== "complete") add(findings, "P0", "sbom-incomplete", { completeness: completeness || null });
  return { pass: findings.length === 0, components: components.length, completeness: completeness || null, findings };
}
