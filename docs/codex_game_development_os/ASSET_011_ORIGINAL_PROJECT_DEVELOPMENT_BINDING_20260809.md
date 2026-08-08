# ASSET-011 Original Project Development Binding Audit — 2026-08-09

## Current state

The development combat overlay now has an explicit, configuration-driven source contract for the original project. It is activated only on localhost with `originalProjectAssets=1`; the previous `referenceAssets=1` query remains a compatibility alias. No source bytes were copied into `public/`, `www/`, Android assets, or a shipping registry.

## Configuration chain

```text
config/wuxia_combat_reference_asset_overlay.json
  -> schema + semantic validator
  -> createReferenceAssetRegistry()
  -> localhost query activation
  -> logical scene/audio/Buff bindings
  -> combat presentation
```

The manifest records `fangzhijianghu-original-project` as the source project, user-approved development-only use, an unverified shipping license state, and a hard non-shipping boundary. Runtime code still receives logical IDs; concrete paths exist only in the development overlay.

## Binding coverage

| Mount point | Development result | Coverage | Production meaning |
|---|---|---:|---|
| `combat.actor` | explicit missing | 0/2 actor sets | CSS debug fallback only; ASSET-007 remains open |
| `combat.scene` | original-project development binding | 2/2 scenes | reference-only; ASSET-008 remains open |
| `combat.vfx` | explicit missing | 0/28 VFX cues | CSS feedback fallback only; ASSET-009 remains open |
| `combat.vfx` Buff icons | original-project development binding | 16/16 logical rows, 6 unique files | reference-only; owned replacements remain required |
| `combat.audio` | original-project development binding | 5/5 logical rows, 4 MP3 files | MP3 is not the required OGG production input; ASSET-010 remains open |

The source archive was not treated as a production AssetRegistry entry. The production registry remains fail-closed and contains only approved shipping assets.

## Verification

Focused checks:

```powershell
npm.cmd run runtime:combat-reference-overlay:validate
npm.cmd run runtime:combat-reference-overlay:test
npm.cmd run runtime:combat-presentation:test
```

Results: schema and semantic validation PASS, 12 development assets and 23 logical bindings resolve, source-root and coverage drift checks PASS, and production overlay mutation remains rejected.

## Manual visual gate

Fresh localhost browser run:

- URL: `http://127.0.0.1:5187/?real-browser-flow=20260809&scenario=all-key-screens&originalProjectAssets=1`
- Viewport: `540x960`
- Flow: 15/15 steps, 0 failures, console problems 0
- Evidence: `outputs/asset_original_project_overlay_manual_20260809/14_early_combat_screen.png`

The clean original-project scene is visibly mounted in the combat stage, and the functional route is intact. The strict product visual gate remains **FAIL / production blocked** because the screenshot still shows CSS geometric actors, no authored VFX cue family, and no production OGG audio evidence. This is an honest development-binding acceptance, not an asset-production pass.

## Rollback and next action

Remove `originalProjectAssets=1` (or omit both overlay query parameters) to return to the shipping registry path. No code or configuration rollback is required to disable the overlay. Next production work is to supply approved side-view actor clips and authored VFX/OGG replacements, then bind them through the same logical IDs and repeat the three-viewport manual gate before COMBAT-002B.
