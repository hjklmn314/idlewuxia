import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

const root = process.cwd();
const persistence = JSON.parse(fs.readFileSync(path.join(root, "config", "runtime_persistence_contract.json"), "utf8"));
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = process.env.WUXIA_URL || "http://127.0.0.1:5187/?observabilityAcceptance=OBS-001";
const outputDir = path.resolve(root, argValue("--out-dir", "outputs/obs001_browser_acceptance_20260809"));
const profileDir = path.resolve(root, argValue("--profile-dir", ".codex-os/temp/obs001-browser-profile"));
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(profileDir, { recursive: true });

const consoleProblems = [];
const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: edgePath,
  headless: true,
  viewport: { width: 390, height: 844 },
  args: ["--no-first-run", "--disable-default-apps"],
});
const page = context.pages()[0] || await context.newPage();
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

async function waitForRuntime() {
  await page.waitForFunction(
    () => Boolean(window.__idleWuxiaAutomation?.observabilityDiagnostics?.()),
    null,
    { timeout: 15_000 },
  );
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForRuntime();
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), [
    persistence.storageKey,
    persistence.stagingStorageKey,
    persistence.backupStorageKey,
    persistence.rollbackStorageKey,
  ]);
  await page.reload({ waitUntil: "networkidle" });
  await waitForRuntime();

  const results = await page.evaluate(() => ({
    rejected: window.__idleWuxiaAutomation.dispatchAction("ACTION_DOES_NOT_EXIST"),
    origin: window.__idleWuxiaAutomation.dispatchAction("ACTION_FS_001_ORIGIN_SCHOLAR"),
    continued: window.__idleWuxiaAutomation.dispatchAction("ACTION_FS_001_ORIGIN_RESULT_CONTINUE"),
    diagnostics: window.__idleWuxiaAutomation.observabilityDiagnostics(),
    events: window.__idleWuxiaAutomation.observabilityEvents(),
    replay: window.__idleWuxiaAutomation.exportRuntimeReplay(),
    snapshot: window.__idleWuxiaAutomation.snapshot(),
  }));

  assert.equal(results.rejected.clicked, false);
  assert.equal(results.origin.clicked, true);
  assert.equal(results.continued.clicked, true);
  assert.equal(results.snapshot.currentState, "STATE_FS_002_TITLE_START");
  assert.equal(results.diagnostics.status, "pass", JSON.stringify(results.diagnostics.dataQuality));
  assert.equal(results.diagnostics.replayCommandCount, 3);
  assert.equal(results.diagnostics.context.saveVersion, 2);
  assert.notEqual(results.diagnostics.context.sessionId, results.diagnostics.context.runId);
  assert.match(results.diagnostics.context.configHash, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(results.diagnostics.eventTypeCounts["runtime.session_started"], 1);
  assert.equal(results.diagnostics.eventTypeCounts["runtime.intent"], 3);
  assert.equal(results.diagnostics.eventTypeCounts["runtime.rejection"], 1);
  assert.ok(results.diagnostics.eventTypeCounts["runtime.performance_sample"] >= 1);
  assert.equal(results.replay.commands.length, 3);
  assert.ok(results.events.every((event) => event.privacyClass === "technical_no_pii"));
  assert.equal(JSON.stringify(results.events).includes("feedback"), false);
  assert.deepEqual(consoleProblems, []);

  const screenshot = "01_observability_wired_title_screen.png";
  await page.screenshot({ path: path.join(outputDir, screenshot) });
  const report = {
    schema: "idlewuxia.obs001_browser_acceptance.v1",
    generatedAt: new Date().toISOString(),
    status: "pass",
    viewport: "390x844",
    finalState: results.snapshot.currentState,
    diagnostics: results.diagnostics,
    replayId: results.replay.replayId,
    replayCommands: results.replay.commands.length,
    eventCount: results.events.length,
    consoleProblems,
    screenshots: [screenshot],
    profileDir,
  };
  fs.writeFileSync(path.join(outputDir, "obs001_browser_acceptance.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
}
