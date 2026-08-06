# VISUAL-STANDARD-001 Completion Record — 2026-08-06

## Frozen product standard

`config/production/visual_standard.json` is now the measurable visual
standard for the portrait Wuxia product:

- characters are side-view only, approximately 2.7–3.3 heads tall;
- front, back, three-quarter and isometric character views are rejected;
- scenes are clean background layers and never contain baked characters;
- nearest-neighbor pixel rendering, integer scale and no anti-aliasing are
  required;
- 360×800, 390×844 and 412×915 portrait viewports carry explicit safe areas;
- touch targets are at least 44dp, body text at least 14px and title text at
  least 18px;
- combat feedback cannot occlude actors, must provide the declared feedback
  types, and cannot use geometric or other placeholder presentation;
- walking animation must alternate left and right foot phases;
- audio feedback must be available within the declared 120ms budget.

## Verification

- Schema: `config/production/schemas/visual_standard.schema.json`.
- Validator: `tools/validate-visual-standard.mjs`.
- Positive and negative cases: `tools/test-production-asset-contract.mjs`.
- Command: `npm run production:visual-standard`.

The validator also cross-checks the production UI viewport registry so a new
portrait size cannot silently bypass the visual thresholds.

## Acceptance boundary

This record proves the standard and its fail-closed validator. It does not
prove that the current prototype meets the standard. The 2026-08-04 manual
review remains FAIL because the current map, NPC, character and combat views
are still rough prototype geometry and lack approved project-owned character,
scene, VFX and audio assets. T05-01 and COMBAT-002B remain blocked until the
human screenshot/device gate passes.
