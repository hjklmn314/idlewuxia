# QA-UI-001 Manual Visual Acceptance

## Evidence set

Run directory:

`outputs/wuxia_visual_matrix/20260723_qa_ui_001_final/`

The run contains 12 deterministic baseline screenshots for each of:

- `android-compact` — 360×800
- `android-baseline` — 390×844
- `android-tall` — 412×915

It also contains three modal failure captures and the machine-readable sweep
report. The complete 33-case product matrix is not claimed complete because
the two conditional screens are explicit coverage gaps.

## Manual inspection result

Representative screenshots from all three viewports were inspected manually.
The following were visually accepted for the baseline route: opening story and
origin result, title/start shell, character status, idle confirmation and task
list, chapter entry, map navigation, room NPC card, action feedback, and the
responsive bottom treatment. The 412px status-row wrap found during the sweep
was fixed and rechecked.

The modal failure captures were also inspected. They show a valid map screen,
no console problem, and no fabricated modal. They are evidence of a blocked
product route, not evidence of a passed choice interaction.

## Verdict

`PASS WITH KNOWN LIMITATIONS` for the baseline visual surface.

`REVISE` for QA-UI-001 product acceptance and `BLOCKED` for T05-01 until the
NPC/choice route can be exercised through legitimate configured conditions and
the six conditional screen pairs receive real evidence.
