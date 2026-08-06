# Combat Reference Asset Development Overlay — 2026-08-07

## 1. Current state

The configuration-driven combat interpreter, combat-session state machine, player-turn boundary, chapter integration, attribute/effect calculations, and combat-content validators are implemented and covered by the current combat gates. This change adds a reversible development-only reference overlay so those systems can run against the locally available reference project's scene, audio, and buff-icon files without copying or shipping reference bytes.

This is a development integration record. It is not a final art or release acceptance record.

## 2. Why this overlay exists

The combat contract already names scenes, visual cues, audio cues, and buff icons. Before owned art is produced, a developer must be able to verify that those bindings resolve through the same runtime path used by the product. The overlay makes that path explicit while keeping the shipping `AssetRegistry` strict.

The source archive is read-only and remains outside the shipping set:

`H:\MyProjectBack\idlewuxia\fangzhijianghu\竞品资料\放置江湖apk\完整包内容归档\01_raw_apk_unpacked\product_fangzhijianghu_guanfang_2.1.01`

No reference binary is copied into `public/`, `www/`, `android/app/src/main/assets/public/`, or any release artifact.

## 3. Configuration and runtime chain

```text
config/wuxia_combat_reference_asset_overlay.json
  -> config/wuxia_combat_reference_asset_overlay.schema.json
  -> src/assetRegistry.js (development reference registry)
  -> src/wuxia-main.js (?referenceAssets=1 on localhost only)
  -> combat scene/audio/buff-icon presentation
```

The overlay is deliberately marked:

- `mode = development-only`
- `shippingAllowed = false`
- `sourcePolicy = reference-only`

The overlay currently contains 12 local references and 23 bindings:

| Group | Bindings | Current development source |
| --- | ---: | --- |
| Scene | 2 | `assets/res/OtherImage/Fight/Scene/leitai.png`, `shulin.png` |
| Audio | 5 | hit, heal, buff/control, parry, and defeat cues from `assets/res/Music/Fight/` and `biwu_tiaozhan_2.mp3` |
| Buff icon | 16 | `assets/res/OtherImage/BuffIcon/b01.png` through `d03.png` |

The runtime only activates this overlay when the browser is local and the URL explicitly contains `referenceAssets=1`. The production registry remains limited to approved, ship-adopted owned assets.

## 4. Explicit fallbacks and boundaries

The local reference archive does not provide a complete, verifiable side-view character/VFX/audio production set for the current combat content. Therefore:

- actor presentation remains an explicit CSS development fallback;
- VFX remains an explicit CSS feedback fallback;
- reference audio files are used only for local development playback;
- no missing file is silently treated as a production asset;
- no concrete reference identifier is hardcoded into the combat interpreter.

This preserves truthful semantics: a passing functional combat test does not become a claim that the final wuxia pixel-art presentation is complete.

## 5. Verification

The focused overlay gates are:

```powershell
cd H:\MyProjectBack\idlewuxia
npm.cmd run runtime:combat-reference-overlay:validate
npm.cmd run runtime:combat-reference-overlay:test
```

The validator checks schema shape, development-only policy, local asset registry resolution, and every binding. The focused test also checks unknown-ID rejection and rejects a mutated `shippingAllowed=true` overlay.

The overlay test is included in `task:preflight`. The normal combat gates remain authoritative:

```powershell
npm.cmd run runtime:combat-content:validate
npm.cmd run runtime:combat-module:audit
npm.cmd run runtime:combat-session:test
npm.cmd run runtime:combat-attributes:test
npm.cmd run runtime:combat-chapter-integration:test
npm.cmd run runtime:combat-player-turns:test
npm.cmd run runtime:combat-production-semantics:test
```

## 6. Release status

The functional/configuration portion of the combat module can be verified through the runtime and the development overlay. The production presentation portion remains `RELEASE_BLOCKED` until owned, approved assets are supplied and accepted for:

- side-view three-head-high character sprites and animations;
- clean scene backgrounds with runtime-mounted actors;
- authored VFX and hit-stop/readability treatment;
- owned audio files, mix, latency, mute, and device checks;
- final AssetRegistry entries and 11-screen × 3-size visual evidence;
- physical-device, performance, signed Release APK/AAB, store, monitoring, and rollback gates.

The following must not be marked complete by this overlay: `ASSET-007`, `ASSET-008`, `ASSET-009`, `ASSET-010`, `COMBAT-002B`, or the final release gate. They remain separate production tasks with explicit asset and device evidence requirements.
