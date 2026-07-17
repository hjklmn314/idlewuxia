import crypto from "node:crypto";

const OMITTED = Symbol("omitted-development-evidence");

function finding(type, path, detail) {
  return { severity: "error", type, path, detail };
}

function normalizePath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

function digest(bytes) {
  if (!bytes) return null;
  return {
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function sanitizeValue(value, removedKeys, forbiddenPatterns) {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return forbiddenPatterns.some((pattern) => normalized.includes(pattern)) ? OMITTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, removedKeys, forbiddenPatterns))
      .filter((entry) => entry !== OMITTED);
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (removedKeys.has(key)) continue;
      const sanitized = sanitizeValue(entry, removedKeys, forbiddenPatterns);
      if (sanitized !== OMITTED) output[key] = sanitized;
    }
    return output;
  }
  return value;
}

function bytesEqual(left, right) {
  return Boolean(left && right && left.equals(right));
}

export function materializeWebBundle({ scope, sourceFiles }) {
  const findings = [];
  const outputFiles = new Map();
  const filePlans = [];
  const rawShippingFiles = (scope.shippingFiles || []).map(normalizePath);
  const shippingFiles = sortedUnique(rawShippingFiles);
  const sanitization = scope.shippingSanitization || {};
  const sanitizedJsonFiles = new Set((sanitization.jsonFiles || []).map(normalizePath));
  const removedKeys = new Set(sanitization.removeObjectKeys || []);
  const forbiddenPatterns = (sanitization.forbiddenStringPatterns || [])
    .map((value) => String(value).toLowerCase());

  if (shippingFiles.length !== rawShippingFiles.length) {
    findings.push(finding(
      "DUPLICATE_SHIPPING_PATH",
      "config/project_scope.json",
      "shippingFiles must contain unique normalized paths.",
    ));
  }

  for (const relativePath of sanitizedJsonFiles) {
    if (!shippingFiles.includes(relativePath)) {
      findings.push(finding(
        "SANITIZED_PATH_NOT_SHIPPING",
        relativePath,
        "Every sanitized JSON path must also belong to shippingFiles.",
      ));
    }
  }

  for (const relativePath of shippingFiles) {
    const sourceBytes = sourceFiles.get(relativePath);
    if (!sourceBytes) {
      findings.push(finding("MISSING_SOURCE_FILE", relativePath, "Scoped web build input is missing."));
      continue;
    }

    let outputBytes = sourceBytes;
    const transform = sanitizedJsonFiles.has(relativePath) ? "sanitize_json" : "copy";
    if (transform === "sanitize_json") {
      try {
        const sourceData = JSON.parse(sourceBytes.toString("utf8").replace(/^\uFEFF/, ""));
        const sanitized = sanitizeValue(sourceData, removedKeys, forbiddenPatterns);
        outputBytes = Buffer.from(JSON.stringify(sanitized, null, 2) + "\n", "utf8");
      } catch (error) {
        findings.push(finding("INVALID_SOURCE_JSON", relativePath, error.message));
        continue;
      }
    }

    const searchable = outputBytes.toString("utf8").toLowerCase();
    const leakedPattern = forbiddenPatterns.find((pattern) => searchable.includes(pattern));
    if (leakedPattern) {
      findings.push(finding(
        "FORBIDDEN_OUTPUT_TOKEN",
        relativePath,
        "Development evidence token remains after the configured transform: " + leakedPattern,
      ));
    }

    outputFiles.set(relativePath, outputBytes);
    filePlans.push({
      path: relativePath,
      transform,
      source: digest(sourceBytes),
      expectedOutput: digest(outputBytes),
    });
  }

  return {
    shippingFiles,
    outputFiles,
    filePlans,
    findings,
  };
}

