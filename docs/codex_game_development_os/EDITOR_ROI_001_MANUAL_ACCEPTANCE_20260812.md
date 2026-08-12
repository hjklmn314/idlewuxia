# EDITOR-ROI-001 Manual Functional and Visual Regression Acceptance

Date: 2026-08-12

Task: `EDITOR-ROI-001`

Acceptance owner: primary-agent manual review after automated QA

## Gate verdict

**Authoring workflow: PASS.**

**Affected-route visual regression: PASS.**

**Product visual/release readiness: BLOCKED and unchanged.**

This task adds configuration, read-only inspection tooling and tests. It does
not change active runtime rendering, player content or assets. Manual
acceptance therefore covers the actual CLI output and a full real-browser
regression of the neighboring chapter, NPC, map, modal and combat paths.

## Gate A — manual authoring workflow review

The CLI output was read directly for the test chapter package. It exposed:

- chapter identity and Schema version;
- 1 node, 1 gate, 1 reward, 1 room, 1 NPC, 1 interactable;
- 2 branches, 2 results and 1 condition;
- the external Encounter reference;
- result categories and action types;
- zero Schema or semantic findings after explicit external-reference approval.

The unapproved external Encounter path was also run and correctly returned a
non-zero exit with `UNKNOWN_REFERENCE`. The tool did not change the fixture.

## Gate B — automated browser and contract evidence

Browser evidence root:

`outputs/wuxia_visual_matrix/editor_roi001_20260812/`

Authoritative report:

`outputs/wuxia_visual_matrix/editor_roi001_20260812/browser_surface_sweep_report.json`

Results:

- 11 active screens × 3 portrait viewports = **33/33 observed**;
- conditional routes = **6/6 observed**;
- modal cases = **3/3 pass**;
- blockers = **0**;
- coverage gaps = **0**;
- browser console problems = **0**;
- `FIRST_SESSION_SIMULATION_LIFECYCLE` remains explicitly separated from this
  verdict as a historical lifecycle diagnostic.

The server lifecycle was verified before the sweep and stopped afterwards;
port 5187 ended with zero listeners.

## Gate C — manual screenshot review

The following fresh screenshots were opened at original resolution and
visually inspected:

| Screenshot | Manual result |
|---|---|
| `android-compact/14_early_combat_screen.png` | Combat UI remains reachable and controls fit, but CSS/geometric actors and placeholder stage remain an explicit production failure. |
| `conditional/android-baseline/10_npc_interaction_screen.png` | Four actions and feedback are readable, reachable and not clipped. |
| `conditional/android-tall/11_chapter_loop_screen.png` | Room controls, state text and exit controls fit without new overlap. |
| `android-baseline/09_map_explore.png` | Map/room selection route remains visible and stable. |

This review confirms no visual regression caused by EDITOR-ROI-001. It does
not accept the current art direction, combat presentation, assets or final
11×3 production quality. `T05-01` remains blocked.

## Temporary evidence hygiene

The sweep created six browser profile directories containing 2,364 temporary
files / 83.50 MiB. All six `edge_cdp_profile` directories were sent to the
Windows Recycle Bin after the report and screenshots were retained. No Codex
session, project source, formal evidence, user file or browser screenshot was
removed.

## Final statement

`EDITOR-ROI-001` is manually accepted for its configuration and authoring
workflow scope. The project remains `RELEASE_BLOCKED_ACTIVE_REMEDIATION`
because asset, product visual, Android device and signed Release evidence are
still missing.
