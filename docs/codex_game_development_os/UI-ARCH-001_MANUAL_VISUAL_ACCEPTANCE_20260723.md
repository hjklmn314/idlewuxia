# UI-ARCH-001 Manual Visual Acceptance

## Browser evidence

| Viewport | Scenario | Steps | Failures | Console problems | Final state | Verdict |
|---|---|---:|---:|---:|---|---|
| 540x960 | `interaction-contract` | 20 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` | PASS |
| 390x844 | `interaction-contract` | 20 | 0 | 0 | `STATE_FS_008_MAP_EXPLORE` | PASS |

## Manual inspection

All 40 screenshots from the two real Edge runs were reviewed. The review
covered opening/origin, title, character status, idle confirmation, task list,
reward repetition, chapter entry, map direction layouts, locked gates, NPC
selection, dialogue feedback, combat placeholder entry, and return-to-map.

Accepted observations:

- No critical horizontal overflow or clipped primary control was introduced by
  the CSS split.
- Header navigation, map direction controls, NPC/object actions, feedback logs,
  and task reward bars remain visible and clickable.
- The compact viewport keeps long dialogue and task feedback within a scrollable
  page surface.
- Browser summaries report zero page console errors and warnings.

## Evidence roots

- `outputs/ui_arch_001/browser_540x960_retry/real_browser_flow_summary.json`
- `outputs/ui_arch_001/browser_390x844/real_browser_flow_summary.json`
- `outputs/ui_arch_001/browser_540x960_retry/`
- `outputs/ui_arch_001/browser_390x844/`

The combat placeholder's technical unit label remains a known postponed
COMBAT-002 limitation and is not attributed to UI-ARCH-001.
