# UI-ARCH-001 Completion Record

## Verdict

`PASS WITH KNOWN LIMITATIONS` — UI definitions remain configuration-driven,
DOM ownership is isolated in a dedicated adapter, and the Wuxia shipping bundle
no longer transports the dormant shooting stylesheet. G5 remains open because
T05-01, T05-02, and QA-UI-001 are separate acceptance tasks.

## Current state

- `src/wuxiaDomAdapter.js` owns document queries, event binding, shell state
  attributes, mobile layout variables, pending-choice focus behavior, and
  persistence lifecycle listeners.
- `src/wuxia-main.js` owns runtime orchestration and pure content rendering but
  contains no direct `document.*`, `querySelector*`, `.onclick`, or DOM event
  binding calls.
- `src/wuxia.css` contains the Wuxia base and Wuxia presentation rules only.
- `src/legacy-shooting.css` is retained as a non-shipping historical/runtime
  reference and is excluded from `shippingFiles` and the Web/Android closure.
- `index.html` references only `src/wuxia.css`.

## Problems corrected

1. The previous 3,912-line `src/styles.css` mixed dormant shooting themes,
   canvas controls, and Wuxia presentation rules in the shipping closure.
2. DOM event binding and shell mutations were distributed through the 1,157-line
   active entry instead of having a dedicated adapter boundary.
3. There was no regression gate proving the CSS boundary or preventing main
   runtime code from bypassing the DOM adapter.

## Data and module contract

```text
screen/flow config + ChapterSession snapshot
              -> UiFlowAdapter.present()
              -> wuxia-main render functions
              -> WuxiaDomAdapter.present(markup, typed callbacks)
              -> DOM and UI Intent
              -> UiFlowAdapter.execute()
              -> ChapterSession command
```

No chapter, NPC, room, action, skill, or result identifier was added to the
adapter. The adapter accepts callbacks and logical data attributes only.

## Changed files

- `src/wuxiaDomAdapter.js`
- `src/wuxia-main.js`
- `src/wuxia.css`
- `src/legacy-shooting.css` (renamed from the mixed stylesheet)
- `index.html`
- `config/project_scope.json`
- `config/production/subsystem_registry.json`
- `config/production/production_stage_plan.json`
- `tools/test-wuxia-ui-architecture.mjs`
- `tools/test-wuxia-runtime-integrity.mjs`
- `tools/validate-mobile-shell.mjs`
- `tools/validate-reference-parity.mjs`
- `tools/audit-reference-consistency.mjs`
- `tools/audit-wuxia-stage-online-standard.mjs`
- `tools/build-wuxia-skill-waterfall-stage-tasks.mjs`
- `package.json`

## Verification

- `npm run runtime:ui-architecture:test`: PASS.
- `npm run runtime:ui-flow-adapter:test`: PASS.
- `npm run runtime:integrity:test`: PASS, 16 cases.
- `npm run production:validate`: PASS, 0 findings.
- `npm run production:test`: PASS, 6 cases.
- `npm run wuxia:check:fast`: PASS; P2=0, content-boundary high=0,
  358-action regression remains green.
- Web freshness and APK traceability contract tests: PASS.
- Web build: 21 scoped shipping files (including the DOM adapter); legacy stylesheet absent.

## Known limitations and rollback

- The full 33-case browser matrix is still T05-01; this task provides the
  adapter and two real-browser regression runs only.
- Combat presentation still exposes the known technical unit label in the
  postponed combat slice; COMBAT-002 remains deferred.
- Rollback is the prior commit plus restoring `index.html`/scope to
  `src/styles.css`, removing `wuxiaDomAdapter.js`, and restoring the previous
  subsystem/roadmap state. No runtime save data is migrated by this task.
