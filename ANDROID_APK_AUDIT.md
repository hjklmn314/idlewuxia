# Android APK Traceability Audit

T01-03 proves that the real Debug APK contains the exact Web bytes declared by
the current Git revision's three-layer bundle manifest. File presence alone is
not sufficient.

## Deep module and adapter

`tools/lib/apk-web-bundle-traceability.mjs` exposes one evaluation
interface. It owns commit matching, evidence ordering, product and platform
asset hashing, unexpected asset detection, and formal readiness.

`tools/build-android-debug.ps1` owns the serial Gradle build and publication
of `outputs/idlewuxia-debug.apk`. `tools/audit-android-debug.mjs` is a
read-only APK adapter: it verifies the published copy matches Gradle output,
extracts the actual APK, scans Android identity and forbidden terms, reads Git
and the bundle manifest, and writes the report. Each process uses an isolated
temporary extraction directory so repeated audits cannot delete one another's
files. Tests cross the same deep-module interface with in-memory APK assets.

## Evidence chain

The formal chain is:

`clean Git commit -> passing web_bundle_manifest -> built APK -> audit report`.

The manifest must belong to the current commit. Its generation time must not be
later than the APK build time, and the audit generation time must not be earlier
than the APK. All seven product assets and both declared Capacitor-generated
assets are hashed from the extracted APK. Any undeclared file under
`assets/public` is blocking.

## Commands

```bash
npm run apk:traceability:test
npm run android:debug
npm run android:audit:wuxia
```

`android:debug` rebuilds the web bundle, syncs Android, forces Gradle
packaging tasks to rerun, and runs a development audit. The forced packaging is
intentional: an `UP-TO-DATE` result could otherwise leave an APK whose
timestamp predates the new manifest. During active edits this report may pass
byte checks while `formalAudit.ready=false` because the tracked worktree is
dirty.

`android:audit:wuxia` is the formal clean-revision gate. Run it after the
task commit and a fresh `android:debug` build. It rejects tracked or
untracked Git changes, a dirty or foreign manifest, unordered evidence, missing
assets, changed bytes, and unexpected APK web assets.

The ignored evidence files are:

```text
outputs/android_debug_apk_audit.json
outputs/idlewuxia_android_debug_build.md
outputs/idlewuxia-debug.apk
```

T01-03 is complete only when the JSON report has `status=pass`,
`formalAudit.ready=true`, the report and manifest revisions match the
current clean commit, product hashes are `7/7`, platform hashes are
`2/2`, evidence timestamps are ordered, unexpected assets are zero, and
findings are zero. This does not replace T01-04 device acceptance.
