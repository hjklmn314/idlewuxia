import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const worlds = JSON.parse(fs.readFileSync(path.join(root, "config", "original_world_scaling.json"), "utf8"));
const overlay = JSON.parse(fs.readFileSync(path.join(root, "config", "optimized_balance_overlay.p0e.json"), "utf8"));

const economy = overlay.economy || {};
const familyConfig = economy.upgradeFamilies || {};
const pacingTargets = economy.pacingTargetsSeconds || {};
const roiRules = economy.roiRotation || {};
const logCostModel = economy.logCostModel || {};
const windowSizePurchases = Number(roiRules.windowSizePurchases || 12);
const maxBestChoiceShare = Number(roiRules.maxBestChoiceShareOverWindow || 0.42);
const deadZoneThreshold = Number(pacingTargets.hardDeadZoneWarning || 240);
const meaningfulWaitFloor = Number(pacingTargets.meaningfulWaitFloor || 3);
const earlyPurchaseCount = Number(pacingTargets.earlyPurchaseCount || 18);
const midPurchaseCount = Number(pacingTargets.midPurchaseCount || 48);

const FAMILY_DEFAULTS = {
  damage: { baseCost: 12, growth: 1.52, incomeElasticity: 0.72, targetRoiShare: 0.28 },
  rate: { baseCost: 18, growth: 1.58, incomeElasticity: 0.68, targetRoiShare: 0.24 },
  value: { baseCost: 24, growth: 1.62, incomeElasticity: 0.72, targetRoiShare: 0.26 },
  systems: { baseCost: 92, growth: 1.58, incomeElasticity: 0.5, targetRoiShare: 0.22 },
};

const FAMILIES = Object.keys(FAMILY_DEFAULTS);

function averageRange(range, fallback) {
  if (!Array.isArray(range) || range.length < 2) return fallback;
  const a = Number(range[0]);
  const b = Number(range[1]);
  return Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : fallback;
}

function familySpec(family) {
  const config = familyConfig[family] || {};
  const defaults = FAMILY_DEFAULTS[family];
  return {
    baseCost:
      Number(config.baseCost) ||
      (family === "systems" && Array.isArray(config.baseCostRange) ? Number(config.baseCostRange[0]) : 0) ||
      averageRange(config.baseCostRange, defaults.baseCost),
    growth:
      Number(config.growth) ||
      averageRange(config.growthRange, defaults.growth),
    incomeElasticity: Number(config.incomeElasticity) || defaults.incomeElasticity,
    targetRoiShare: Number(config.targetRoiShare) || defaults.targetRoiShare,
  };
}

function cost(family, level, worldIndex) {
  const spec = familySpec(family);
  const softCapAfter = Number(logCostModel.softCapAfterLevel || 42);
  const softCapExtraGrowth = Number(logCostModel.softCapExtraGrowth || 0.018);
  const worldCostMultiplier = Number(logCostModel.worldCostMultiplierPerWorld || 0.26);
  const cappedLevel = Math.max(0, level);
  const softCapLevel = Math.max(0, cappedLevel - softCapAfter);
  const growth = spec.growth + softCapLevel * softCapExtraGrowth;
  return spec.baseCost * Math.pow(growth, cappedLevel) * (1 + worldIndex * worldCostMultiplier);
}

function familyFactor(family, level) {
  const spec = familySpec(family);
  const diminishing = 1 + Math.max(0, level - 35) * 0.006;
  return 1 + (level * spec.incomeElasticity) / diminishing;
}

function incomePerSecond(upgrades, worldIndex) {
  const damage = familyFactor("damage", upgrades.damage);
  const rate = familyFactor("rate", upgrades.rate);
  const value = familyFactor("value", upgrades.value);
  const systems = familyFactor("systems", upgrades.systems);
  const incomeScale = Number(logCostModel.incomeScale || 0.42);
  return damage * rate * value * systems * Math.pow(1.18, worldIndex) * incomeScale;
}

function deltaLogIncome(family, upgrades) {
  const current = familyFactor(family, upgrades[family]);
  const next = familyFactor(family, upgrades[family] + 1);
  return Math.log(next / current);
}

function optionRois(upgrades, worldIndex) {
  return FAMILIES.map((family) => {
    const upgradeCost = cost(family, upgrades[family], worldIndex);
    return {
      family,
      cost: upgradeCost,
      deltaLogIncome: deltaLogIncome(family, upgrades),
      roi: deltaLogIncome(family, upgrades) / upgradeCost,
    };
  }).sort((a, b) => b.roi - a.roi);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return Number(sorted[index].toFixed(3));
}

