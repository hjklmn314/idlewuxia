import path from "node:path";

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  { id: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "aws-access-key", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { id: "github-token", regex: /\bgh[opsu]_[A-Za-z0-9]{30,}\b/ },
  { id: "google-api-key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "stripe-live-key", regex: /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/ },
];

export function parseCsp(value) {
  const directives = {};
  for (const part of String(value || "").split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) directives[tokens[0]] = tokens.slice(1);
  }
  return directives;
}

export function extractCspFromHtml(html) {
  return html.match(/<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content="([^"]+)"[^>]*>/i)?.[1] || "";
}

export function extractAndroidPermissions(manifestXml) {
  return [...manifestXml.matchAll(/<uses-permission\b[^>]*android:name=["']([^"']+)["'][^>]*\/?\s*>/g)].map((match) => match[1]).sort();
}

export function extractExportedComponents(manifestXml) {
  const rows = [];
  for (const match of manifestXml.matchAll(/<(activity|activity-alias|service|receiver|provider)\b([^>]*)>/g)) {
    if (!/android:exported=["']true["']/.test(match[2])) continue;
    rows.push({
      type: match[1],
      name: match[2].match(/android:name=["']([^"']+)["']/)?.[1] || "",
      permission: match[2].match(/android:permission=["']([^"']+)["']/)?.[1] || "",
    });
  }
  return rows;
}

export function extractFileProviderPathElements(xml) {
  return [...xml.matchAll(/<([a-z-]+)\b[^>]*\/>/g)].map((match) => match[1]).sort();
}

export function auditMergedAndroidManifest(contract, manifestXml) {
  const findings = [];
  const permissions = extractAndroidPermissions(manifestXml);
  for (const permission of permissions) {
    const allowed = contract.android.allowedPermissions.includes(permission)
      || contract.android.allowedMergedPermissionPatterns.some((pattern) => new RegExp(pattern).test(permission));
    if (!allowed) findings.push({ severity: "P0", type: "merged-android-permission-unapproved", permission });
  }
  const exported = extractExportedComponents(manifestXml);
  for (const component of exported) {
    const allowed = contract.android.allowedMergedExportedComponents.some((rule) => new RegExp(rule.namePattern).test(component.name) && rule.requiredPermission === component.permission);
    if (!allowed) findings.push({ severity: "P0", type: "merged-exported-component-unapproved", component });
  }
  return { pass: findings.length === 0, permissions, exported, findings };
}

function sameMembers(left, right) {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

export function auditSecurityDocuments({ contract, html, manifestXml, filePathsXml, analytics, packageJson, runtimeTexts, trackedFiles, scannedTexts }) {
  const findings = [];
  const cspValue = extractCspFromHtml(html);
  const csp = parseCsp(cspValue);
  if (!cspValue) findings.push({ severity: "P0", type: "csp-missing" });
  for (const [directive, expected] of Object.entries(contract.web.requiredCspDirectives)) {
    if (!sameMembers(csp[directive] || [], expected)) findings.push({ severity: "P0", type: "csp-directive-mismatch", directive, expected, actual: csp[directive] || [] });
  }
  if (!contract.web.inlineScriptAllowed && /<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) findings.push({ severity: "P0", type: "inline-script-present" });

  const permissions = extractAndroidPermissions(manifestXml);
  if (!sameMembers(permissions, contract.android.allowedPermissions)) findings.push({ severity: "P0", type: "android-permission-mismatch", expected: contract.android.allowedPermissions, actual: permissions });
  for (const [attribute, expected] of [["allowBackup", contract.android.allowBackup], ["fullBackupContent", contract.android.fullBackupContent], ["usesCleartextTraffic", contract.android.usesCleartextTraffic]]) {
    const raw = manifestXml.match(new RegExp(`android:${attribute}=["'](true|false)["']`))?.[1];
    const actual = raw === undefined ? null : raw === "true";
    if (actual !== expected) findings.push({ severity: "P0", type: "android-application-attribute-mismatch", attribute, expected, actual });
  }
  const exported = extractExportedComponents(manifestXml);
  const exportedNames = exported.map((row) => row.name);
  if (!sameMembers(exportedNames, contract.android.allowedExportedComponents)) findings.push({ severity: "P0", type: "exported-component-mismatch", expected: contract.android.allowedExportedComponents, actual: exportedNames });
  const pathElements = extractFileProviderPathElements(filePathsXml);
  if (!sameMembers(pathElements, contract.android.allowedFileProviderPathElements)) findings.push({ severity: "P0", type: "file-provider-path-mismatch", expected: contract.android.allowedFileProviderPathElements, actual: pathElements });
  for (const element of pathElements.filter((entry) => contract.android.forbiddenFileProviderPathElements.includes(entry))) findings.push({ severity: "P0", type: "unsafe-file-provider-path", element });

  if (analytics.privacy?.class !== contract.privacy.dataClass) findings.push({ severity: "P0", type: "privacy-class-mismatch" });
  if (analytics.retention?.persistence !== contract.privacy.analyticsPersistence) findings.push({ severity: "P0", type: "analytics-persistence-mismatch" });
  if (analytics.retention?.upload !== contract.privacy.analyticsUpload) findings.push({ severity: "P0", type: "analytics-upload-mismatch" });
  if (analytics.retention?.maxEvents !== contract.privacy.maxAnalyticsEvents) findings.push({ severity: "P1", type: "analytics-retention-cap-mismatch" });
  for (const field of contract.privacy.forbiddenFields) {
    if (!analytics.privacy?.forbiddenFields?.includes(field)) findings.push({ severity: "P0", type: "privacy-forbidden-field-missing", field });
  }

  const dependencies = Object.keys(packageJson.dependencies || {}).sort();
  if (!sameMembers(dependencies, contract.dependencyPolicy.allowedRuntimePackages)) findings.push({ severity: "P0", type: "runtime-dependency-allowlist-mismatch", expected: contract.dependencyPolicy.allowedRuntimePackages, actual: dependencies });
  if (contract.dependencyPolicy.lockfileRequired && !trackedFiles.includes("package-lock.json")) findings.push({ severity: "P0", type: "lockfile-not-tracked" });
  for (const forbidden of contract.secrets.forbiddenTrackedFiles) {
    if (trackedFiles.some((file) => path.basename(file).toLowerCase() === path.basename(forbidden).toLowerCase())) findings.push({ severity: "P0", type: "forbidden-secret-file-tracked", file: forbidden });
  }
  for (const { file, content } of scannedTexts) {
    for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) {
      if (pattern.regex.test(content)) findings.push({ severity: "P0", type: "embedded-secret-pattern", pattern: pattern.id, file });
    }
  }
  const combinedRuntime = runtimeTexts.map((row) => row.content.toLowerCase()).join("\n");
  for (const token of contract.externalServices.forbiddenClientSdkTokens) {
    if (combinedRuntime.includes(token.toLowerCase())) findings.push({ severity: "P0", type: "forbidden-client-sdk-token", token });
  }
  return {
    pass: findings.length === 0,
    csp,
    permissions,
    exported,
    fileProviderPathElements: pathElements,
    runtimeDependencies: dependencies,
    scannedFileCount: scannedTexts.length,
    findings,
  };
}
