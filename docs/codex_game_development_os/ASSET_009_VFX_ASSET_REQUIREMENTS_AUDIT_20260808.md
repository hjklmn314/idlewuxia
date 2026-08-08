# ASSET-009 VFX / Buff asset requirements audit

Date: 2026-08-08
Task: ASSET-009
Accountable owner: asset-content-pipeline
Independent acceptance owner: qa-bot-regression-engineer
Status: **PASS WITH KNOWN LIMITATIONS** for the audit/configuration deliverable; **BLOCKED** for production asset completion.

## 1. Scope and non-scope

This task converts the existing combat presentation contract into a production-ready VFX and Buff asset requirements table. It does not generate, copy, recolor, or ship art. Existing reference files are read-only development evidence. The HTML runtime continues to use logical IDs and its development-only visual fallback; no CSS effect is accepted as production art.

The scope is deliberately limited to:

- all 28 configured combat `cue_*` IDs;
- all 16 configured `buff_*` icon IDs;
- actor/target attachment, timing, readability and budget requirements;
- reference inventory, hash and manual observations;
- schema, foreign-key and negative-path validation;
- roadmap and traceability evidence.

It does not close ASSET-007 actor art, ASSET-008 scene art, ASSET-010 audio, COMBAT-002B, T05-01, real-device review, or Release APK/AAB gates.

## 2. Authoritative chain

```text
config/wuxia_combat_content.json
  -> visualCues / buffs (combat semantics)
config/wuxia_combat_presentation_contract.json
  -> vfx / buffIcons (logical presentation IDs)
config/wuxia_combat_reference_asset_overlay.json
  -> development-only reference bindings
config/wuxia_combat_vfx_asset_requirements.json
  -> ASSET-009 requirements, provenance and acceptance policy
tools/validate-wuxia-combat-vfx-asset-requirements.mjs
  -> schema, ID, event, reference, shipping and gate validation
runtime / presentation adapter
  -> reads logical IDs; production fallback remains fail-closed
```

The binding policy is configured, not hard-coded in the page: `logicalIdOnly=true`, mount point `combat.vfx`, cue fallback `existing_runtime_css_feedback_only`, Buff fallback `text-label`, and fallback scope `development-only`.

## 3. Required cue coverage

Every row is intentionally `status: missing` and `referenceAssetId: null`. The `eventType` and presentation brief are cross-checked against the combat content contract. Production art must supply anticipation, impact and settle phases, integer-scale pixel treatment, a target or source actor anchor, and feedback that does not cover HP/MP, Buff rows, action controls, or floating numbers.

| Cue ID | Event | Required player-readable feedback |
|---|---|---|
| `cue_basic_strike` | damage | Single-target hit spark and damage |
| `cue_test_strike` | damage | Low-intensity training strike |
| `cue_guard` | buff | Guard ring and defensive state |
| `cue_heal` | heal | Target-bound jade healing wave |
| `cue_flame_palm` | damage | Flame arc with critical-readable impact |
| `cue_pressure_point` | control | Meridian flash and control confirmation |
| `cue_iron_wall` | shield | Stone shield ring and amount feedback |
| `cue_venom_thrust` | damage | Poison burst linked to target and damage |
| `cue_double_slash` | damage | Two ordered, readable slash arcs |
| `cue_bleeding_cut` | damage | Red arc and bleeding application |
| `cue_smoke_step` | buff | Smoke displacement and evasion state |
| `cue_miss` | miss | Wind trace without false damage |
| `cue_defeat` | defeat | Fall, dust and defeat confirmation |
| `cue_qi_recovery` | resource | Qi ring and resource delta |
| `cue_meditation` | buff | Meditation aura and regeneration |
| `cue_clear_mind` | cleanse | Cleanse ring and removed-control state |
| `cue_silencing_needle` | control | Needle impact and silence |
| `cue_reflecting_mirror` | buff | Mirror ring and reflected-damage state |
| `cue_trap_root` | control | Root bind and restricted-action state |
| `cue_blood_fury` | statModifier | Red aura and attack modifier |
| `cue_sweeping_blade` | damage | Wide slash arc across targets |
| `cue_shared_breath` | heal | Caster-to-ally healing wave |
| `cue_random_needle` | control | Target-specific needle burst |
| `cue_true_point` | damage | Puncture impact and high-value damage |
| `cue_taunt` | buff | Roar ring and taunt target state |
| `cue_protect_ally` | shield | Ally-protection arc and shield |
| `cue_meridian_transfer` | heal | Caster-to-ally meridian wave |
| `cue_frost_qi` | damage | Ice shard impact and cold damage |

