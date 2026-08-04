# QA-UI-001 / T05-01 Completion Record — 2026-07-25

> Superseded on 2026-08-04: the automation/tooling portion (`QA-UI-001`) was
> corrected and rerun as 33/33 active screen-viewport pairs with zero blockers,
> but the strict human visual gate failed. `T05-01` is therefore `blocked`, not
> complete. See `FULL_RELEASE_AUDIT_20260804.md`. The original record below is
> retained as historical evidence and must not be used as a current release
> approval.

## Current state

`QA-UI-001` and `T05-01` are complete for the active Wuxia UI surface. The
previous `tmnpc01d` blocker was a real reachability defect in the evidence
route, not a reason to waive the gate.

## Configuration route

`config/wuxia_browser_evidence_routes.json` declares a localhost-only,
fresh-context evidence profile. It supplies the Tangmen condition as a
configuration profile and then executes the real configured chain:

`tmnpc01a -> tmnpc01b -> tmnpc01c -> tmnpc01d -> custom_caozuo1 -> tmchoice01`.

The route uses normal `dispatchAction`, room, NPC, and NPC-action intents. It
does not add `tmnpc01d` to a static room, alter the production `playerSeed`, or
expose the route on non-localhost hosts. The default new-player negative case
continues to reject `tmnpc01d` before the dynamic replacement chain.

## Validation report

Run:

```text
npm run wuxia:qa:ui-sweep -- --run-id=20260725_qa_ui_001_tmnpc01d_final --base-port=9620
```

Result: `pass`.

- 33 matrix cases planned: 30 active, 3 postponed under `COMBAT-002`.
- 30 active pairs have screenshot, DOM/state, viewport, overflow, console,
  and interaction evidence.
- `UI_NpcInteraction`: 3/3 conditional viewport pairs pass.
- `UI_ChapterLoop`: 3/3 conditional viewport pairs pass.
- `tmchoice01` modal: 3/3 viewport pairs pass and resolves the negative option.
- coverage gaps: `0`; blockers: `0`; browser page console problems: `0`.

The report contains an explicit `validationScope.knownUnrelatedMismatches`
entry for `FIRST_SESSION_SIMULATION_LIFECYCLE`. That historical first-session
combat-lifecycle diagnostic is tracked separately and has
`excludedFromVerdict=true`; it is not used to pass or fail this UI task.

## Scope boundary

This record closes QA-UI-001/T05-01 only. It does not close `T05-02`
AssetRegistry, `COMBAT-002`, real CombatSession, signed release, real-device
acceptance, performance, store, rollout, or rollback gates.