function median(values) {
  return percentile(values, 0.5);
}

function addCount(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount;
}

function shareMap(counts, total) {
  return Object.fromEntries(
    FAMILIES.map((family) => [family, Number(((counts[family] || 0) / Math.max(1, total)).toFixed(4))]),
  );
}

function slidingWindows(families, size) {
  if (families.length < size) {
    if (families.length < 3) return [];
    const counts = {};
    for (const family of families) addCount(counts, family);
    const maxCount = Math.max(...Object.values(counts));
    return [
      {
        startPurchase: 1,
        endPurchase: families.length,
        partial: true,
        maxShare: Number((maxCount / families.length).toFixed(4)),
        uniqueChoices: Object.keys(counts).length,
        dominantFamily: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
        counts,
      },
    ];
  }
  const windows = [];
  for (let start = 0; start <= families.length - size; start += 1) {
    const slice = families.slice(start, start + size);
    const counts = {};
    for (const family of slice) addCount(counts, family);
    const maxCount = Math.max(...Object.values(counts));
    windows.push({
      startPurchase: start + 1,
      endPurchase: start + size,
      maxShare: Number((maxCount / size).toFixed(4)),
      uniqueChoices: Object.keys(counts).length,
      dominantFamily: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
      counts,
    });
  }
  return windows;
}

function summarizeRotation(bestRoiFamilies, purchaseFamilies) {
  const bestWindows = slidingWindows(bestRoiFamilies, windowSizePurchases);
  const purchaseWindows = slidingWindows(purchaseFamilies, windowSizePurchases);
  return {
    windowSizePurchases,
    maxBestChoiceShareTarget: maxBestChoiceShare,
    bestChoiceWindowCount: bestWindows.length,
    purchaseWindowCount: purchaseWindows.length,
    bestChoiceAvgWindowMaxShare: Number((bestWindows.reduce((sum, row) => sum + row.maxShare, 0) / Math.max(1, bestWindows.length)).toFixed(4)),
    bestChoiceP90WindowMaxShare: percentile(bestWindows.map((row) => row.maxShare), 0.9),
    purchaseAvgWindowMaxShare: Number((purchaseWindows.reduce((sum, row) => sum + row.maxShare, 0) / Math.max(1, purchaseWindows.length)).toFixed(4)),
    purchaseP90WindowMaxShare: percentile(purchaseWindows.map((row) => row.maxShare), 0.9),
    windowsOverTarget: bestWindows.filter((row) => row.maxShare > maxBestChoiceShare).length,
    avgUniqueBestChoices: Number((bestWindows.reduce((sum, row) => sum + row.uniqueChoices, 0) / Math.max(1, bestWindows.length)).toFixed(3)),
  };
}

function meaningful(values) {
  return values.filter((value) => value >= meaningfulWaitFloor);
}

function waitMedian(values) {
  return median(meaningful(values));
}

function waitP90(values) {
  return percentile(meaningful(values), 0.9);
}

