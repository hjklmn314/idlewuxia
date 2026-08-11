# CONTENT-001 Manual Visual and Browser Regression Acceptance

Date: 2026-08-12
Task: `CONTENT-001`
Acceptance owner: independent QA review by the primary agent

## Gate result

**Functional/browser regression: PASS.**
**Changed-route visual regression: PASS.**
**Production visual/release gate: BLOCKED (pre-existing and intentionally not
closed by CONTENT-001).**

CONTENT-001 adds a test-only configuration fixture and does not change the
production HTML renderer or active story. The manual check therefore verifies
that the existing routes still render and that the chapter-loop/NPC screens do
not acquire a layout regression. It does not claim that the current placeholder
combat presentation is ready for release.

## Authoritative browser run

Evidence root:

`outputs/wuxia_visual_matrix/content001_20260812_retry/`

Report:

`outputs/wuxia_visual_matrix/content001_20260812_retry/browser_surface_sweep_report.json`

The retry was run with the local `tools/dev-server.mjs` kept alive for the
entire matrix. Results:

- 11 active screens × 3 configured portrait viewports = **33/33 observed**;
- conditional chapter routes = **6/6 observed** (two screens × three viewports);
- modal probes = **3/3 pass**;
- baseline and conditional flow failures = **0**;
- browser console errors/warnings = **0**;
- coverage gaps and blockers = **0**;
- `FIRST_SESSION_SIMULATION_LIFECYCLE` remains explicitly tracked separately
  and excluded from this verdict.

The earlier run under `content001_20260812` is not an acceptance artifact: it
contains connection-refused screenshots after the server lifecycle was stopped
too early. The retry is the only run used for this verdict.

## Manual screenshot review

The following screenshots were opened and inspected at native captured size:

| Evidence | Manual result |
|---|---|
| `android-baseline/04_character_status.png` | Portrait layout, top navigation, stat rows and task panel visible; no overflow or clipped control introduced. |
| `conditional/android-baseline/10_npc_interaction_screen.png` | NPC action buttons and feedback block are reachable and visually stable; no new overlap or clipping. |
| `conditional/android-baseline/11_chapter_loop_screen.png` | Room graph, exit controls and exploration feedback render inside the portrait viewport; no new overflow or clipped control. |
| `android-baseline/14_early_combat_screen.png` | Combat route remains functionally reachable and readable, but CSS/geometric fighters and dark placeholder stage are visibly non-production. This is recorded as the existing ASSET/COMBAT presentation block, not attributed to CONTENT-001. |

The other two configured viewports were included in the automated real-browser
evidence and had the same zero-failure/zero-console result. The manual visual
review does not promote the existing `T05-01` production-art gate.

## Final acceptance statement

The later-chapter configuration reuse change is accepted for the generic
runtime/configuration layer. It is not accepted as a player-facing chapter,
asset-complete experience, signed Android build, or release candidate.
