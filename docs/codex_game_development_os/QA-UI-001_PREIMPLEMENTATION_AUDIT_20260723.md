# QA-UI-001 Pre-implementation Audit

## Scope

QA-UI-001 is the production browser-surface and modal-sweep tool for the
configuration-driven Wuxia UI. It is distinct from T05-01: QA-UI-001 supplies
the deterministic runner and failure evidence contract; T05-01 closes all
11-screen × 3-viewport product evidence.

## Audited facts

- `config/production/ui_experience_registry.json` is authoritative for 11
  screens, three Android viewports, 33 matrix pairs, and the postponed combat
  pair policy.
- `npm run production:ui-matrix` was a planner only. It did not drive a real
  browser, capture DOM, or fail on a blocked modal path.
- `tools/run-wuxia-real-browser-flow.mjs` already provided deterministic first
  session navigation and screenshots, but its captures did not include the
  DOM/state bundle required for diagnosis.
- The configured modal specimen (`tmnpc01d` → `custom_caozuo1` → `tmchoice01`)
  is not present in the default `石路` room. Reaching it requires runtime
  conditions and a route that the baseline scenario does not establish.
  Injecting state would violate the project evidence policy and is prohibited.
- The 412×915 baseline exposed a real status-row wrapping defect. The defect
  was corrected by extending the compact-layout media query to 440px.

## Required implementation contract

1. Read registry, first-session flow, screen contract, and modal probe config;
   do not embed competitor or dormant shooting identifiers.
2. Generate 33 cases, explicitly separating 30 active cases and three
   postponed combat cases.
3. Run each selected viewport in a real browser and capture screenshot, DOM,
   state, screen, viewport, console errors/warnings, overflow, and flow result.
4. Run the configured modal specimen for every selected viewport.
5. Return non-zero when a blocker or modal failure is observed.
6. Preserve failure evidence in an output directory that is excluded from Git.

## Acceptance decision before implementation

The runner implementation is allowed to complete as a separate tool change,
but product acceptance must remain `REVISE` while the configured modal route is
not reachable without state injection. T05-01 must remain open until every
active screen/viewport pair has real evidence.

## Rollback

Remove the new sweep runner, contract test, modal probe, and package script;
restore the previous browser-flow capture shape and the prior 400px media
query. No save data or runtime content migration is involved.
