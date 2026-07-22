# T03-01 Manual Visual Acceptance

## Scope

This is a regression visual acceptance for the T03-01 runtime assertion change. No UI layout or asset code was changed in this task.

## Real Edge runs

| Viewport | Scenario | Steps | Failures | Console problems | Final state | Verdict |
|---|---|---:|---:|---:|---|---|
| 540x960 | `interaction-contract` | 20 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` | PASS |
| 390x844 | `interaction-contract` | 20 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` | PASS |

The acceptance runner used isolated DevTools ports sequentially (`9228` and `9229`) to avoid cross-run browser profile contamination.

## Manual inspection

All 40 generated screenshots were reviewed individually. The following were checked:

- opening/origin/title/character/task/chapter screens remain readable;
- map direction buttons and NPC selection remain inside the viewport;
- rejected gate feedback is visible and does not mutate the route;
- NPC dialogue and action feedback remain visible at both target widths;
- combat placeholder transition returns to the map without a broken surface;
- no critical horizontal overflow, invisible control, or unreadable state was observed.

## Known limitation

The postponed combat presentation uses the configured technical unit label `npc01_03` in the combat placeholder header. This is pre-existing deferred Combat/visual content, not introduced by T03-01. It remains a G5/COMBAT-002 follow-up and is not evidence that the project is release-ready.

## Evidence roots

- `outputs/t03_01_action_state_assertions/browser_540x960_retry/real_browser_flow_summary.json`
- `outputs/t03_01_action_state_assertions/browser_390x844_retry/real_browser_flow_summary.json`
- `outputs/t03_01_action_state_assertions/browser_540x960_retry/`
- `outputs/t03_01_action_state_assertions/browser_390x844_retry/`
