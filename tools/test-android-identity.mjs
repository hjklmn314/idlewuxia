import assert from "node:assert/strict";
import { evaluateAndroidIdentity } from "./lib/android-identity.mjs";

const contract = {
  applicationId: "com.idlewuxia.app",
  debugApplicationIdSuffix: ".debug",
  debugApplicationId: "com.idlewuxia.app.debug",
  namespace: "com.idlewuxia.app",
  javaPackage: "com.idlewuxia.app",
  launcherClass: "com.idlewuxia.app.MainActivity",
  appName: "Idle Wuxia",
  versionCode: 1,
  versionName: "0.1.0",
  debugVersionNameSuffix: "-p0-debug",
  paths: {
    capacitor: "capacitor.config.json",
    gradle: "android/app/build.gradle",
    manifest: "android/app/src/main/AndroidManifest.xml",
    strings: "android/app/src/main/res/values/strings.xml",
    mainActivity: "android/app/src/main/java/com/idlewuxia/app/MainActivity.java",
    unitTest: "android/app/src/test/java/com/idlewuxia/app/ExampleUnitTest.java",
    instrumentedTest: "android/app/src/androidTest/java/com/idlewuxia/app/ExampleInstrumentedTest.java",
    apkAudit: "tools/audit-android-debug.mjs",
    mobileShellAudit: "tools/validate-mobile-shell.mjs",
  },
  deprecatedTrackedPaths: ["android/app/src/main/java/com/infinitygames/dotcollect/MainActivity.java"],
  runtimeScanExact: ["capacitor.config.json", "tools/audit-android-debug.mjs", "tools/validate-mobile-shell.mjs", "config/evidence.json"],
  runtimeScanPrefixes: ["android/"],
  forbiddenRuntimeTokens: ["com.infinitygames.dotcollect", "Idle Dot Shooter"],
  evidenceOnlyIdentityFiles: ["config/evidence.json"],
};

const validFiles = {
  "capacitor.config.json": JSON.stringify({ appId: contract.applicationId, appName: contract.appName }),
  "android/app/build.gradle": `namespace "${contract.namespace}"\napplicationId "${contract.applicationId}"\nversionCode 1\nversionName "0.1.0"\napplicationIdSuffix ".debug"\nversionNameSuffix "-p0-debug"`,
  "android/app/src/main/AndroidManifest.xml": '<activity android:name=".MainActivity"/><provider android:authorities="${applicationId}.fileprovider"/>',
  "android/app/src/main/res/values/strings.xml": `<string name="app_name">${contract.appName}</string><string name="title_activity_main">${contract.appName}</string><string name="package_name">${contract.applicationId}</string><string name="custom_url_scheme">${contract.applicationId}</string>`,
  "android/app/src/main/java/com/idlewuxia/app/MainActivity.java": `package ${contract.javaPackage};`,
  "android/app/src/test/java/com/idlewuxia/app/ExampleUnitTest.java": `package ${contract.javaPackage};`,
  "android/app/src/androidTest/java/com/idlewuxia/app/ExampleInstrumentedTest.java": `package ${contract.javaPackage}; assertEquals("${contract.debugApplicationId}", appContext.getPackageName());`,
  "tools/audit-android-debug.mjs": 'read("android_identity_contract.json"); read("project_scope.json");',
  "tools/validate-mobile-shell.mjs": 'read("android_identity_contract.json"); identity.paths.mainActivity;',
  "config/evidence.json": "com.infinitygames.dotcollect",
};

function evaluate(overrides = {}) {
  const files = overrides.files || validFiles;
  return evaluateAndroidIdentity({
    contract: overrides.contract || contract,
    files,
    trackedFiles: overrides.trackedFiles || Object.keys(files),
  });
}

assert.equal(evaluate().pass, true, "valid identity closure must pass");

const capacitorMismatch = evaluate({
  files: { ...validFiles, "capacitor.config.json": JSON.stringify({ appId: "com.wrong.app", appName: contract.appName }) },
});
assert.ok(capacitorMismatch.findings.some((row) => row.code === "CAPACITOR_ID_MISMATCH"));

const gradleMismatch = evaluate({
  files: { ...validFiles, "android/app/build.gradle": validFiles["android/app/build.gradle"].replace(contract.applicationId, "com.wrong.app") },
});
assert.ok(gradleMismatch.findings.some((row) => row.code === "GRADLE_IDENTITY_MISMATCH"));

const legacyPath = evaluate({
  files: { ...validFiles, "android/app/src/main/java/com/infinitygames/dotcollect/MainActivity.java": "legacy" },
});
assert.ok(legacyPath.findings.some((row) => row.code === "DEPRECATED_IDENTITY_PATH"));

const legacyToken = evaluate({
  files: { ...validFiles, "tools/audit-android-debug.mjs": `${validFiles["tools/audit-android-debug.mjs"]}\nIdle Dot Shooter` },
});
assert.ok(legacyToken.findings.some((row) => row.code === "FORBIDDEN_RUNTIME_IDENTITY"));

const evidenceAllowed = evaluate({ trackedFiles: [...Object.keys(validFiles), "config/evidence.json"] });
assert.equal(evidenceAllowed.pass, true, "evidence-only identity must not contaminate runtime scan");

const invalidContract = evaluate({ contract: { ...contract, debugApplicationId: "com.wrong.debug" } });
assert.ok(invalidContract.findings.some((row) => row.code === "INVALID_CONTRACT"));

console.log("android identity contract tests: PASS (7 cases)");
