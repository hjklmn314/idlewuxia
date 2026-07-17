# Android Device Acceptance

T01-04 proves that the audited APK works on an Android device, not merely that
its package and embedded bytes are correct. The gate installs the APK, clears
application data, exercises a player-visible first-session action, and verifies
state through Android lifecycle destruction and process restart.

## Deep modules and data contract

`config/android_device_acceptance_contract.json` owns the 540x960 reference
aspect, expected first-session states, normalized player tap, settle times, and
blocking log patterns. The normalized tap is converted with the live WebView
viewport and device pixel ratio; it is not tied to one emulator resolution.

`tools/run-android-device-acceptance.mjs` is the device adapter. Its interface
is one command with an APK, ADB executable, and explicit device serial. It owns
installation, clean-data setup, WebView inspection, ADB input, lifecycle
transitions, screenshots, log capture, assertions, and the machine report.

`src/runtimePersistence.js` is the save module. Its `restore` and `attach`
interface hides localStorage access, versioned envelopes, invalid-save
recovery, event-history limits, autosave wrapping, and storage failure
isolation. `createFirstSessionRuntime` exports and hydrates only mutable runtime
state; chapter/config definitions are never duplicated into the save.

## Command

Build an APK first, then name one device explicitly:

```powershell
npm run android:debug
npm run device:validate -- --adb "D:\path\to\adb.exe" --serial emulator-5554 --apk outputs\idlewuxia-debug.apk
```

Environment variables `IDLEWUXIA_ADB_PATH` and `IDLEWUXIA_ADB_SERIAL` may be
used instead of the two command arguments. The tool never picks the first
connected device implicitly.

## Blocking cases

- Cold start renders `STATE_FS_001_OPENING_STORY` without an error panel.
- Live viewport has the same 9:16 aspect as the 540x960 reference.
- A real ADB tap selects `武学世家`, reaches `STATE_FS_001_ORIGIN_RESULT`, and
  records `saved` persistence status.
- HOME background/foreground retains state.
- Lock/unlock reaches real `Asleep`/`Awake` power states and retains state.
- Android Back followed by relaunch restores the selected origin.
- Force-stop followed by relaunch restores the selected origin and final focus.
- Device log has no configured fatal, ANR, network, or uncaught script pattern.

Generated APKs, logs, screenshots, video, and reports remain under `outputs/`
and are intentionally ignored. The authoritative machine report is
`outputs/android_device_acceptance/latest/device_acceptance_report.json` unless
an explicit `--output` directory is supplied.

T01-04 is complete only when the report has `status=pass`, all seven cases pass,
findings are empty, the tested APK SHA-256 equals the formal clean-revision APK
audit, and retained screenshots/video/logs correspond to that same APK.