function simulate(seed) {
  let money = 0;
  let time = 0;
  let worldIndex = 0;
  const upgrades = { damage: 0, rate: 0, value: 0, systems: 0 };
  const waits = [];
  const bossTtks = [];
  const purchaseCounts = {};
  const bestRoiCounts = {};
  const purchaseFamilies = [];
  const bestRoiFamilies = [];
  const purchaseEvents = [];
  const deadZones = [];
  let lastUpgradeTime = 0;
  let inDeadZone = false;
  let maxWaitObserved = 0;

  for (let step = 0; step < 4000 && worldIndex < 12; step += 1) {
    const incomeJitter = 0.985 + ((seed + step) % 5) * 0.0075;
    money += incomePerSecond(upgrades, worldIndex) * incomeJitter;
    time += 1;
    maxWaitObserved = Math.max(maxWaitObserved, time - lastUpgradeTime);

    if (!inDeadZone && time - lastUpgradeTime > deadZoneThreshold) {
      inDeadZone = true;
      deadZones.push({
        startedAt: time,
        worldReached: worldIndex + 1,
        waitSeconds: time - lastUpgradeTime,
      });
    }

    const options = optionRois(upgrades, worldIndex);
    const best = options[0];
    const affordable = options.find((option) => money >= option.cost);

    if (affordable) {
      money -= affordable.cost;
      upgrades[affordable.family] += 1;
      const wait = time - lastUpgradeTime;
      waits.push(wait);
      lastUpgradeTime = time;
      inDeadZone = false;
      addCount(purchaseCounts, affordable.family);
      addCount(bestRoiCounts, best.family);
      purchaseFamilies.push(affordable.family);
      bestRoiFamilies.push(best.family);
      purchaseEvents.push({
        family: affordable.family,
        wait,
        time,
        worldReached: worldIndex + 1,
      });
    }

    const bossEvery = 90 + worldIndex * 12;
    if (time > 0 && time % bossEvery === 0) {
      const targetTtk = 34 + worldIndex * 5;
      bossTtks.push(targetTtk * (0.85 + ((seed + step) % 7) * 0.05));
      const rewardSeconds =
        Number(logCostModel.bossRewardIncomeSecondsBase || 2) +
        worldIndex * Number(logCostModel.bossRewardIncomeSecondsPerWorld || 0.5);
      money += incomePerSecond(upgrades, worldIndex) * rewardSeconds;
      worldIndex += 1;
    }
  }

  const totalPurchases = purchaseFamilies.length;
  const purchaseShares = shareMap(purchaseCounts, totalPurchases);
  const bestRoiShares = shareMap(bestRoiCounts, Math.max(1, bestRoiFamilies.length));
  const dominantEntry = Object.entries(purchaseCounts).sort((a, b) => b[1] - a[1])[0] || ["", 0];
  const earlyEvents = purchaseEvents.slice(0, earlyPurchaseCount);
  const midEvents = purchaseEvents.slice(earlyPurchaseCount, midPurchaseCount);
  const lateEvents = purchaseEvents.slice(midPurchaseCount);
  const meaningfulWaits = meaningful(waits);

  return {
    seed,
    worldReached: worldIndex + 1,
    upgrades: Object.values(upgrades).reduce((sum, value) => sum + value, 0),
    upgradeWaitP50: percentile(waits, 0.5),
    upgradeWaitP90: percentile(waits, 0.9),
    bossTtkP50: percentile(bossTtks, 0.5),
    bossTtkP90: percentile(bossTtks, 0.9),
    economy: {
      finalUpgradeLevels: upgrades,
      pacing: {
        firstUpgradeWait: purchaseEvents[0]?.wait || 0,
        meaningfulWaitFloor,
        meaningfulPurchaseCount: meaningfulWaits.length,
        meaningfulWaitP50: median(meaningfulWaits),
        meaningfulWaitP90: percentile(meaningfulWaits, 0.9),
        earlyPurchaseWaitP50: waitMedian(earlyEvents.map((event) => event.wait)),
        earlyPurchaseWaitP90: waitP90(earlyEvents.map((event) => event.wait)),
        midPurchaseWaitP50: waitMedian(midEvents.map((event) => event.wait)),
        midPurchaseWaitP90: waitP90(midEvents.map((event) => event.wait)),
        latePurchaseWaitP50: waitMedian(lateEvents.map((event) => event.wait)),
        latePurchaseWaitP90: waitP90(lateEvents.map((event) => event.wait)),
      },
      purchaseCounts,
      purchaseShares,
      bestRoiShares,
      upgradeDominanceShare: Number((dominantEntry[1] / Math.max(1, totalPurchases)).toFixed(4)),
      dominantFamily: dominantEntry[0],
      roiRotation: summarizeRotation(bestRoiFamilies, purchaseFamilies),
      deadZones: {
        thresholdSeconds: deadZoneThreshold,
        count: deadZones.length,
        upgradeWaitsOverThreshold: waits.filter((wait) => wait > deadZoneThreshold).length,
        maxWaitObserved,
        events: deadZones,
      },
    },
  };
}

function aggregateFamilyShare(runs, key) {
  const counts = {};
  let total = 0;
  for (const run of runs) {
    for (const [family, count] of Object.entries(run.economy[key] || {})) {
      addCount(counts, family, count);
      total += count;
    }
  }
  return shareMap(counts, total);
}