export function evaluateWebBundleFreshness({
  scope,
  contract,
  sourceFiles,
  wwwFiles,
  androidFiles,
  revision = {},
  generatedAt = new Date().toISOString(),
}) {
  const materialized = materializeWebBundle({ scope, sourceFiles });
  const findings = [...materialized.findings];
  const expectedPaths = materialized.shippingFiles;
  const wwwPaths = sortedUnique([...wwwFiles.keys()].map(normalizePath));
  const androidPaths = sortedUnique([...androidFiles.keys()].map(normalizePath));
  const platformGenerated = contract.platformGeneratedFiles || [];
  const platformPaths = platformGenerated.map((entry) => normalizePath(entry.path));

  if (contract.$schema !== "idlewuxia.web_bundle_contract.v1") {
    findings.push(finding("CONTRACT_SCHEMA_MISMATCH", "config/web_bundle_contract.json", contract.$schema || "missing"));
  }
  if (contract.manifestSchema !== "idlewuxia.web_bundle_manifest.v1") {
    findings.push(finding("MANIFEST_SCHEMA_MISMATCH", "config/web_bundle_contract.json", contract.manifestSchema || "missing"));
  }
  if (contract.hashAlgorithm !== "sha256") {
    findings.push(finding("HASH_ALGORITHM_MISMATCH", "config/web_bundle_contract.json", contract.hashAlgorithm || "missing"));
  }
  if (sortedUnique(platformPaths).length !== platformPaths.length) {
    findings.push(finding(
      "DUPLICATE_PLATFORM_GENERATED_PATH",
      "config/web_bundle_contract.json",
      "platformGeneratedFiles must contain unique normalized paths.",
    ));
  }

  const expectedSet = new Set(expectedPaths);
  const allowedAndroidSet = new Set([...expectedPaths, ...platformPaths]);
  for (const relativePath of expectedPaths) {
    if (!wwwFiles.has(relativePath)) {
      findings.push(finding("WWW_MISSING_FILE", relativePath, "Expected shipping file is missing from www."));
    }
    if (!androidFiles.has(relativePath)) {
      findings.push(finding("ANDROID_MISSING_FILE", relativePath, "Expected shipping file is missing from Android assets."));
    }
    const expectedBytes = materialized.outputFiles.get(relativePath);
    if (expectedBytes && wwwFiles.has(relativePath) && !bytesEqual(expectedBytes, wwwFiles.get(relativePath))) {
      findings.push(finding("WWW_CONTENT_MISMATCH", relativePath, "www bytes differ from the deterministic shipping transform."));
    }
    if (expectedBytes && androidFiles.has(relativePath) && !bytesEqual(expectedBytes, androidFiles.get(relativePath))) {
      findings.push(finding("ANDROID_CONTENT_MISMATCH", relativePath, "Android asset bytes differ from the deterministic shipping transform."));
    }
  }
  for (const relativePath of wwwPaths) {
    if (!expectedSet.has(relativePath)) {
      findings.push(finding("WWW_UNEXPECTED_FILE", relativePath, "www contains a file outside shippingFiles."));
    }
  }
  for (const relativePath of androidPaths) {
    if (!allowedAndroidSet.has(relativePath)) {
      findings.push(finding("ANDROID_UNEXPECTED_FILE", relativePath, "Android assets contain a file outside shippingFiles and the platform-generated allowlist."));
    }
  }

  const platformGeneratedFiles = platformGenerated.map((spec) => {
    const relativePath = normalizePath(spec.path);
    const actualBytes = androidFiles.get(relativePath);
    const actual = digest(actualBytes);
    const matches = Boolean(actual && actual.bytes === spec.bytes && actual.sha256 === spec.sha256);
    if (!actualBytes) {
      findings.push(finding("ANDROID_GENERATED_FILE_MISSING", relativePath, "Expected Capacitor-generated file is missing."));
    } else if (!matches) {
      findings.push(finding("ANDROID_GENERATED_FILE_MISMATCH", relativePath, "Capacitor-generated file does not match its declared bytes and SHA-256."));
    }
    return {
      path: relativePath,
      producer: spec.producer,
      expected: { bytes: spec.bytes, sha256: spec.sha256 },
      actual,
      matches,
    };
  });

  const files = materialized.filePlans.map((plan) => {
    const www = digest(wwwFiles.get(plan.path));
    const android = digest(androidFiles.get(plan.path));
    return {
      ...plan,
      www,
      android,
      checks: {
        sourceMatchesExpected: plan.transform === "copy"
          ? plan.source.sha256 === plan.expectedOutput.sha256
          : null,
        wwwMatchesExpected: www?.sha256 === plan.expectedOutput.sha256,
        androidMatchesExpected: android?.sha256 === plan.expectedOutput.sha256,
        wwwMatchesAndroid: Boolean(www && android && www.sha256 === android.sha256),
      },
    };
  });

  const copyFiles = files.filter((row) => row.transform === "copy").length;
  const transformedFiles = files.filter((row) => row.transform !== "copy").length;
  const report = {
    $schema: contract.manifestSchema,
    generatedAt,
    status: findings.length ? "fail" : "pass",
    revision: {
      commit: revision.commit || null,
      dirty: Boolean(revision.dirty),
    },
    roots: {
      source: contract.sourceRoot,
      www: contract.webRoot,
      androidAssets: contract.androidAssetsRoot,
    },
    summary: {
      shippingFiles: expectedPaths.length,
      copyFiles,
      transformedFiles,
      wwwFiles: wwwPaths.length,
      androidShippingFiles: androidPaths.filter((entry) => expectedSet.has(entry)).length,
      platformGeneratedFiles: platformGeneratedFiles.length,
      wwwUnexpectedFiles: wwwPaths.filter((entry) => !expectedSet.has(entry)).length,
      androidUnexpectedFiles: androidPaths.filter((entry) => !allowedAndroidSet.has(entry)).length,
      findings: findings.length,
    },
    files,
    platformGeneratedFiles,
    findings,
  };
  return report;
}
