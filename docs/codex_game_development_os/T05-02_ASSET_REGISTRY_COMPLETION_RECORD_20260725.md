# T05-02 AssetRegistry Completion Record — 2026-07-25

## Verdict

`PASS WITH KNOWN LIMITATIONS` for the T05-02 runtime/build-gate scope. T05-02 is complete in the authoritative production stage plan. Current 2026-08-09 authority: SAVE-001 and OBS-001 are also done; commercial release remains blocked by HYGIENE-001, T05-01/COMBAT-002B production presentation, ASSET-002..010, SEC-001 and release/device gates.

## Known facts

- The production authority remains `config/production/asset_registry.json`.
- The only approved shipping asset in this slice is `brand-icon-primary`.
- `config/wuxia_runtime_asset_registry.json` is a shipping projection containing only approved `adoption=ship` records.
- `src/assetRegistry.js` is the generic runtime resolver and activation guard; it does not name concrete gameplay content or reference-project assets.
- `tools/validate-wuxia-asset-registry.mjs` compares the production authority, runtime projection, project scope and on-disk bytes.

## Acceptance evidence

- Runtime registry tests: schema, projection parity, logical resolution, unknown-id rejection, unapproved rejection, path rejection and DOM binding all pass.
- Asset gate: 1 production shipping asset, 1 runtime asset, 0 findings.
- Web build: 24 scoped files, with runtime registry and resolver included; reference-only records are not in the shipping projection.
- Browser surface validation was rerun after resolver integration in `outputs/wuxia_visual_matrix/20260725_t0502_asset_registry_final2/browser_surface_sweep_report.json`: 30 active pairs passed, 3 combat pairs remained postponed, 0 blockers, 0 coverage gaps, and 3/3 modal cases passed. The favicon binding is applied before the first screen render and does not alter gameplay state semantics.

## Data and runtime chain

```text
production/asset_registry.json
  -> approved shipping subset
  -> wuxia_runtime_asset_registry.json
  -> createAssetRegistry()
  -> logical-id resolve / DOM binding
  -> web bundle closure
  -> hash, scope and forbidden-reference gate
```

## Rollback

Rollback is the previous commit plus removal of the runtime projection and resolver from `project_scope.shippingFiles`; no reference or competitor asset is copied during rollback.

## Unfinished

ASSET-002..006 still require production-owned Android, font, chapter-map, portrait and icon-family assets with per-file provenance, budgets and manual/device acceptance.