The contract is intentionally fail-closed: a missing cue must produce an audit finding in a production profile, not silently use CSS geometry or an unregistered reference file.

## 4. Buff icon coverage

All 16 Buff IDs remain `reference-only`. The overlay reuses six development exemplars only to let the runtime exercise the semantic path while owned replacements are unavailable:

| Reference ID | File | Size | Hash (SHA-256) | Manual observation |
|---|---|---:|---|---|
| `ref-buff-positive-01` | `OtherImage/BuffIcon/b01.png` | 52x54 / 2462 B | `6d0debce5be98151119d275f3876a6d29494d8d8b166d46a0daea52dfe2caee4` | Green square, single white glyph, static |
| `ref-buff-positive-02` | `OtherImage/BuffIcon/b02.png` | 52x54 / 2862 B | `5fe377a35e62861d52967fdfef5d9ec711db4705f6c1edf18dc62a8a824c4253` | Green square, single white glyph, static |
| `ref-buff-positive-03` | `OtherImage/BuffIcon/b03.png` | 52x54 / 2044 B | `399136f04f1facf71795545102b00da1a5f1741cab16e5d869fce34ab54bf07d` | Green square, single white glyph, static |
| `ref-buff-negative-01` | `OtherImage/BuffIcon/d01.png` | 52x54 / 2442 B | `8ad992148f9b71dd3b85c190019c25d3fd240e92468ca511f6750e842f207176` | Magenta/red square, single white glyph, static |
| `ref-buff-negative-02` | `OtherImage/BuffIcon/d02.png` | 52x54 / 2581 B | `8a70c756b1410476cb934b5265e7616de3f3a350cd38aba9a73f4e941c5c6655` | Red square, single white glyph, static |
| `ref-buff-negative-03` | `OtherImage/BuffIcon/d03.png` | 52x54 / 2222 B | `bea56f30361c274905a9497840d1cce8535ab33a1047c108a4cb5046722b7f9a` | Red square, single white glyph, static |

These files do not prove ownership, license, animation, authored semantic icons, or final visual quality. They cannot satisfy the production gate and are not copied into shipping folders.

## 5. Reference audit findings

- `Anim/FightEffect/` exists but contains zero files. There is no frame-addressable hit, control, Buff, victory, or defeat family to bind.
- `Image/UI/SkillUI/` contains 47 PNGs that are static skill/menu icons. They lack target binding, timing, impact/settle frames and event semantics, so they are ineligible VFX evidence.
- `OtherImage/Fight/Scene/` contains scene backgrounds. They are not cue-level effects and cannot substitute for impact or status feedback.
- Six Buff icon exemplars were opened manually at original resolution. They are static glyph squares and were recorded as reference-only.
- No reference bytes were copied, staged as shipping assets, or used as production satisfaction.

## 6. Validation evidence

Focused commands:

```text
node tools/validate-wuxia-combat-vfx-asset-requirements.mjs
  valid: true
  status: PASS WITH KNOWN LIMITATIONS
  28 visual cue rows; 28 missing; 16 reference-only Buff rows
  0 eligible VFX candidates; 6 audited Buff exemplars

node tools/test-wuxia-combat-vfx-asset-requirements.mjs
  PASS: schema, cue coverage, reference binding and negative paths
```

Negative cases cover an unknown cue ID, false Buff satisfaction, unknown/drifted Buff reference, and a production fallback policy mutation. `config/project_scope.json`, `config/production/production_stage_plan.json`, `ROADMAP_20260804_TO_RELEASE.md`, and `TRACEABILITY.md` now include the same evidence paths.

## 7. Manual visual acceptance

The current combat route was manually run after the ASSET-009 configuration audit. The route completed the functional path, but the combat screenshot still shows CSS geometric actors and a placeholder scene. Therefore:

- functional route: PASS for navigation and runtime reachability;
- VFX/Buff production presentation: FAIL / blocked;
- product Gate C: FAIL, because no authored actor-bound hit or status effect is visible and the placeholder presentation bar is not acceptable.

This is the required truthful result. Automated schema and runtime tests do not override the manual visual failure.

## 8. Risks, rollback and next action

Risks:

- all 28 VFX rows remain missing;
- all 16 production Buff replacements remain missing;
- six reference icons are not ownership-cleared and are static;
- CSS feedback is development-only and forbidden in production;
- no Android device latency or performance evidence exists.

Rollback is limited to reverting this ASSET-009 manifest/schema/tool/doc integration. No runtime data or reference archive bytes were changed. The next task is ASSET-010 audio requirements/audit, followed by approved owned assets and COMBAT-002B. Do not mark ASSET-009 or COMBAT-002B complete until Gate C and device evidence pass.