function dominantFamilyFromShare(shares) {
  return Object.entries(shares).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function markdownReport(summary) {
  const purchaseShares = Object.entries(summary.upgradeDominanceShare.aggregatePurchaseShare)
    .map(([family, share]) => `${family} ${(share * 100).toFixed(1)}%`)
    .join(", ");
  const earlyTarget = summary.pacingTargets.earlyMedian || [0, 0];
  const earlyWait = summary.pacing?.earlyPurchaseWaitP50Median ?? summary.upgradeWaitP50Median;
  const timingRead =
    earlyTarget[0] && earlyWait < earlyTarget[0]
      ? "- Upgrade cadence is faster than the early median pacing target; the overlay needs either softer income elasticity or stronger cost growth after reward spikes."
      : earlyTarget[1] && earlyWait > earlyTarget[1]
        ? "- Upgrade cadence is slower than the early median pacing target; the overlay risks idle dead air before the next clear purchase."
        : "- Upgrade cadence is inside the early median pacing target.";
  return [
    "# Simulation Economy Metrics",
    "",
    `Generated: ${summary.generatedAt}`,
    `Overlay: ${summary.balanceOverlay}`,
    "",
    "## Timing",
    "",
    `- Median world reached: ${summary.medianWorldReached}`,
    `- Upgrade wait median/P90 median: ${summary.upgradeWaitP50Median}s / ${summary.upgradeWaitP90Median}s`,
    `- First upgrade wait median: ${summary.pacing.firstUpgradeWaitMedian}s`,
    `- Meaningful wait median/P90 median: ${summary.pacing.meaningfulWaitP50Median}s / ${summary.pacing.meaningfulWaitP90Median}s`,
    `- Early purchase meaningful wait median/P90: ${summary.pacing.earlyPurchaseWaitP50Median}s / ${summary.pacing.earlyPurchaseWaitP90Median}s`,
    `- Mid purchase meaningful wait median/P90: ${summary.pacing.midPurchaseWaitP50Median}s / ${summary.pacing.midPurchaseWaitP90Median}s`,
    `- Late purchase meaningful wait median/P90: ${summary.pacing.latePurchaseWaitP50Median}s / ${summary.pacing.latePurchaseWaitP90Median}s`,
    `- Boss TTK median/P90 median: ${summary.bossTtkP50Median}s / ${summary.bossTtkP90Median}s`,
    "",
    "## ROI Rotation",
    "",
    `- Target max best-choice share per ${summary.roiRotation.windowSizePurchases} purchases: ${(summary.roiRotation.maxBestChoiceShareTarget * 100).toFixed(0)}%`,
    `- Median average best-choice window max share: ${(summary.roiRotation.bestChoiceAvgWindowMaxShareMedian * 100).toFixed(1)}%`,
    `- P90 best-choice window max share median: ${(summary.roiRotation.bestChoiceP90WindowMaxShareMedian * 100).toFixed(1)}%`,
    `- Median windows over target per run: ${summary.roiRotation.windowsOverTargetMedian}`,
    "",
    "## Upgrade Dominance",
    "",
    `- Aggregate dominant family: ${summary.upgradeDominanceShare.aggregateDominantFamily}`,
    `- Aggregate purchase share: ${purchaseShares}`,
    `- Median single-family dominance per run: ${(summary.upgradeDominanceShare.median * 100).toFixed(1)}%`,
    "",
    "## Dead Zones",
    "",
    `- Threshold: ${summary.deadZones.thresholdSeconds}s without an upgrade`,
    `- Total dead-zone entries: ${summary.deadZones.totalCount}`,
    `- Runs with dead zones: ${summary.deadZones.runsWithDeadZones}/${summary.runs}`,
    `- Median max wait observed: ${summary.deadZones.maxWaitObservedMedian}s`,
    "",
    "## Read",
    "",
    timingRead,
    summary.deadZones.totalCount > 0
      ? "- The overlay still creates idle dead zones in some long-tail runs; late-world costs should be softened or reward spikes should be added before live tuning."
      : "- No hard dead zones appeared under this overlay in the 100-run smoke simulation.",
    summary.upgradeDominanceShare.median > maxBestChoiceShare
      ? "- Upgrade dominance is above the ROI rotation target; one family is still too often the obvious purchase."
      : "- Upgrade dominance is inside the target band, so the economy is rotating purchase intent reasonably well.",
    "",
  ].join("\n");
}

const runs = Array.from({ length: 100 }, (_, index) => simulate(index + 1));
const aggregatePurchaseShare = aggregateFamilyShare(runs, "purchaseCounts");
const aggregateBestRoiShare = aggregateFamilyShare(runs, "bestRoiShares");
const summary = {
  generatedAt: new Date().toISOString(),
  runs: runs.length,
  medianWorldReached: median(runs.map((run) => run.worldReached)),
  upgradeWaitP50Median: median(runs.map((run) => run.upgradeWaitP50)),
  upgradeWaitP90Median: median(runs.map((run) => run.upgradeWaitP90)),
  bossTtkP50Median: median(runs.map((run) => run.bossTtkP50)),
  bossTtkP90Median: median(runs.map((run) => run.bossTtkP90)),
  originalWorldsAvailable: worlds.length,
  balanceOverlay: overlay.id || "missing",
  pacingTargets: {
    firstUpgrade: pacingTargets.firstUpgrade || [],
    earlyMedian: pacingTargets.earlyMedian || [],
    midMedian: pacingTargets.midMedian || [],
    lateMedian: pacingTargets.lateMedian || [],
  },
  pacing: {
    meaningfulWaitFloor,
    earlyPurchaseCount,
    midPurchaseCount,
    firstUpgradeWaitMedian: median(runs.map((run) => run.economy.pacing.firstUpgradeWait)),
    meaningfulWaitP50Median: median(runs.map((run) => run.economy.pacing.meaningfulWaitP50)),
    meaningfulWaitP90Median: median(runs.map((run) => run.economy.pacing.meaningfulWaitP90)),
    earlyPurchaseWaitP50Median: median(runs.map((run) => run.economy.pacing.earlyPurchaseWaitP50)),
    earlyPurchaseWaitP90Median: median(runs.map((run) => run.economy.pacing.earlyPurchaseWaitP90)),
    midPurchaseWaitP50Median: median(runs.map((run) => run.economy.pacing.midPurchaseWaitP50)),
    midPurchaseWaitP90Median: median(runs.map((run) => run.economy.pacing.midPurchaseWaitP90)),
    latePurchaseWaitP50Median: median(runs.map((run) => run.economy.pacing.latePurchaseWaitP50)),
    latePurchaseWaitP90Median: median(runs.map((run) => run.economy.pacing.latePurchaseWaitP90)),
  },
  roiRotation: {
    windowSizePurchases,
    maxBestChoiceShareTarget: maxBestChoiceShare,
    bestChoiceAvgWindowMaxShareMedian: median(runs.map((run) => run.economy.roiRotation.bestChoiceAvgWindowMaxShare)),
    bestChoiceP90WindowMaxShareMedian: median(runs.map((run) => run.economy.roiRotation.bestChoiceP90WindowMaxShare)),
    purchaseAvgWindowMaxShareMedian: median(runs.map((run) => run.economy.roiRotation.purchaseAvgWindowMaxShare)),
    purchaseP90WindowMaxShareMedian: median(runs.map((run) => run.economy.roiRotation.purchaseP90WindowMaxShare)),
    windowsOverTargetMedian: median(runs.map((run) => run.economy.roiRotation.windowsOverTarget)),
    avgUniqueBestChoicesMedian: median(runs.map((run) => run.economy.roiRotation.avgUniqueBestChoices)),
    aggregateBestRoiShare,
  },
  upgradeDominanceShare: {
    median: median(runs.map((run) => run.economy.upgradeDominanceShare)),
    p90: percentile(runs.map((run) => run.economy.upgradeDominanceShare), 0.9),
    aggregatePurchaseShare,
    aggregateDominantFamily: dominantFamilyFromShare(aggregatePurchaseShare),
  },
  deadZones: {
    thresholdSeconds: deadZoneThreshold,
    totalCount: runs.reduce((sum, run) => sum + run.economy.deadZones.count, 0),
    runsWithDeadZones: runs.filter((run) => run.economy.deadZones.count > 0).length,
    medianPerRun: median(runs.map((run) => run.economy.deadZones.count)),
    p90PerRun: percentile(runs.map((run) => run.economy.deadZones.count), 0.9),
    maxWaitObservedMedian: median(runs.map((run) => run.economy.deadZones.maxWaitObserved)),
  },
};

fs.writeFileSync(path.join(outputDir, "simulation_summary.json"), JSON.stringify({ summary, runs }, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, "simulation_economy_metrics_report.md"), markdownReport(summary), "utf8");
console.log(JSON.stringify(summary, null, 2));
