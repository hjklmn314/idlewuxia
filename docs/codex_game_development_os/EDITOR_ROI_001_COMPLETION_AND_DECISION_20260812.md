# EDITOR-ROI-001 Chapter Authoring ROI Decision

Date: 2026-08-12

Task: `EDITOR-ROI-001`

Owner: `editor-framework-architect`

Independent acceptance owner: `qa-bot-regression-engineer`

Machine authority: `config/production/editor_roi_decision.json`

## Verdict

**PASS WITH KNOWN LIMITATIONS.**

The selected production workflow is **validated script tooling over the
existing JSON authority**. A specialized visual editor is deliberately
deferred. The project now has a deterministic, read-only authoring inspection
path for chapter packages: Schema and semantic validation, compact preview,
semantic diff, external Encounter allowlisting and hash-verified rollback
evidence.

This decision closes `EDITOR-ROI-001` and advances `G6` to `pass`, together
with the already completed `CONTENT-001`. It does not close any asset, combat
presentation, manual product visual, Android device or Release gate.

## 1. Known facts and measurements

The decision was measured at commit
`4c9c6fbb8327a9f96dea0f3e87236e12662659df`.

| Measurement | Result |
|---|---:|
| Active chapter authority | `config/wuxia_first_session_flow.json` |
| Active chapter size | 1,012,574 bytes / 31,503 lines |
| Active chapter content | 7 nodes / 45 rooms / 116 NPCs / 23 interactables |
| Active chapter Git history | 15 commits / 31,684 added / 181 deleted lines |
| Combat authority | 36,355 bytes |
| Generic chapter Schema | one test package / zero production packages |
| Schema extension policy | `additionalProperties` remains permitted |

The repeated, high-risk costs are cross-reference integrity, reviewing a large
JSON authority, proving condition/result/Encounter runtime paths and avoiding a
premature editor on top of an evolving Schema.

## 2. Options and decision

| Option | Score | Decision | Reason |
|---|---:|---|---|
| Raw JSON only | 32 | reject | No semantic foreign-key gate, compact preview or rollback proof. |
| Validated script workflow | 86 | select | Preserves one JSON authority while adding deterministic validation, preview, diff and rollback evidence. |
| Specialized visual editor | 41 | defer | No stable multi-chapter production corpus or sustained author workflow yet. |

The editor is reconsidered only after all of the following can be measured:

- at least three production chapters use a stable Schema version;
- at least two non-programmer authors repeat the workflow for four weeks;
- script-assisted error rate or iteration time remains above the configured
  thresholds.

## 3. Configuration and architecture changes

| File | Responsibility |
|---|---|
| `config/production/editor_roi_decision.json` | Facts, option scores, selected workflow, rollback policy and reconsideration thresholds. |
| `config/production/schemas/production_os_contract.schema.json` | Schema for the ROI decision and required validation/diff/undo/preview fields. |
| `config/production/production_stage_plan.json` | `EDITOR-ROI-001=done`, `G6=pass`, evidence links. |
| `config/production/toolchain_registry.json` | Registers the chapter-authoring inspection as an enabled G6 script workflow. |

The output authority remains `json-in-git`. The runtime consumer remains
`src/chapterSession.js`. Reports under `outputs/` are evidence only and never
become a second content source.

## 4. Tooling changes

| File | Responsibility |
|---|---|
| `tools/lib/chapter-authoring-workflow.mjs` | Generic Schema/semantic validation, preview, JSON diff and rollback hashes. |
| `tools/inspect-wuxia-chapter-package.mjs` | Read-only CLI for one candidate and optional baseline comparison. |
| `tools/audit-wuxia-editor-roi.mjs` | Decision audit, current measurement drift and authoring workflow proof. |
| `tools/test-wuxia-editor-roi.mjs` | Positive, external-reference and fail-closed decision tests. |

The inspection CLI does not write to or mutate its input. External Encounter
references fail closed unless explicitly allowed by configuration or CLI
input. Source control remains the actual undo authority; the tool proves that
the restored hash equals the baseline hash.

## 5. Validation evidence

Focused results:

```text
npm run runtime:chapter-authoring:audit
  PASS_WITH_KNOWN_LIMITATIONS
  decision findings=0
  measurement drift=0
  chapter Schema/semantic findings=0
  diff rows=1
  rollbackVerified=true

npm run runtime:chapter-authoring:test
  PASS
  baseline + external Encounter gate + 4 decision fail-closed cases

npm run production:test
  PASS (8 cases)

npm run production:validate
  pass; configs=7; findings=0; p0=0
```

Machine evidence:

- `outputs/editor_roi001/editor_roi_report.json`
- `outputs/production_os/validation-report.json`

The full browser regression and manual screenshot review are recorded in
`EDITOR_ROI_001_MANUAL_ACCEPTANCE_20260812.md`.

## 6. Rollback

Rollback is configuration/source-control based:

1. revert the task commit as one unit;
2. run `npm run production:test` and `npm run production:validate`;
3. run `npm run runtime:chapter-config-reuse:test`;
4. confirm the chapter fixture hash returns to the recorded baseline.

No migration of player saves or production chapter data was performed, so no
runtime data rollback is required.

## 7. Risks and unfinished work

- Chapter one is not yet represented one-to-one by the generic v1 chapter
  package; the script workflow is an inspection layer, not a migration claim.
- The v1 Schema is still extensible and has no production chapter corpus.
- Compact preview never replaces browser execution or human visual review.
- `ASSET-002`–`ASSET-010`, `COMBAT-002B`, `T05-01`, `AUDIT-003` and
  `REL-001`–`REL-003` remain open or blocked.
- The current product visual quality remains unacceptable for release; this
  task intentionally did not modify or approve current CSS actors/stage art.

Formal handoff:

```yaml
task_id: EDITOR-ROI-001
from_role: editor-framework-architect
to_role: game-producer-reviewer
stage: G6
known_facts: measured chapter volume and churn are configuration-recorded
assumptions: script tooling will reduce authoring errors before editor thresholds are met
approved_decisions: validated-script-workflow; specialized editor deferred
changed_files: config, tooling, tests, roadmap and acceptance Markdown
config_version: idlewuxia.production.editor_roi_decision.v1
interfaces: inspect-wuxia-chapter-package CLI
data_contracts: chapter definition v1 plus editor ROI decision
tests_run: focused, production contract and browser regression
test_results: pass with product visual limitations retained
known_failures: production visual and release gates remain blocked
risks: evolving chapter schema and no production multi-chapter corpus
next_action: continue ASSET-007 through ASSET-010 requirements/open intake, COMBAT-002B and T05-01 without false production completion
acceptance_owner: qa-bot-regression-engineer
```
