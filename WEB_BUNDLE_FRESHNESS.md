# Web Bundle Freshness Contract

T01-02 guarantees that the active HTML runtime is reproducibly carried from
tracked source files into `www` and then into Capacitor's Android asset tree.

## Sources of truth

- `config/project_scope.json` owns the exact product shipping
  allowlist and the evidence-sanitization transform.
- `config/web_bundle_contract.json` owns the three layer roots, SHA-256
  manifest format, output locations, and the explicit Capacitor-generated file
  allowlist.
- `tools/lib/web-bundle-freshness.mjs` is the deep module used by the build
  and freshness gate. Callers do not reimplement transforms or hash rules.

## Hash invariants

Files declared with `copy` use identical source, expected output, `www`, and Android asset
SHA-256 values must all match.

Runtime JSON files use `sanitize_json`. Their tracked source may retain
development evidence, so the manifest records both the source hash and the
deterministically sanitized expected-output hash. For these files the required
equality is:

`deterministic transformed output = www = Android assets`.

Capacitor 6 additionally creates empty `cordova.js` and
`cordova_plugins.js` files. They are platform outputs, not product source
files, and their exact byte count and hash are declared in the contract. Any
other file in `www` or the Android public asset tree is blocking.

## Commands

```bash
npm run web:freshness:test
npm run android:sync
npm run web:freshness
```

`android:sync` performs the scoped web build, Capacitor sync, and the
three-layer freshness gate. The machine report is written to
`outputs/web_bundle_freshness/web_bundle_manifest.json` and remains ignored
build evidence.

The report must have `status=pass`, every scope-declared shipping file present,
every declared transform matched, two platform-generated files, zero unexpected files, and zero
findings. A passing freshness report proves asset provenance and byte freshness;
it does not replace APK binary inspection or device acceptance.
