# COMBAT-002B original-project development binding acceptance — 2026-08-09

## Verdict

`PASS WITH KNOWN PRODUCTION LIMITATIONS` for the localhost development binding only.

`COMBAT-002B` remains `blocked` for production and release. This record proves that the active Web runtime can consume the user-approved original-project overlay through logical IDs for a clean scene, Buff icons and combat audio. It does not grant shipping permission and does not turn reference bytes into owned assets.

## Scope and authority

- Active project: `H:\MyProjectBack\idlewuxia`.
- Reference/development source: the read-only `fangzhijianghu` archive already present under this project.
- Activation: `?originalProjectAssets=1`, localhost only, disabled by default.
- Runtime authority: `src/wuxia-main.js` and `src/combatSession.js`.
- Asset authority: `config/wuxia_combat_reference_asset_overlay.json` for development and `config/wuxia_runtime_asset_registry.json` for shipping.
- Reference bytes are not allowed in the shipping registry, Android package or release artifact.

## Change completed

The combat playback path now consumes the authoritative live `CombatSession` event stream when one exists. It no longer reads only the static preview timeline. The playback selector also chooses the latest event with a configured `audioCueId` and does not consume the event sequence for a surrounding `skill`/`skillResolved` record with no audio cue. This closes a real runtime defect where a player-issued Buff or hit could update state and the Buff icon but silently skip its configured reference audio.

The new focused acceptance tool is:

```text
tools/run-wuxia-combat-reference-binding-acceptance.mjs
```

It starts a fresh real Edge session, activates the original-project overlay, enters the configured early combat, submits a configured player Buff skill, records the scene image, loaded Buff image, authoritative Buff events, media URL passed to `play()` and console/layout observations, and writes two screenshots plus a JSON/Markdown report.

## Automated and runtime evidence

Latest run:

```text
npm run runtime:combat-reference-binding:acceptance
```

After the screenshots are manually opened and reviewed, the reviewer may rerun the same command with `WUXIA_MANUAL_VISUAL_ACCEPTANCE=PASS_DEVELOPMENT_ONLY__PRODUCTION_BLOCKED` to record the human verdict in the generated report. The environment value is a review attestation, not an automated quality override.

Evidence directory (generated, not a Git shipping input):

```text
outputs/combat_reference_binding_acceptance_20260809_final/
```

Observed in fresh real-browser sessions at 540×960, 360×800 and 390×844:

- `data-wuxia-asset-mode=original-project-development`.
- Original-project clean scene loaded at 2160×853.
- `buff_guarded` and `buff_poisoned` each rendered with a loaded 52×52 reference icon.
- The live event stream contained `buff_guarded` and `buff_poisoned` with configured `sfx_buff` audio IDs.
- The media probe observed the configured original-project `buff.mp3` URL being passed to `play()`.
- Console error/warning count: `0`.
- Horizontal overflow: `0`.
- Player skill submission was accepted by the real runtime; no direct state mutation or fixture injection was used.

Viewport evidence directories:

- `outputs/combat_reference_binding_acceptance_20260809_final/`
- `outputs/combat_reference_binding_acceptance_20260809_360x800/`
- `outputs/combat_reference_binding_acceptance_20260809_390x844_retry/`

All six screenshots were manually opened. The development binding remains readable and within the viewport at all three sizes. The smaller viewports make the deliberately retained CSS fighters and dark reference scene more visibly inadequate; that observation is recorded as a production Gate C failure, not hidden by the binding PASS.

## Manual visual acceptance

The following screenshots were opened with the image viewer and reviewed at their native 540×960 viewport:

- [Before Buff](../../outputs/combat_reference_binding_acceptance_20260809_final/01_combat_reference_scene_before_buff.png)
- [After Buff, icon and audio binding](../../outputs/combat_reference_binding_acceptance_20260809_final/02_combat_reference_buff_and_audio_after_skill.png)

Development-binding visual review: `PASS` for scene mounting, Buff icon attachment/readability, combat control reachability, viewport fit and absence of console/layout failure.

Production visual review: `FAIL / BLOCKED` by deliberate policy. The screenshots still show CSS debug fighters, a dark/monochrome reference scene, no authored frame VFX and no owned OGG set. These are not hidden or relabeled as production quality.

## Coverage disposition

| Mount | Development result | Production disposition |
|---|---|---|
| `combat.scene` | 2/2 logical scene IDs resolve to original-project PNGs | Blocked: reference-only, ownership not verified |
| `combat.buff` | 16/16 logical Buff IDs resolve to 6 original-project icons | Blocked: reference-only, ownership not verified |
| `combat.audio` | 5/5 logical cues resolve to 4 original-project MP3s | Blocked: production requires owned/licensed OGG |
| `combat.actor` | 0/2 | Blocked: no eligible side-view three-head clip set in source archive |
| `combat.vfx` | 0/28 | Blocked: no frame-addressable source cue family in source archive |

## Gate result

- Gate A (file/config/schema/source policy): `PASS`.
- Gate B (runtime, focused regression, real browser binding): `PASS`.
- Gate C (manual product visual and release-quality presentation): `FAIL / BLOCKED`.

The next production dependency remains approved side-view actor clips, authored VFX/Buff frames and owned/licensed OGG replacements. Until those inputs exist, `ASSET-007` through `ASSET-010`, `COMBAT-002B`, `T05-01` and the release gates must remain open or blocked.
