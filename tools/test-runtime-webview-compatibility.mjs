import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const originalStructuredClone = globalThis.structuredClone;
globalThis.structuredClone = undefined;

try {
  const runtime = createFirstSessionRuntime({
    schema: "idlewuxia.first-session.test",
    states: [{ stateId: "start", screenId: "start" }],
    actions: [],
    playerSeed: {
      name: "compatibility-test",
      inventory: { tea: 2 },
      skillExp: { sword: 3 },
      nested: { values: [1, { enabled: true }] },
    },
  });
  const snapshot = runtime.snapshot();
  assert.deepEqual(snapshot.player.inventory, { tea: 2 });
  assert.deepEqual(snapshot.player.nested, { values: [1, { enabled: true }] });

  snapshot.player.inventory.tea = 999;
  assert.equal(runtime.snapshot().player.inventory.tea, 2, "snapshots must remain detached from runtime state");
} finally {
  globalThis.structuredClone = originalStructuredClone;
}

const forbiddenRuntimePatterns = ["structuredClone(", ".at(", ".replaceAll("];
for (const relativePath of ["src/wuxiaFirstSessionFlow.js", "src/runtimePersistence.js", "src/wuxia-main.js"]) {
  const source = fs.readFileSync(path.resolve(relativePath), "utf8");
  for (const pattern of forbiddenRuntimePatterns) {
    assert.equal(
      source.includes(pattern),
      false,
      `${relativePath} must not use legacy-WebView-incompatible runtime pattern ${pattern}`,
    );
  }
}

console.log("runtime WebView compatibility tests: PASS (legacy clone + detached snapshot + boundary)");
