# ASSET-CONTRACT-001 Completion Record — 2026-08-06

## Current state

The production asset contract is frozen and machine-valid. This closes the
contract-definition slice only; it does not claim that the ten open product
asset slots are supplied or visually accepted.

## Authority and scope

- Authority: `config/production/asset_contract.json`.
- Schema: `config/production/schemas/asset_contract.schema.json`.
- Production source registry remains `config/production/asset_registry.json`.
- Runtime projection remains `config/wuxia_runtime_asset_registry.json`.
- Validator: `tools/validate-production-asset-contract.mjs`.
- Negative and live tests: `tools/test-production-asset-contract.mjs`.

The contract records a logical ID, source path, provenance, ownership or
verified license, SHA-256, byte budget, dimensions, pivot, alpha policy,
runtime mount point and fallback policy. Slot rules are explicit for the
side-view character set, clean scenes, VFX, audio, UI, fonts and Android
launcher assets.

## Fail-closed rules now executable

The validator rejects:

- front/back/three-quarter character views;
- head proportions outside 2.7–3.3 heads;
- missing idle, walk, attack, hurt, control or defeat clips;
- walk cycles whose left/right foot phases do not alternate;
- scenes containing baked characters;
- unknown or wrong-kind runtime mount points;
- source/hash/byte drift and per-asset budget overflow;
- unverified third-party or reference-only sources;
- synthesized or silent audio fallback in production records.
- combat bindings that still point at CSS fallbacks, unresolved logical IDs or
  oscillator audio when strict production mode is requested.

`npm run production:asset-contract` validates the frozen contract and the
currently satisfied brand-icon record. `npm run production:asset-contract:strict`
intentionally remains red until all required slots have approved bytes. That
red result is a product-asset blocker, not a contract-tool failure.

## Gate evidence

- Gate A: JSON Schema, source/hash, ownership and mount-point checks pass.
- Gate B: ten live/negative cases pass in
  `npm run production:asset-contract:test`.
- Gate C: this task changes no screen or shipped art bytes. The strict human
  visual gate therefore remains assigned to ASSET-002–010, COMBAT-002B and
  T05-01; it is not inferred from this configuration pass.

## Rollback

Revert the single commit containing the contract, schema, validator, tests,
toolchain entries and stage-plan evidence. No runtime asset bytes or ignored
evidence are modified by this task.

## Remaining blockers

ASSET-002 through ASSET-010 remain open. The contract is deliberately useful
before asset production: a malformed future asset fails before it can enter the
runtime or APK.
