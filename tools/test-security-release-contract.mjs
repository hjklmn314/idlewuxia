import assert from "node:assert/strict";
import { auditMergedAndroidManifest, auditSecurityDocuments } from "./lib/security-release.mjs";
import contract from "../config/production/security_release_contract.json" with { type: "json" };

const csp = Object.entries(contract.web.requiredCspDirectives).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
const base = {
  contract,
  html: `<meta http-equiv="Content-Security-Policy" content="${csp}"><script src="app.js"></script>`,
  manifestXml: `<manifest><application android:allowBackup="false" android:fullBackupContent="false" android:usesCleartextTraffic="false"><activity android:name=".MainActivity" android:exported="true"></activity><provider android:name="FileProvider" android:exported="false"></provider></application></manifest>`,
  filePathsXml: `<paths><files-path name="files" path="shared/"/><cache-path name="cache" path="shared/"/></paths>`,
  analytics: { privacy: { class: "technical_no_pii", forbiddenFields: contract.privacy.forbiddenFields }, retention: { persistence: "memory_only", upload: "disabled", maxEvents: 512 } },
  packageJson: { dependencies: { "@capacitor/android": "1", "@capacitor/core": "1" } },
  runtimeTexts: [{ file: "src/app.js", content: "export const ok = true;" }],
  trackedFiles: ["package-lock.json"],
  scannedTexts: [{ file: "src/app.js", content: "export const ok = true;" }],
};
assert.equal(auditSecurityDocuments(base).pass, true);

const withPermission = structuredClone(base);
withPermission.manifestXml = withPermission.manifestXml.replace("<manifest>", `<manifest><uses-permission android:name="android.permission.CAMERA"/>`);
assert.equal(auditSecurityDocuments(withPermission).findings.some((row) => row.type === "android-permission-mismatch"), true);

const withExternalPath = structuredClone(base);
withExternalPath.filePathsXml = `<paths><external-path name="all" path="."/></paths>`;
assert.equal(auditSecurityDocuments(withExternalPath).findings.some((row) => row.type === "unsafe-file-provider-path"), true);

const withoutPrivatePaths = structuredClone(base);
withoutPrivatePaths.filePathsXml = `<paths></paths>`;
assert.equal(auditSecurityDocuments(withoutPrivatePaths).findings.some((row) => row.type === "file-provider-path-mismatch"), true);

const withoutExplicitBackupBoundary = structuredClone(base);
withoutExplicitBackupBoundary.manifestXml = withoutExplicitBackupBoundary.manifestXml.replace(` android:allowBackup="false"`, "");
assert.equal(auditSecurityDocuments(withoutExplicitBackupBoundary).findings.some((row) => row.type === "android-application-attribute-mismatch" && row.actual === null), true);

const withoutLauncher = structuredClone(base);
withoutLauncher.manifestXml = withoutLauncher.manifestXml.replace(` android:exported="true"`, ` android:exported="false"`);
assert.equal(auditSecurityDocuments(withoutLauncher).findings.some((row) => row.type === "exported-component-mismatch"), true);

const withSecret = structuredClone(base);
withSecret.scannedTexts = [{ file: "src/app.js", content: "const key='sk_live_abcdefghijklmnop';" }];
assert.equal(auditSecurityDocuments(withSecret).findings.some((row) => row.type === "embedded-secret-pattern"), true);

const withInlineScript = structuredClone(base);
withInlineScript.html += "<script>alert(1)</script>";
assert.equal(auditSecurityDocuments(withInlineScript).findings.some((row) => row.type === "inline-script-present"), true);

const merged = `<manifest><uses-permission android:name="com.idlewuxia.app.debug.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"/><application><activity android:name="com.idlewuxia.app.MainActivity" android:exported="true"></activity><receiver android:name="androidx.profileinstaller.ProfileInstallReceiver" android:exported="true" android:permission="android.permission.DUMP"></receiver></application></manifest>`;
assert.equal(auditMergedAndroidManifest(contract, merged).pass, true);
assert.equal(auditMergedAndroidManifest(contract, merged.replace("</manifest>", `<uses-permission android:name="android.permission.INTERNET"/></manifest>`)).findings.some((row) => row.type === "merged-android-permission-unapproved"), true);
assert.equal(auditMergedAndroidManifest(contract, merged.replace("</application>", `<receiver android:name="unsafe.PublicReceiver" android:exported="true"></receiver></application>`)).findings.some((row) => row.type === "merged-exported-component-unapproved"), true);

console.log("security release contract tests: PASS (CSP, permission, explicit app attributes, provider, exported component, secret and inline-script negative paths)");
