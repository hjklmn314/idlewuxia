import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

const root = process.cwd();
const contract = JSON.parse(fs.readFileSync(path.join(root, "config", "runtime_persistence_contract.json"), "utf8"));
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = process.env.WUXIA_URL || "http://127.0.0.1:5187/?saveAcceptance=SAVE-001";
const outputDir = path.resolve(root, argValue("--out-dir", "outputs/save001_browser_acceptance_20260809"));
const profileDir = path.resolve(root, argValue("--profile-dir", ".codex-os/temp/save001-browser-profile"));
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
  await page.waitForFunction(() => Boolean(window.__idleWuxiaAutomation?.snapshot?.()), null, { timeout: 15_000 });
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForRuntime();
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), [
    contract.storageKey,
    contract.stagingStorageKey,
    contract.backupStorageKey,
    contract.rollbackStorageKey,
  ]);
  await page.reload({ waitUntil: "networkidle" });
  await waitForRuntime();

  const action = await page.evaluate(() => window.__idleWuxiaAutomation.dispatchAction("ACTION_FS_001_ORIGIN_SCHOLAR"));
  assert.equal(action.clicked, true);
  const v2Raw = await page.evaluate((key) => localStorage.getItem(key), contract.storageKey);
  const v2 = JSON.parse(v2Raw);
  assert.equal(v2.schemaVersion, 2);
  assert.equal(v2.state.currentState, "STATE_FS_001_ORIGIN_RESULT");

  await page.evaluate(({ contract: persistence, raw }) => {
    const legacy = JSON.parse(raw);
    legacy.$schema = persistence.legacyEnvelopeSchemas["1"];
    legacy.schemaVersion = 1;
    delete legacy.writeId;
    delete legacy.migration;
    delete legacy.checksum;
    localStorage.setItem(persistence.storageKey, JSON.stringify(legacy));
    localStorage.removeItem(persistence.stagingStorageKey);
    localStorage.removeItem(persistence.backupStorageKey);
    localStorage.removeItem(persistence.rollbackStorageKey);
  }, { contract, raw: v2Raw });

  await page.reload({ waitUntil: "networkidle" });
  await waitForRuntime();
  const migrated = await page.evaluate(() => ({
    persistence: window.__idleWuxiaAutomation.persistenceStatus(),
    snapshot: window.__idleWuxiaAutomation.snapshot(),
    bodyText: document.body.innerText,
  }));
  assert.equal(migrated.persistence.status, "restored_migrated");
  assert.equal(migrated.snapshot.currentState, "STATE_FS_001_ORIGIN_RESULT");
  assert.equal(migrated.snapshot.player.origin, "书香门第");
  assert.equal(migrated.bodyText.includes("配置加载失败"), false);
  await page.screenshot({ path: path.join(outputDir, "01_v1_migrated_to_v2.png") });

  await page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key));
    current.checksum.value = "00000000";
    localStorage.setItem(key, JSON.stringify(current));
  }, contract.storageKey);
  await page.reload({ waitUntil: "networkidle" });
  await waitForRuntime();
  const recovered = await page.evaluate(() => ({
    persistence: window.__idleWuxiaAutomation.persistenceStatus(),
    snapshot: window.__idleWuxiaAutomation.snapshot(),
    bodyText: document.body.innerText,
  }));
  assert.equal(recovered.persistence.status, "restored_recovered");
  assert.equal(recovered.persistence.recoverySource, "backup");
  assert.equal(recovered.snapshot.currentState, "STATE_FS_001_ORIGIN_RESULT");
  assert.equal(recovered.snapshot.player.origin, "书香门第");
  assert.equal(recovered.bodyText.includes("配置加载失败"), false);
  await page.screenshot({ path: path.join(outputDir, "02_corrupt_primary_recovered_from_backup.png") });

  assert.deepEqual(consoleProblems, []);
  const report = {
    schema: "idlewuxia.save001_browser_acceptance.v1",
    generatedAt: new Date().toISOString(),
    status: "pass",
    viewport: "390x844",
    migratedStatus: migrated.persistence,
    recoveredStatus: recovered.persistence,
    restoredState: recovered.snapshot.currentState,
    restoredOrigin: recovered.snapshot.player.origin,
    consoleProblems,
    screenshots: [
      "01_v1_migrated_to_v2.png",
      "02_corrupt_primary_recovered_from_backup.png",
    ],
    profileDir,
  };
  fs.writeFileSync(path.join(outputDir, "save001_browser_acceptance.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
}
