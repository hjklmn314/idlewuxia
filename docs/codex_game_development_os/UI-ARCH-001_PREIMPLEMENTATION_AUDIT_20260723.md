# UI-ARCH-001 Pre-Implementation Audit

## Verdict

`REVISE` — the existing UI contract and Intent seam are healthy, but the active
HTML entry still owns presentation, DOM event binding, mobile CSS variables, and
legacy shooting styles in one shipping bundle. UI-ARCH-001 is therefore required
before the G5 visual matrix can be treated as a production gate.

## Known facts

- `src/uiFlowAdapter.js` is the only UI-to-`ChapterSession` command mapper and
  already rejects unknown, malformed, and over-specified Intent envelopes.
- `src/browserAutomationAdapter.js` uses the same Intent path as browser input.
- `src/wuxia-main.js` is 1,157 lines and currently combines pure HTML generation,
  DOM queries/mutations, event binding, persistence lifecycle, and postponed
  combat playback.
- `config/wuxia_first_session_screen_contract.json` is the authoritative screen
  and transition definition; concrete chapter content remains in flow config.
- `config/production/ui_experience_registry.json` defines 11 screens, 3 mobile
  viewports, 33 evidence obligations, and 3 postponed combat cases.
- `src/styles.css` is 3,912 lines. The Wuxia rules begin near line 2,203, while
  the preceding section contains dormant shooting-game selectors, themes, and
  canvas/control-panel rules.
- The current build and UI adapter tests pass, but the web shipping closure is
  still 20 files and includes the mixed `src/styles.css` bundle.

## Findings

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| UIA-001 | P0 | Wuxia shipping CSS contains dormant shooting selectors and themes. | `src/styles.css` pre-Wuxia section; `config/project_scope.json` ships it directly. |
| UIA-002 | P0 | DOM event binding is distributed through `wuxia-main.js`, not a dedicated DOM adapter. | `bind*`, `select*FromUi`, `document.querySelector*`, and `onclick` span lines 827–1117. |
| UIA-003 | P1 | Render functions mix pure presentation with runtime/config lookup. | `renderScreenBody`, room/NPC/item renderers, and `state.config` access in `wuxia-main.js`. |
| UIA-004 | P1 | The 33-case matrix is generated but not a browser acceptance result. | `production:ui-matrix` reports planning obligations only. |
| UIA-005 | P1 | CSS boundary and DOM ownership have no dedicated regression gate. | No static test rejects `styles.css` from the Wuxia shipping closure or legacy selectors from the Wuxia bundle. |

## Scope decision

This slice will separate the Wuxia CSS boundary and DOM interaction adapter,
without changing domain state ownership, chapter data, combat behavior, or the
postponed `COMBAT-002` surface. Pure render output remains configuration-driven;
the new adapter will only query/update DOM and emit typed UI Intents.

## Acceptance evidence required

1. A shipping bundle contains `src/wuxia.css` and does not contain the legacy
   shooting stylesheet or its selectors.
2. `wuxia-main.js` delegates DOM event binding and mobile shell mutations to a
   dedicated adapter.
3. UI Intent and ViewModel tests remain green, including zero-mutation invalid
   input behavior.
4. Existing real-browser flows pass at the two regression viewports, followed
   by the later 33-case matrix gate in T05-01.

## Non-scope

- No combat resolution, Rest, Repair, or CombatSession implementation.
- No chapter content or numeric rebalance.
- No competitor asset copying.
- No claim that G5 or commercial release is complete.
