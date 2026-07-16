import assert from "node:assert/strict";
import { createMemoryFileSystem, evaluateProjectBaseline } from "./lib/project-baseline.mjs";

const scope = {
  projectId: "idlewuxia",
  htmlEntry: "index.html",
  activeEntry: "src/wuxia-main.js",
  activeRuntimeFiles: ["index.html", "src/wuxia-main.js"],
  activeConfigFiles: ["config/flow.json"],
  developmentReferenceFiles: ["config/reference.json"],
  shippingFiles: ["index.html", "src/wuxia-main.js", "config/flow.json"],
  forbiddenTrackedRoots: ["outputs/", "fangzhijianghu/"],
  trackedCategories: [
    { id: "repository", exact: ["index.html"] },
    { id: "runtime", prefixes: ["src/", "config/"] },
  ],
  unknownTrackedPathPolicy: "reject",
};
const contract = {
  maxTrackedFileBytes: 1024 * 1024,
  textLineEndingCanonicalization: "lf",
  fatalFindingCodes: [
    "MISSING_REQUIRED_FILE",
    "FORBIDDEN_TRACKED_PATH",
    "UNKNOWN_TRACKED_PATH",
    "TRACKED_FILE_TOO_LARGE",
    "UNTRACKED_NONIGNORED_FILE",
    "INVALID_HTML_ENTRY",
    "MISSING_ACTIVE_CONFIG_REFERENCE",
    "DEVELOPMENT_REFERENCE_IN_ACTIVE_RUNTIME",
    "DEVELOPMENT_REFERENCE_IN_SHIPPING_SET",
    "GIT_STATE_UNAVAILABLE",
    "DIRTY_WORKTREE",
    "UPSTREAM_DIVERGED",
  ],
  releaseGate: { requireHeadEqualsUpstreamWhenConfigured: true },
};
const validFiles = {
  "index.html": '<script type="module" src="./src/wuxia-main.js"></script>',
  "src/wuxia-main.js": 'fetch("./config/flow.json");',
  "config/flow.json": "{}",
};
const validTracked = Object.keys(validFiles);

function evaluate(overrides = {}) {
  const files = overrides.files || validFiles;
  return evaluateProjectBaseline({
    fileSystem: createMemoryFileSystem(files),
    scope: overrides.scope || scope,
    contract,
    trackedFiles: overrides.trackedFiles || Object.keys(files),
    untrackedFiles: overrides.untrackedFiles || [],
    gitState: overrides.gitState || { available: true, dirty: false },
    requireClean: overrides.requireClean || false,
    requireUpstream: overrides.requireUpstream || false,
  });
}

assert.equal(evaluate({ trackedFiles: validTracked }).pass, true, "valid scope must pass");

const forbidden = evaluate({
  files: { ...validFiles, "outputs/leak.json": "{}" },
});
assert.equal(forbidden.pass, false);
assert.ok(forbidden.findings.some((row) => row.code === "FORBIDDEN_TRACKED_PATH"));

const unknown = evaluate({ files: { ...validFiles, "mystery.bin": "x" } });
assert.equal(unknown.pass, false);
assert.ok(unknown.findings.some((row) => row.code === "UNKNOWN_TRACKED_PATH"));

const wrongEntry = evaluate({
  files: { ...validFiles, "index.html": '<script type="module" src="./src/main.js"></script>' },
});
assert.ok(wrongEntry.findings.some((row) => row.code === "INVALID_HTML_ENTRY"));

const evidenceLeak = evaluate({
  files: { ...validFiles, "src/wuxia-main.js": 'fetch("./config/flow.json"); fetch("./config/reference.json");' },
});
assert.ok(evidenceLeak.findings.some((row) => row.code === "DEVELOPMENT_REFERENCE_IN_ACTIVE_RUNTIME"));

const untracked = evaluate({ untrackedFiles: ["scratch.txt"], trackedFiles: validTracked });
assert.ok(untracked.findings.some((row) => row.code === "UNTRACKED_NONIGNORED_FILE"));

const cleanGate = evaluate({ gitState: { dirty: true }, requireClean: true, trackedFiles: validTracked });
assert.ok(cleanGate.findings.some((row) => row.code === "DIRTY_WORKTREE"));

const gitUnavailable = evaluate({ gitState: { available: false }, trackedFiles: validTracked });
assert.ok(gitUnavailable.findings.some((row) => row.code === "GIT_STATE_UNAVAILABLE"));

const upstreamGate = evaluate({
  gitState: { available: true, head: "local", upstreamHead: "remote", upstreamConfigured: true },
  requireUpstream: true,
  trackedFiles: validTracked,
});
assert.ok(upstreamGate.findings.some((row) => row.code === "UPSTREAM_DIVERGED"));

const firstDigest = evaluate({ trackedFiles: [...validTracked].reverse() }).baselineDigest;
const secondDigest = evaluate({ trackedFiles: validTracked }).baselineDigest;
assert.equal(firstDigest, secondDigest, "baseline digest must not depend on Git listing order");

const lfDigest = evaluate({
  files: { ...validFiles, "src/wuxia-main.js": 'fetch("./config/flow.json");\n' },
}).baselineDigest;
const crlfDigest = evaluate({
  files: { ...validFiles, "src/wuxia-main.js": 'fetch("./config/flow.json");\r\n' },
}).baselineDigest;
assert.equal(lfDigest, crlfDigest, "baseline digest must be stable across LF and CRLF checkouts");

console.log("project baseline contract tests: PASS (10 cases)");
