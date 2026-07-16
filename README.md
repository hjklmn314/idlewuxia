# idlewuxia

Data-driven vertical Wuxia idle RPG prototype. Competitor research and restored Fangzhi Jianghu evidence are development evidence only and are excluded from the shipping runtime.

## Common commands

```bash
npm run start
npm run task:preflight
npm run baseline:build
npm run build:web
npm run wuxia:check:fast
```

`config/project_scope.json` is the machine-readable source of truth for the
active entry, runtime configs, development-only evidence, tracked path
categories, and exact web shipping closure. See `PROJECT_BASELINE.md` for the
R0 gate and release procedure.

## Repository scope

This public repository contains the active development source, configuration,
build tooling, native project text files, and project Markdown. Restored
competitor evidence, APKs, databases, generated outputs, reference captures,
and generated media remain local and are intentionally excluded from Git.

The runtime loads only the two active first-session contracts declared in the
scope file. The web build copies an explicit seven-file allowlist; it does not
copy the complete `src/`, `config/`, or `public/` trees. Development evidence
stays in source JSON for auditability; the build recursively removes local and
competitor evidence paths from the two shipping JSON files.

## Git workflow

- Before starting a task, confirm the tree is clean and run
  `git pull --ff-only origin main`.
- At task completion, run the relevant validation, inspect the diff, stage only
  files belonging to the task, commit, and push to `origin`.
- Never force-push or commit local evidence/build outputs.
