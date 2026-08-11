import assert from "node:assert/strict";
import path from "node:path";

import {
  normalizeStaticRequestPathname,
  resolveStaticRequestPath,
} from "./dev-server-path-policy.mjs";

const root = path.resolve("test-fixtures", "idlewuxia-root");

assert.equal(normalizeStaticRequestPathname("/..\\idlewuxia-secret\\private.txt"), "../idlewuxia-secret/private.txt");

assert.deepEqual(
  resolveStaticRequestPath(root, "/"),
  { accepted: true, status: 200, reason: "", target: path.join(root, "index.html") },
);
assert.equal(resolveStaticRequestPath(root, "/src/wuxia-main.js?cache=1").target, path.join(root, "src", "wuxia-main.js"));
assert.equal(resolveStaticRequestPath(root, "/..%2Fidlewuxia-secret%2Fprivate.txt").status, 403);
assert.equal(resolveStaticRequestPath(root, "/%2e%2e%5cidlewuxia-secret%5cprivate.txt").status, 403);
assert.equal(resolveStaticRequestPath(root, "/%E0%A4%A").status, 400);
assert.equal(resolveStaticRequestPath(root, "/idlewuxia-safe.txt").accepted, true, "a filename sharing the root prefix must remain a normal in-root path");

console.log("dev server path policy tests: PASS (3 valid + 3 fail-closed paths)");
