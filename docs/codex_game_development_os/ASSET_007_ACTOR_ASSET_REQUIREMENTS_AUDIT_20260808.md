# ASSET-007 actor asset requirements and reference audit

**Date:** 2026-08-08
**Status:** PASS WITH KNOWN LIMITATIONS
**Production gate:** BLOCKED
**Accountable owner:** asset-content-pipeline
**Independent acceptance owner:** project-and-engine-auditor / qa-bot-regression-engineer

## 1. Current state

ASSET-007 is now represented as a machine-validated requirements table for the two combat actor logical IDs already declared by the presentation contract: `combat-actor-player` and `combat-actor-enemy`. This is a requirements/provenance task; it does not generate, copy, or promote artwork.

Both rows are intentionally `missing`. The development CSS actor remains a reversible diagnostic fallback only. The production presentation contract therefore remains fail-closed and `COMBAT-002B` remains blocked.

## 2. Reference archive audit

The read-only raw archive was audited at:

`fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/01_raw_apk_unpacked/product_fangzhijianghu_guanfang_2.1.01/assets/res`

The recursive extension inventory was 2,603 files: 682 PNG, 3 JPG, 410 MP3, 1,507 Lua and 1 TXT. The audit found scene backgrounds under `OtherImage/Fight/Scene`, role/UI panels under `Image/UI/RoleUI`, a fight UI demonstration under `Layer/FightUI/demo.jpg`, Lua role definitions under `script/challengeMap/roles`, and no eligible transparent, frame-addressable side-view actor set. The `Anim/FightEffect` directory contains no raster actor frames.

The manually opened `Layer/FightUI/demo.jpg` is a UI demonstration with flat silhouette figures, not a reusable actor atlas. `Image/UI/RoleUI/11.png` is a role-information panel, not an actor sprite. Neither can satisfy the actor slot. No reference bytes were bound or copied.

## 3. Requirements table

| Logical ID | Required clips | View/proportion | Status | Runtime fallback | Reference disposition |
|---|---|---|---|---|---|
| `combat-actor-player` | idle, walk-left, walk-right, attack, hurt, control, defeat | side only; 2.7–3.3 heads | missing | development CSS only | no eligible candidate |
| `combat-actor-enemy` | idle, walk-left, walk-right, attack, hurt, control, defeat | side only; 2.7–3.3 heads | missing | development CSS only | no eligible candidate |

Every delivered clip must include stable pivot/transparent bounds, integer-scale pixel frames, no baked scene pixels, a left/right walk phase signature, per-file source/ownership/hash/budget metadata, and manual frame-by-frame evidence at portrait sizes. Scene, VFX, audio and UI files cannot satisfy this actor table.

## 4. Configuration and runtime chain

```text
config/wuxia_combat_actor_asset_requirements.json
  -> Draft 2020-12 schema
  -> tools/validate-wuxia-combat-actor-asset-requirements.mjs
  -> focused positive/negative tests
  -> presentation contract logical actor IDs
  -> production fail-closed gate
```

The manifest is listed as a development-reference file in `config/project_scope.json`; it is not a shipping config. Runtime code continues to consume logical IDs from the presentation contract and never imports a concrete image path.

## 5. Acceptance evidence

| Gate | Result | Evidence |
|---|---|---|
| Schema and semantic validation | PASS | `npm.cmd run runtime:combat-actor-assets:validate` |
| Positive/negative tests | PASS | `npm.cmd run runtime:combat-actor-assets:test` |
| Reference audit | PASS WITH KNOWN LIMITATIONS | This report and `referenceAudit` in the manifest |
| Production asset readiness | BLOCKED | two actor rows remain `missing`; no owned/licensed clips |
| Manual visual review | FAIL for product art, PASS for truthful diagnosis | `outputs/combat_manual_browser_flow_20260808_asset007_fresh/14_early_combat_screen.png`; current CSS actors remain visibly non-production |

The last row is not a contradiction: the manual review verifies the blocker is still visible and not silently masked. It does not grant an art-quality pass.

## 6. Scope and rollback

Changed files are limited to the requirements manifest/schema, validator/test, package preflight registration, project scope declaration, this report, roadmap and traceability. No runtime renderer, reference archive, shipping asset, APK or generated `www/` content was changed.

Rollback is a single commit revert. It removes the ASSET-007 audit artifacts and preflight registration while leaving COMBAT-002A, COMBAT-003 and COMBAT-004 presentation authority intact. The reference archive remains read-only and untouched.

## 7. Known limitations

- There is no approved player/enemy pixel actor source in the audited reference archive.
- ASSET-007 is not complete; this task only makes the missing work explicit and mechanically guarded.
- The current browser combat screen still uses CSS geometric debug actors and a placeholder scene; this remains a Gate C failure.
- No real-device animation, touch, frame pacing or audio evidence is claimed by this task.

## 8. Next action

Supply or approve the two actor sets. Extend the same manifest with owned/licensed asset records, SHA-256, dimensions, pivot, clip frame counts/fps, and manual left/right foot-phase signatures. Only then can the actor rows be promoted from `missing` and ASSET-007 be considered for production acceptance.

## 9. Verdict

**PASS WITH KNOWN LIMITATIONS for the audit/configuration deliverable; RELEASE BLOCKED for the game.** The repository now has a truthful, reversible and data-driven actor requirements chain. It does not claim that characters are finished.
