const targetUrl = process.argv[2] || "http://127.0.0.1:5187/?assert=wuxia-dev-server";

const requiredSnippets = [
  "<title>放置江湖首局原型</title>",
  'id="wuxiaShell"',
];

const oldPrototypeSnippets = [
  "<title>Idle Dot Shooter</title>",
  "GALAXY 1: VOID",
  "Offline Cap",
  "Welcome Back",
  "TURRET",
];

function fail(message, details = {}) {
  console.error(JSON.stringify({ passed: false, message, ...details }, null, 2));
  process.exit(1);
}

let response;
try {
  response = await fetch(targetUrl, { cache: "no-store" });
} catch (error) {
  fail("Wuxia dev server is not reachable", { targetUrl, error: error.message });
}

if (!response.ok) {
  fail("Wuxia dev server returned a non-OK response", {
    targetUrl,
    status: response.status,
    statusText: response.statusText,
  });
}

const html = await response.text();
const missing = requiredSnippets.filter((snippet) => !html.includes(snippet));
const oldPrototypeSignals = oldPrototypeSnippets.filter((snippet) => html.includes(snippet));
const hardForbidden = oldPrototypeSignals.filter((snippet) => snippet.includes("<title>"));

if (missing.length || hardForbidden.length) {
  fail("Dev server is not serving the Wuxia first-session entry", {
    targetUrl,
    missing,
    hardForbidden,
    preview: html.slice(0, 500),
  });
}

console.log(JSON.stringify({
  passed: true,
  targetUrl,
  required: requiredSnippets.length,
  oldPrototypeSignals,
  note: oldPrototypeSignals.length
    ? "Legacy prototype DOM still exists in the static shell; real visible-content checks must use browser/JS validation."
    : "No legacy prototype static signals found.",
}, null, 2));
