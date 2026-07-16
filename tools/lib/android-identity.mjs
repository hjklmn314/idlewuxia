function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function add(findings, code, subject, message) {
  findings.push({ severity: "P0", code, subject, message });
}

function capture(text, pattern) {
  return text.match(pattern)?.[1] || "";
}

function xmlString(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return capture(text, new RegExp(`<string\\s+name=["']${escaped}["']>([^<]*)<\\/string>`));
}

function isRuntimeIdentityFile(file, contract) {
  return (contract.runtimeScanExact || []).map(normalizePath).includes(file) ||
    (contract.runtimeScanPrefixes || []).map(normalizePath).some((prefix) => file.startsWith(prefix));
}

export function evaluateAndroidIdentity({ contract, files, trackedFiles }) {
  const findings = [];
  const tracked = [...new Set((trackedFiles || []).map(normalizePath))].sort();
  const trackedSet = new Set(tracked);
  const fileMap = new Map(Object.entries(files || {}).map(([file, text]) => [normalizePath(file), String(text)]));
  const paths = Object.fromEntries(Object.entries(contract.paths || {}).map(([key, file]) => [key, normalizePath(file)]));

  if (contract.debugApplicationId !== `${contract.applicationId}${contract.debugApplicationIdSuffix}`) {
    add(findings, "INVALID_CONTRACT", "debugApplicationId", "Debug application ID must equal applicationId plus suffix.");
  }
  if (contract.namespace !== contract.applicationId || contract.javaPackage !== contract.applicationId) {
    add(findings, "INVALID_CONTRACT", "namespace", "Namespace, Java package, and applicationId must be identical.");
  }
  if (contract.launcherClass !== `${contract.javaPackage}.MainActivity`) {
    add(findings, "INVALID_CONTRACT", "launcherClass", "Launcher class must be MainActivity inside javaPackage.");
  }

  for (const [consumer, file] of Object.entries(paths)) {
    if (!trackedSet.has(file) || !fileMap.has(file)) {
      add(findings, "MISSING_IDENTITY_CONSUMER", file || consumer, `Required identity consumer ${consumer} is missing or untracked.`);
    }
  }
  for (const file of contract.deprecatedTrackedPaths || []) {
    const normalized = normalizePath(file);
    if (trackedSet.has(normalized)) {
      add(findings, "DEPRECATED_IDENTITY_PATH", normalized, "Legacy package path is still tracked.");
    }
  }

  const capacitorText = fileMap.get(paths.capacitor) || "{}";
  try {
    const capacitor = JSON.parse(capacitorText.replace(/^\uFEFF/, ""));
    if (capacitor.appId !== contract.applicationId) {
      add(findings, "CAPACITOR_ID_MISMATCH", paths.capacitor, `Expected appId ${contract.applicationId}; found ${capacitor.appId}.`);
    }
    if (capacitor.appName !== contract.appName) {
      add(findings, "APP_NAME_MISMATCH", paths.capacitor, `Expected appName ${contract.appName}; found ${capacitor.appName}.`);
    }
  } catch (error) {
    add(findings, "INVALID_IDENTITY_CONSUMER", paths.capacitor, `Invalid Capacitor JSON: ${error.message}`);
  }

  const gradle = fileMap.get(paths.gradle) || "";
  const gradleExpectations = [
    ["namespace", capture(gradle, /\bnamespace\s+["']([^"']+)["']/), contract.namespace],
    ["applicationId", capture(gradle, /\bapplicationId\s+["']([^"']+)["']/), contract.applicationId],
    ["applicationIdSuffix", capture(gradle, /\bapplicationIdSuffix\s+["']([^"']+)["']/), contract.debugApplicationIdSuffix],
    ["versionName", capture(gradle, /\bversionName\s+["']([^"']+)["']/), contract.versionName],
    ["versionNameSuffix", capture(gradle, /\bversionNameSuffix\s+["']([^"']+)["']/), contract.debugVersionNameSuffix],
    ["versionCode", Number(capture(gradle, /\bversionCode\s+(\d+)/)), Number(contract.versionCode)],
  ];
  for (const [field, actual, expected] of gradleExpectations) {
    if (actual !== expected) add(findings, "GRADLE_IDENTITY_MISMATCH", `${paths.gradle}:${field}`, `Expected ${expected}; found ${actual || "missing"}.`);
  }

  const strings = fileMap.get(paths.strings) || "";
  for (const [name, expected] of [
    ["app_name", contract.appName],
    ["title_activity_main", contract.appName],
    ["package_name", contract.applicationId],
    ["custom_url_scheme", contract.applicationId],
  ]) {
    const actual = xmlString(strings, name);
    if (actual !== expected) add(findings, "ANDROID_RESOURCE_IDENTITY_MISMATCH", `${paths.strings}:${name}`, `Expected ${expected}; found ${actual || "missing"}.`);
  }

  for (const key of ["mainActivity", "unitTest", "instrumentedTest"]) {
    const text = fileMap.get(paths[key]) || "";
    const actualPackage = capture(text, /^\s*package\s+([\w.]+)\s*;/m);
    if (actualPackage !== contract.javaPackage) {
      add(findings, "JAVA_PACKAGE_MISMATCH", paths[key], `Expected package ${contract.javaPackage}; found ${actualPackage || "missing"}.`);
    }
  }
  const instrumentedTest = fileMap.get(paths.instrumentedTest) || "";
  if (!instrumentedTest.includes(`assertEquals("${contract.debugApplicationId}", appContext.getPackageName())`)) {
    add(findings, "INSTRUMENTED_TARGET_MISMATCH", paths.instrumentedTest, `Instrumented test must assert ${contract.debugApplicationId}.`);
  }

  const manifest = fileMap.get(paths.manifest) || "";
  if (!manifest.includes('android:name=".MainActivity"')) {
    add(findings, "MANIFEST_LAUNCHER_MISMATCH", paths.manifest, "Manifest must use namespace-relative .MainActivity.");
  }
  if (!manifest.includes('android:authorities="${applicationId}.fileprovider"')) {
    add(findings, "MANIFEST_PROVIDER_MISMATCH", paths.manifest, "FileProvider authority must derive from applicationId.");
  }

  const apkAudit = fileMap.get(paths.apkAudit) || "";
  if (!apkAudit.includes("android_identity_contract.json") || !apkAudit.includes("project_scope.json")) {
    add(findings, "AUDIT_NOT_CONTRACT_DRIVEN", paths.apkAudit, "APK audit must consume identity and shipping-scope contracts.");
  }
  const mobileAudit = fileMap.get(paths.mobileShellAudit) || "";
  if (!mobileAudit.includes("android_identity_contract.json") || !mobileAudit.includes("identity.paths.mainActivity")) {
    add(findings, "AUDIT_NOT_CONTRACT_DRIVEN", paths.mobileShellAudit, "Mobile shell audit must derive MainActivity from the identity contract.");
  }

  const evidenceExceptions = new Set((contract.evidenceOnlyIdentityFiles || []).map(normalizePath));
  for (const file of tracked) {
    if (!isRuntimeIdentityFile(file, contract) || evidenceExceptions.has(file)) continue;
    const text = fileMap.get(file) || "";
    for (const token of contract.forbiddenRuntimeTokens || []) {
      if (text.toLowerCase().includes(token.toLowerCase())) {
        add(findings, "FORBIDDEN_RUNTIME_IDENTITY", file, `Forbidden legacy identity token remains: ${token}`);
      }
    }
  }

  return {
    schema: "idlewuxia.android_identity_result.v1",
    pass: findings.length === 0,
    applicationId: contract.applicationId,
    debugApplicationId: contract.debugApplicationId,
    launcherClass: contract.launcherClass,
    appName: contract.appName,
    trackedFileCount: tracked.length,
    findings,
  };
}
