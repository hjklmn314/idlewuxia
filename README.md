# idlewuxia

Data-driven vertical Wuxia idle RPG prototype. Competitor research and restored Fangzhi Jianghu evidence are archived under `fangzhijianghu/`.

## Common commands

```bash
npm run start
npm run wuxia:check:fast
```

## Repository scope

This public repository contains the active development source, configuration,
build tooling, native project text files, and project Markdown. Restored
competitor evidence, APKs, databases, generated outputs, reference captures,
and generated media remain local and are intentionally excluded from Git.

## Git workflow

- Before starting a task, confirm the tree is clean and run
  `git pull --ff-only origin main`.
- At task completion, run the relevant validation, inspect the diff, stage only
  files belonging to the task, commit, and push to `origin`.
- Never force-push or commit local evidence/build outputs.
