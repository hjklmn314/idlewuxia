# ASSET-008 clean combat scene requirements and reference audit

**Date:** 2026-08-08
**Status:** PASS WITH KNOWN LIMITATIONS
**Production gate:** BLOCKED
**Accountable owner:** asset-content-pipeline
**Independent acceptance owner:** project-and-engine-auditor / qa-bot-regression-engineer

## 1. Current state

ASSET-008 now has a machine-validated requirements table for both logical combat scenes already present in the presentation contract. The two local reference PNGs are usable for development inspection only. They are not owned shipping assets and are not copied into `public/`, `www/`, Android assets or the Git shipping set.

## 2. Manual reference review

The read-only archive candidates were opened manually:

- `OtherImage/Fight/Scene/leitai.png`: 2160x853, 59,352 bytes, SHA-256 `45eb0ca86e3c8ec658e8aeff846fa35c0e9af32abc7e6829cd2641a37b2f2058`.
- `OtherImage/Fight/Scene/shulin.png`: 2160x853, 79,559 bytes, SHA-256 `b2d31af2343625f9576e873aeaee57295beebc6197df28274127166427c703af`.

Both are structurally clean: no baked player/NPC figures and no baked combat UI. Both are dark monochrome silhouettes, however, so they do not meet the final portrait pixel-Wuxia product art bar without a separate owned art decision. This is recorded as a visual limitation rather than silently promoted to PASS.

## 3. Requirements and runtime binding

| Logical ID | Reference binding | Status | Landing zones | Viewports |
|---|---|---|---|---|
| `combat-scene-fb01-wuguan-courtyard` | `ref-scene-wuguan-courtyard` | reference-only | player 0.28 / enemy 0.72, baseline 0.76 | 360x800, 390x844, 540x960 |
| `combat-scene-fb01-courtyard-rain` | `ref-scene-courtyard-rain` | reference-only | player 0.28 / enemy 0.72, baseline 0.76 | 360x800, 390x844, 540x960 |

Scene assets are separate from actor, VFX and UI layers. Runtime mounts actors by logical ID at the configured landing zones; scene images never contain characters or HUD controls. The `css_courtyard` fallback remains development-only.

## 4. Validation chain

```text
scene requirements manifest
  -> Draft 2020-12 schema
  -> reference overlay binding parity
  -> presentation contract logical scene IDs
  -> focused positive/negative tests
  -> production fail-closed gate
```

## 5. Acceptance evidence

| Gate | Result | Evidence |
|---|---|---|
| Schema and semantic validation | PASS | `npm.cmd run runtime:combat-scene-assets:validate` |
| Positive/negative tests | PASS | `npm.cmd run runtime:combat-scene-assets:test` |
| Manual clean-scene review | PASS structurally; visual quality limited | the two manually opened reference PNGs |
| Production asset readiness | BLOCKED | both rows are `reference-only`; source ownership and final art approval are absent |
| Fresh browser combat review | Gate C FAIL | `outputs/combat_manual_browser_flow_20260808_asset007_fresh/14_early_combat_screen.png`; placeholder scene/actors remain visible |

## 6. Scope and rollback

This task changes only the scene requirements/Schema, validators/tests, stage-plan evidence, scope registration, roadmap, traceability and this report. It does not change runtime rendering or ship the reference PNGs. Revert the ASSET-008 commit to remove these artifacts; COMBAT-004 and the ASSET-007 audit remain independently revertible.

## 7. Verdict

**PASS WITH KNOWN LIMITATIONS for the reference-backed requirements deliverable; RELEASE BLOCKED for production.** The project now has explicit scene separation and landing-zone data, while the final owned pixel-art scene remains a separate production dependency.
