import crypto from "node:crypto";

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

function timestamp(value, label, findings) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    findings.push(finding("INVALID_EVIDENCE_TIMESTAMP", label, String(value || "missing")));
    return null;
  }
  return parsed;
}

export function evaluateApkWebBundleTraceability({
  scope,
  manifest,
  manifestBytes,
  apkAssets,
  revision,
  apkBuiltAt,
  auditGeneratedAt,
  requireCleanRevision = false,
}) {
  const findings = [];
  const shippingPaths = sortedUnique((scope.shippingFiles || []).map(normalizePath));
  const manifestRows = manifest.files || [];
  const manifestPaths = manifestRows.map((row) => normalizePath(row.path));
  const manifestByPath = new Map(manifestRows.map((row) => [normalizePath(row.path), row]));
  const platformRows = manifest.platformGeneratedFiles || [];
  const platformPaths = platformRows.map((row) => normalizePath(row.path));
  const platformByPath = new Map(platformRows.map((row) => [normalizePath(row.path), row]));
  const actualPaths = sortedUnique([...apkAssets.keys()].map(normalizePath));
  const allowedPaths = new Set([...shippingPaths, ...platformPaths]);

  if (manifest.$schema !== "idlewuxia.web_bundle_manifest.v1") {
    findings.push(finding("WEB_MANIFEST_SCHEMA_MISMATCH", "web_bundle_manifest.json", manifest.$schema || "missing"));
  }
  if (manifest.status !== "pass" || (manifest.findings || []).length) {
    findings.push(finding("WEB_MANIFEST_NOT_PASSING", "web_bundle_manifest.json", "The three-layer manifest must pass with zero findings."));
  }
  if (manifestByPath.size !== manifestRows.length) {
    findings.push(finding("WEB_MANIFEST_DUPLICATE_PATH", "web_bundle_manifest.json", "Product file paths must be unique."));
  }
  if (platformByPath.size !== platformRows.length) {
    findings.push(finding("WEB_MANIFEST_DUPLICATE_PLATFORM_PATH", "web_bundle_manifest.json", "Platform-generated paths must be unique."));
  }
  if (JSON.stringify(sortedUnique(manifestPaths)) !== JSON.stringify(shippingPaths)) {
    findings.push(finding(
      "WEB_MANIFEST_SHIPPING_SET_MISMATCH",
      "web_bundle_manifest.json",
      "Manifest product paths differ from config/project_scope.json shippingFiles.",
    ));
  }
  if (!revision.commit || manifest.revision?.commit !== revision.commit) {
    findings.push(finding(
      "WEB_MANIFEST_COMMIT_MISMATCH",
      "web_bundle_manifest.json",
      "Manifest commit " + (manifest.revision?.commit || "missing") + " differs from current Git commit " + (revision.commit || "missing") + ".",
    ));
  }
  if (requireCleanRevision && revision.dirty) {
    findings.push(finding("GIT_WORKTREE_DIRTY", "git", "Formal APK audit requires a clean worktree, including no untracked source files."));
  }
  if (requireCleanRevision && manifest.revision?.dirty) {
    findings.push(finding("WEB_MANIFEST_REVISION_DIRTY", "web_bundle_manifest.json", "Formal APK audit requires a manifest produced from a clean worktree."));
  }

  const manifestTime = timestamp(manifest.generatedAt, "web_bundle_manifest.generatedAt", findings);
  const apkTime = timestamp(apkBuiltAt, "apk.builtAt", findings);
  const auditTime = timestamp(auditGeneratedAt, "audit.generatedAt", findings);
  if (manifestTime !== null && apkTime !== null && manifestTime > apkTime) {
    findings.push(finding("APK_BUILT_BEFORE_WEB_MANIFEST", "apk.builtAt", "APK must be built after the manifest used for traceability."));
  }
  if (apkTime !== null && auditTime !== null && apkTime > auditTime) {
    findings.push(finding("AUDIT_GENERATED_BEFORE_APK", "audit.generatedAt", "Audit report must be generated after the APK."));
  }

  const files = shippingPaths.map((relativePath) => {
    const manifestRow = manifestByPath.get(relativePath);
    const apkBytes = apkAssets.get(relativePath);
    const apk = digest(apkBytes);
    const expected = manifestRow?.expectedOutput || null;
    const android = manifestRow?.android || null;
    if (!manifestRow) {
      findings.push(finding("WEB_MANIFEST_PRODUCT_FILE_MISSING", relativePath, "Product file is absent from the web manifest."));
    } else if (!expected || !android || expected.sha256 !== android.sha256 || expected.bytes !== android.bytes) {
      findings.push(finding("WEB_MANIFEST_ANDROID_HASH_MISMATCH", relativePath, "Manifest expected-output and Android layer digests differ."));
    }
    if (!apkBytes) {
      findings.push(finding("APK_PRODUCT_ASSET_MISSING", relativePath, "Product file is absent from assets/public in the APK."));
    } else if (!expected || apk.sha256 !== expected.sha256 || apk.bytes !== expected.bytes) {
      findings.push(finding("APK_PRODUCT_ASSET_HASH_MISMATCH", relativePath, "APK product bytes differ from the web manifest expected output."));
    }
    return {
      path: relativePath,
      transform: manifestRow?.transform || null,
      manifestExpected: expected,
      manifestAndroid: android,
      apk,
      matches: Boolean(expected && apk && expected.sha256 === apk.sha256 && expected.bytes === apk.bytes),
    };
  });

  const platformGeneratedFiles = platformPaths.map((relativePath) => {
    const manifestRow = platformByPath.get(relativePath);
    const apkBytes = apkAssets.get(relativePath);
    const apk = digest(apkBytes);
    const expected = manifestRow?.expected || null;
    if (!apkBytes) {
      findings.push(finding("APK_PLATFORM_ASSET_MISSING", relativePath, "Declared platform-generated file is absent from the APK."));
    } else if (!expected || apk.sha256 !== expected.sha256 || apk.bytes !== expected.bytes) {
      findings.push(finding("APK_PLATFORM_ASSET_HASH_MISMATCH", relativePath, "APK platform-generated bytes differ from the web manifest."));
    }
    return {
      path: relativePath,
      producer: manifestRow?.producer || null,
      manifestExpected: expected,
      apk,
      matches: Boolean(expected && apk && expected.sha256 === apk.sha256 && expected.bytes === apk.bytes),
    };
  });

  const unexpectedAssets = actualPaths.filter((relativePath) => !allowedPaths.has(relativePath));
  for (const relativePath of unexpectedAssets) {
    findings.push(finding("APK_WEB_ASSET_UNEXPECTED", relativePath, "APK assets/public contains an undeclared file."));
  }

  const cleanRevision = !revision.dirty && !manifest.revision?.dirty;
  return {
    $schema: "idlewuxia.apk_web_bundle_traceability.v1",
    status: findings.length ? "fail" : "pass",
    formalReady: findings.length === 0 && cleanRevision,
    requireCleanRevision,
    revision: {
      current: revision,
      manifest: manifest.revision || null,
      matches: Boolean(revision.commit && manifest.revision?.commit === revision.commit),
      clean: cleanRevision,
    },
    timestamps: {
      manifestGeneratedAt: manifest.generatedAt || null,
      apkBuiltAt,
      auditGeneratedAt,
      ordered: Boolean(
        manifestTime !== null
        && apkTime !== null
        && auditTime !== null
        && manifestTime <= apkTime
        && apkTime <= auditTime
      ),
    },
    manifest: {
      sha256: digest(manifestBytes)?.sha256 || null,
      bytes: manifestBytes?.length ?? null,
      status: manifest.status || null,
      summary: manifest.summary || null,
    },
    summary: {
      productFiles: shippingPaths.length,
      productFilesMatched: files.filter((row) => row.matches).length,
      platformGeneratedFiles: platformPaths.length,
      platformGeneratedFilesMatched: platformGeneratedFiles.filter((row) => row.matches).length,
      apkWebAssets: actualPaths.length,
      unexpectedAssets: unexpectedAssets.length,
      findings: findings.length,
    },
    files,
    platformGeneratedFiles,
    unexpectedAssets,
    findings,
  };
}
