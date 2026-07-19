# idlewuxia

Data-driven vertical Wuxia idle RPG prototype. Competitor research and restored Fangzhi Jianghu evidence are development evidence only and are excluded from the shipping runtime.

## Common commands

```bash
npm run start
npm run production:validate
npm run production:inventory
npm run production:report
npm run task:preflight
npm run runtime:condition-negative
npm run runtime:first-session-simulator:test
npm run baseline:build
npm run build:web
npm run android:sync
npm run web:freshness
npm run android:identity
npm run android:debug
npm run android:audit:wuxia
npm run device:validate -- --adb <adb-path> --serial <device-serial>
npm run wuxia:check:fast
```

`config/project_scope.json` is the machine-readable source of truth for the
active entry, runtime configs, development-only evidence, tracked path
categories, and exact web shipping closure. See `PROJECT_BASELINE.md` for the
R0 gate and release procedure.

`config/production/production_stage_plan.json` is the machine-readable
production-to-release authority for G0-G7, task dependencies, acceptance
evidence, postponed scope, UI/UX, subsystem, asset, and toolchain work. Start
from `docs/codex_game_development_os/README.md`. Generated production reports
under `outputs/production_os/` are evidence only and remain excluded from Git.

`config/android_identity_contract.json` is the single source of truth for the
Capacitor and Android application identity. See `ANDROID_IDENTITY.md` before
changing the package name, Java path, app label, launcher, or debug suffix.

`config/web_bundle_contract.json` defines the source, `www`, and Android
asset roots plus the explicit Capacitor-generated file allowlist. Run
`npm run android:sync` to rebuild, sync, and SHA-256-check the complete chain.
See `WEB_BUNDLE_FRESHNESS.md` for the transform and acceptance rules.

`npm run android:audit:wuxia` is the clean-revision APK traceability
gate. It hashes every scope-declared product asset and both Capacitor-generated assets
from the real APK and binds them to the current Git commit and Web manifest.
See `ANDROID_APK_AUDIT.md` for evidence ordering and formal acceptance.

`config/runtime_persistence_contract.json` owns the versioned save envelope,
storage key, retained event limit, and lifecycle autosave policy. Runtime code
exports only mutable first-session state; `src/runtimePersistence.js` owns
restore, compatibility rejection, storage isolation, and autosave wrapping.

`npm run runtime:condition-negative` is the T02-01 interactable branch gate.
It covers exact and unhinted fallback branches, exact-versus-fallback conflicts,
multiple simultaneously satisfied branches, repeat attempts, save restoration,
and the Web item-panel presentation. An unmet configured condition must append
one rejection audit event while leaving every other observable runtime field
unchanged. Availability and execution consume the same selected branch;
missing evidence remains `unknown`; the Web UI disables unavailable actions,
shows the requirement, and renders rejection feedback. The corresponding
satisfied branch still executes. `npm run runtime:first-session-simulator:test`
guards the real first-session action order and distinguishes the intentional
locked-action rejection from unexpected failures or acceptances.

`config/android_device_acceptance_contract.json` owns the 540x960 reference
aspect, player action, and lifecycle expectations. See
`ANDROID_DEVICE_ACCEPTANCE.md` for the reproducible T01-04 device gate.

## Repository scope

This public repository contains the active development source, configuration,
build tooling, native project text files, and project Markdown. Restored
competitor evidence, APKs, databases, generated outputs, reference captures,
and generated media remain local and are intentionally excluded from Git.

The runtime loads only the active first-session contracts declared in the
scope file. The web build materializes an explicit shipping allowlist; it does not
copy the complete `src/`, `config/`, or `public/` trees. Development evidence
stays in source JSON for auditability; the build recursively removes local and
competitor evidence paths from all shipping JSON files.

## Git workflow

- Before starting a task, confirm the tree is clean and run
  `git pull --ff-only origin main`.
- At task completion, run the relevant validation, inspect the diff, stage only
  files belonging to the task, commit, and push to `origin`.
- Never force-push or commit local evidence/build outputs.
