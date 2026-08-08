# ASSET-010 combat audio asset requirements audit

Date: 2026-08-09
Task: ASSET-010
Accountable owner: asset-content-pipeline
Independent acceptance owner: qa-bot-regression-engineer
Status: **PASS WITH KNOWN LIMITATIONS** for the audit/configuration deliverable; **BLOCKED** for production audio completion.

## 1. Scope and boundary

This task defines the production contract for the five configured combat audio cues. It does not generate or copy audio and it does not authorize the reference MP3s for shipping. The current HTML runtime may exercise the existing development overlay, but production must use owned or licensed OGG assets and must reject synth/oscillator fallback.

The contract covers:

- `sfx_hit`, `sfx_heal`, `sfx_buff`, `sfx_control`, and `sfx_defeat`;
- logical `combat.audio` mounting and reference-only provenance;
- OGG format, loudness, true-peak, concurrency and 120 ms trigger-latency budgets;
- manual mix, replay, accessibility-volume and representative Android evidence;
- schema, cue/content/presentation/overlay foreign keys and negative validation.

It does not close ASSET-007 actor art, ASSET-008 scene art, ASSET-009 VFX/Buff art, COMBAT-002B, real-device performance, signing, store or rollback gates.

## 2. Authoritative chain

```text
config/wuxia_combat_content.json
  -> audioCues (combat event semantics)
config/wuxia_combat_presentation_contract.json
  -> audio (logical presentation IDs)
config/wuxia_combat_reference_asset_overlay.json
  -> development-only MP3 overlay
config/wuxia_combat_audio_asset_requirements.json
  -> OGG/loudness/peak/latency requirements and provenance
tools/validate-wuxia-combat-audio-asset-requirements.mjs
  -> schema, foreign-key, format, shipping and gate validation
runtime / presentation adapter
  -> reads logical IDs at combat.audio
```

The production contract is fail-closed. There is no oscillator or synthesized tone fallback in a production profile. A reference-only MP3 may prove a route can resolve a logical ID during development, but it never proves release readiness.

## 3. Cue requirements

| Cue ID | Event | Required feedback | Current state |
|---|---|---|---|
| `sfx_hit` | damage | Target-bound impact transient that does not mask damage text | reference-only |
| `sfx_heal` | heal | Target-bound healing confirmation with readable onset | reference-only |
| `sfx_buff` | buff | Buff application/refresh cue with safe concurrency | reference-only; reuses heal exemplar for development |
| `sfx_control` | control | Control/parry cue synchronized to target state | reference-only |
| `sfx_defeat` | defeat | Outcome cue distinct from a normal impact | reference-only; current overlay points to challenge/music file |

Every production row must provide an OGG file, ownership/provenance, SHA-256, sample-rate/channel metadata, integrated loudness, true peak, concurrency group, import settings, maximum trigger latency and a manual replay signature.

## 4. Reference archive audit

Inventory was performed against the read-only reference root on 2026-08-09:

- `Music/Fight/`: 118 MP3 files;
- all `Music/`: 410 files;
- the overlay currently references four unique MP3 files for five logical cues.

| Reference ID | Relative path | Bytes | SHA-256 | Manual finding | Disposition |
|---|---|---:|---|---|---|
| `ref-audio-hit` | `Music/Fight/dao_hit_1.mp3` | 3971 | `fc6f447651299de62c69fd9e08b2c0df22cefc258f93ee81f484ce547d8fa955` | Short hit exemplar; ownership/loudness unknown | reference-only |
| `ref-audio-heal` | `Music/Fight/buff.mp3` | 7888 | `8e77ff4f1ee19f28c7c66eb1b02fb354427caef3737b1a60bf69be973bcce071` | Short Buff/heal exemplar; ownership/loudness unknown | reference-only |
| `ref-audio-control` | `Music/Fight/dao_parry_1.mp3` | 5016 | `76c1a188b5744a3ae6dfa0ef425b4de5916f070f9fe69a2f1854d1da673a83e9` | Short parry/control exemplar; ownership/loudness unknown | reference-only |
| `ref-audio-defeat` | `Music/biwu_tiaozhan_2.mp3` | 85733 | `1ae6cd6c879711e598c736394003d28dbe1dd0af6ae12c1fc36a7b4d732a32ed` | Challenge/music path; not proven to be a defeat SFX | reference-only |

No candidate is production eligible. The manifest intentionally leaves `durationMs`, integrated LUFS and true peak as owned-asset production measurements rather than inventing values for reference files. The overlay is therefore evidence of logical routing only.

## 5. Validation evidence

Focused commands:

```text
node tools/validate-wuxia-combat-audio-asset-requirements.mjs
  valid: true
  status: PASS WITH KNOWN LIMITATIONS
  5 audio cue rows; all 5 reference-only; 0 production-eligible references
  4 audited reference candidates

node tools/test-wuxia-combat-audio-asset-requirements.mjs
  PASS: schema, cue coverage, overlay parity and negative paths
```

Negative tests cover unknown/drifted reference IDs, false production satisfaction, non-OGG policy and a reference candidate incorrectly marked production-eligible. `project_scope.json`, `production_stage_plan.json`, `ROADMAP_20260804_TO_RELEASE.md` and `TRACEABILITY.md` include the same evidence paths.

## 6. Manual acceptance and limitations

The fresh combat browser run used for the adjacent ASSET-009 audit completed 15/15 steps with zero page console problems. The combat screen visibly remains a functional prototype with CSS geometric actors and a dark placeholder scene; it does not provide production audio evidence. This task therefore records:

- logical route reachability: PASS;
- audio production asset quality: BLOCKED;
- manual mix/device latency: NOT RUN because no owned OGG set exists;
- release readiness: BLOCKED.

The manual Gate C result is intentionally not upgraded by automated tests. Audio must be reviewed together with the target-bound VFX and actor presentation after approved assets are supplied.

## 7. Risks, rollback and next action

Risks:

- all five production cues remain reference-only;
- current `sfx_buff` reuses the heal exemplar and current `sfx_defeat` points to a music/challenge file;
- no ownership/licensing evidence, OGG import settings, loudness or true-peak measurements exist;
- no Android trigger-latency, concurrency, interruption or accessibility-volume evidence exists.

Rollback is limited to reverting this ASSET-010 manifest/schema/tool/doc integration; no runtime data or reference bytes changed. The next action is to supply owned/licensed OGG replacements, measure them on target devices and bind them only after ASSET-007～009 and COMBAT-002B visual gates are ready.
