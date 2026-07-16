import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function collectJsonKey(value, targetKey, currentPath = "$", hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonKey(item, targetKey, `${currentPath}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== "object") return hits;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (key === targetKey) hits.push({ path: childPath, object: value, value: child });
    collectJsonKey(child, targetKey, childPath, hits);
  }
  return hits;
}

const files = {
  main: readText("src/main.js"),
  index: readText("index.html"),
  weaponRuntime: readJson("config/weapon_runtime_tuning.json"),
  adDemos: readJson("config/ad_demo_timelines.json"),
  nova: readJson("config/boss_nova_reactor.json"),
  monetization: readJson("config/monetization_backend_contract.json"),
  iapCatalog: readJson("config/iap_product_catalog.json"),
  uiProgression: readJson("config/ui_progression_catalog.json"),
  latestSimulation: fs.existsSync(path.join(root, "outputs", "simulation_summary.json"))
    ? readJson("outputs/simulation_summary.json")
    : null,
};

const checks = [];

function addCheck(id, severity, status, message, evidence = {}) {
  checks.push({ id, severity, status, message, evidence });
}

const overlay = files.weaponRuntime.runtimeOverlay || {};
addCheck(
  "weapon-runtime-overlay-contract",
  "P1",
  overlay.status === "intentional_runtime_overlay" &&
    overlay.overlayFields?.includes("cooldown") &&
    overlay.overlayFields?.includes("dpsFactor") &&
    overlay.referenceDerivedFields?.includes("baseCost") &&
    overlay.referenceDerivedFields?.includes("growth")
    ? "pass"
    : "error",
  "Weapon cooldown/dpsFactor must be explicitly marked as runtime overlay while baseCost/growth remain reference-derived.",
  {
    status: overlay.status || "",
    overlayFields: overlay.overlayFields || [],
    referenceDerivedFields: overlay.referenceDerivedFields || [],
  },
);

const demoSpawnWaveActions = [];
for (const [demoId, timeline] of Object.entries(files.adDemos.demos || {})) {
  for (const [index, event] of (timeline || []).entries()) {
    if (event.action === "spawnWave") demoSpawnWaveActions.push(`${demoId}[${index}]`);
  }
}
const novaSpawnWave = collectJsonKey(files.nova, "spawnWave");
const badQaLegacy = collectJsonKey(files.nova, "qaLegacySpawnWave").filter((hit) => hit.object?.runtimeScope !== "qa_legacy");
addCheck(
  "legacy-spawnwave-demoted",
  "P1",
  demoSpawnWaveActions.length === 0 && novaSpawnWave.length === 0 && badQaLegacy.length === 0 ? "pass" : "error",
  "Old spawnWave paths must be removed from production-looking config or explicitly demoted to qaLegacySpawnWave with runtimeScope=qa_legacy.",
  {
    demoSpawnWaveActions,
    novaSpawnWavePaths: novaSpawnWave.map((hit) => hit.path),
    badQaLegacyPaths: badQaLegacy.map((hit) => hit.path),
  },
);

addCheck(
  "boss-debug-hook-hidden",
  "P1",
  !files.main.includes("ui.bossBtn.addEventListener") &&
    files.main.includes("ui.bossBtn.hidden = true") &&
    files.main.includes("ui.bossBtn.disabled = true") &&
    files.main.includes('ui.galaxyBossTabBtn.addEventListener("click", () => travelGalaxy("ad"))')
    ? "pass"
    : "error",
  "Standalone Boss button must remain hidden/disabled; Galaxy tab should route through configured travel/reward flow, not Enter Boss.",
  {
    hasBossButtonDom: files.index.includes('id="bossBtn"'),
    hasBossButtonClickHandler: files.main.includes("ui.bossBtn.addEventListener"),
    hidesBossButton: files.main.includes("ui.bossBtn.hidden = true"),
    disablesBossButton: files.main.includes("ui.bossBtn.disabled = true"),
  },
);

const catalogProducts = files.iapCatalog.products || [];
const pendingProducts = catalogProducts.filter(
  (product) =>
    product.status === "backend_pending" ||
    /^TODO_/.test(String(product.androidProductId || "")) ||
    /^TODO_/.test(String(product.iosProductId || "")),
);
const productCatalogStatus = files.monetization.targetProviders?.iap?.productCatalog?.status || "";
addCheck(
  "iap-sku-platform-mapping",
  "P1",
  pendingProducts.length === 0 ? "pass" : productCatalogStatus === "backend_pending" ? "gap" : "error",
  "Google Play/App Store product IDs are not complete until backend/store setup provides real SKU mappings.",
  {
    pendingCount: pendingProducts.length,
    totalProducts: catalogProducts.length,
    productCatalogStatus,
    samplePending: pendingProducts.slice(0, 8).map((product) => product.id),
  },
);

addCheck(
  "admob-target-no-applovin-runtime",
  "P1",
  files.monetization.targetProviders?.iaa?.primary === "admob" &&
    files.monetization.targetProviders?.iaa?.serverSideVerificationRequiredForRewarded === true &&
    !files.main.includes("AppLovin")
    ? "pass"
    : "error",
  "Runtime commercial target must stay on AdMob + SSV contract; AppLovin reference chain is evidence only.",
  {
    primary: files.monetization.targetProviders?.iaa?.primary || "",
    rewardedSsv: files.monetization.targetProviders?.iaa?.serverSideVerificationRequiredForRewarded === true,
  },
);

const sim = files.latestSimulation?.summary;
if (sim) {
  const earlyTarget = sim.pacingTargets?.earlyMedian || [0, 0];
  const firstTarget = sim.pacingTargets?.firstUpgrade || [0, Number.POSITIVE_INFINITY];
  const wait = Number(sim.pacing?.earlyPurchaseWaitP50Median ?? sim.upgradeWaitP50Median ?? 0);
  const firstWait = Number(sim.pacing?.firstUpgradeWaitMedian ?? 0);
  const roiWindowTarget = Number(sim.roiRotation?.maxBestChoiceShareTarget ?? 0.42);
  const bestChoiceP90 = Number(sim.roiRotation?.bestChoiceP90WindowMaxShareMedian ?? 1);
  const windowsOverTarget = Number(sim.roiRotation?.windowsOverTargetMedian ?? 1);
  const dominance = Number(sim.upgradeDominanceShare?.median ?? 1);
  const deadZones = Number(sim.deadZones?.totalCount ?? 1);
  const numericPass =
    wait >= earlyTarget[0] &&
    wait <= earlyTarget[1] &&
    firstWait >= firstTarget[0] &&
    firstWait <= firstTarget[1] &&
    bestChoiceP90 <= roiWindowTarget &&
    windowsOverTarget === 0 &&
    dominance <= roiWindowTarget &&
    deadZones === 0;
  addCheck(
    "numeric-pacing-simulation",
    "P2",
    numericPass ? "pass" : "gap",
    "Simulation pacing, first purchase, ROI rotation, upgrade dominance, and dead-zone counts must stay inside configured numeric targets.",
    {
      earlyPurchaseWaitP50Median: wait,
      firstUpgradeWaitMedian: firstWait,
      meaningfulWaitP50Median: sim.pacing?.meaningfulWaitP50Median ?? null,
      earlyMedianTarget: earlyTarget,
      firstUpgradeTarget: firstTarget,
      deadZones: sim.deadZones || {},
      roiRotation: sim.roiRotation || {},
      upgradeDominanceShare: sim.upgradeDominanceShare || {},
    },
  );
} else {
  addCheck("numeric-pacing-simulation", "P2", "gap", "Simulation summary has not been generated yet.", {});
}

const summary = checks.reduce(
  (acc, check) => {
    acc.total += 1;
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  },
  { total: 0, pass: 0, gap: 0, error: 0 },
);

const report = {
  generatedAt: new Date().toISOString(),
  scope: "explicit P1/P2 open item audit",
  summary,
  checks,
  findings: checks.filter((check) => check.status !== "pass"),
};

function markdown(data) {
  return [
    "# P1/P2 Open Item Audit",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Checks: ${data.summary.total}`,
    `- Passed: ${data.summary.pass}`,
    `- Gaps: ${data.summary.gap}`,
    `- Errors: ${data.summary.error}`,
    "",
    "## Checks",
    "",
    "| Status | Severity | ID | Message |",
    "| --- | --- | --- | --- |",
    ...data.checks.map((check) => `| ${check.status.toUpperCase()} | ${check.severity} | ${check.id} | ${check.message.replaceAll("|", "\\|")} |`),
    "",
    "## Findings",
    "",
    data.findings.length
      ? data.findings.map((check) => `- [${check.status.toUpperCase()}] ${check.id}: ${check.message}`).join("\n")
      : "- clean",
    "",
  ].join("\n");
}

fs.writeFileSync(path.join(outputDir, "p1p2_open_items_audit.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, "p1p2_open_items_audit.md"), markdown(report), "utf8");

console.log(JSON.stringify(summary, null, 2));

if (summary.error > 0) process.exit(1);
