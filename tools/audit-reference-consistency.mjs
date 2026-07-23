import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
const originalJsPath = path.resolve(root, "..", "apk_contents", "focused_game_monetization", "game_web", "index-DINbkGXA.linebreak.js");

fs.mkdirSync(outputDir, { recursive: true });

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function readJson(file) {
  const text = read(file);
  return text ? JSON.parse(text) : null;
}

function lines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function firstLine(text, pattern) {
  const sourceLines = lines(text);
  const matcher = pattern instanceof RegExp ? (line) => pattern.test(line) : (line) => line.includes(pattern);
  const index = sourceLines.findIndex(matcher);
  return index >= 0 ? index + 1 : null;
}

function matchingLines(text, pattern, limit = 12) {
  const sourceLines = lines(text);
  const matcher = pattern instanceof RegExp ? (line) => pattern.test(line) : (line) => line.includes(pattern);
  const hits = [];
  for (let i = 0; i < sourceLines.length; i += 1) {
    if (!matcher(sourceLines[i])) continue;
    hits.push({
      line: i + 1,
      preview: sourceLines[i].trim().slice(0, 180),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

function findCurrentLine(fileText, pattern) {
  return firstLine(fileText, pattern);
}

const files = {
  main: read(path.join(root, "src", "main.js")),
  index: read(path.join(root, "index.html")),
  styles: read(path.join(root, "src", "wuxia.css")),
  originalJs: read(originalJsPath),
  economy: readJson(path.join(root, "config", "original_economy_constants.json")),
  uiUnlocks: readJson(path.join(root, "config", "original_ui_unlocks.json")),
  monetization: readJson(path.join(root, "config", "monetization_backend_contract.json")),
  guardrails: readJson(path.join(root, "config", "ads_iap_guardrails.json")),
  uiProgression: readJson(path.join(root, "config", "ui_progression_catalog.json")),
  iapProductCatalog: readJson(path.join(root, "config", "iap_product_catalog.json")),
  originalWorlds: readJson(path.join(root, "config", "original_world_scaling.json")),
  originalBosses: readJson(path.join(root, "config", "original_boss_scaling.json")),
};

const findings = [];
const comparisons = [];
const referenceIssues = [];

function addFinding(item) {
  findings.push({
    severity: item.severity,
    id: item.id,
    area: item.area,
    status: item.status,
    current: item.current,
    reference: item.reference,
    source: item.source,
    requiredAction: item.requiredAction,
  });
}

function addComparison(item) {
  comparisons.push(item);
  if (item.pass === false) {
    addFinding({
      severity: item.severity || "P1",
      id: item.id,
      area: item.area,
      status: "mismatch",
      current: item.current,
      reference: item.reference,
      source: item.source,
      requiredAction: item.requiredAction,
    });
  }
}

function addReferenceIssue(item) {
  referenceIssues.push(item);
}

const originalEvidence = {
  baseCosts: matchingLines(files.originalJs, /\[b\.SHOOTER_COUNT\]:100/, 1),
  growthRates: matchingLines(files.originalJs, /\[b\.SHOOTER_COUNT\]:3\.5/, 1),
  costFormula: matchingLines(files.originalJs, /Math\.floor\(C\*Math\.pow\(G,J\)/, 2),
  galaxyTravel: matchingLines(files.originalJs, /ES=5e3|AS=15|Math\.floor\(ES\*Math\.pow\(AS,K\)/, 4),
  turretMode: matchingLines(files.originalJs, /turret_acquisition_mode|Pg="A"|Gk=\{1:5e3/, 6),
  droneSlots: matchingLines(files.originalJs, /\[1,3,5,8,20,30\]|unlockedDroneSlots|fo=6/, 8),
  vacuumSlots: matchingLines(files.originalJs, /\[2,4,6,8\]|unlockedVacuumSlots|mo=4/, 8),
  appLovin: matchingLines(files.originalJs, /AppLovin|MAX|rewarded|interstitial/i, 12),
  iap: matchingLines(files.originalJs, /InAppPurchase|PRODUCT|purchase|bundle/i, 12),
  consoleSuppression: matchingLines(files.originalJs, /console\.info=\(\)=>\{\}/, 2),
};

const expectedEconomy = {
  SHOOTER_COUNT: [100, 3.5],
  FREQUENCY: [1, 1.5],
  DAMAGE: [75, 1.45],
  DOT_COUNT: [40, 1.6],
  DOT_VALUE: [200, 2.2],
  DOT_SPAWN_RATE: [40, 1.5],
  LUCK: [500, 2],
  COLLECTOR_HULL: [100, 2],
  COLLECTOR_AGILITY: [60, 1.6],
  COLLECTOR_SIZE: [150, 2.5],
  VACUUM_SPEED: [120, 2],
  VACUUM_SUCTION: [200, 2.2],
  VACUUM_AGILITY: [80, 1.6],
  RAILGUN_COUNT: [50000000, 4],
  FLAME_COUNT: [500000000, 3],
  CRYO_COUNT: [5000000000, 3.5],
  PLASMA_COUNT: [100000000000, 4.5],
};

for (const [key, [base, growth]] of Object.entries(expectedEconomy)) {
  addComparison({
    id: `economy.${key}`,
    area: "config/economy",
    severity: "P0",
    pass: files.economy?.baseCosts?.[key] === base && files.economy?.growthRates?.[key] === growth,
    current: {
      base: files.economy?.baseCosts?.[key],
      growth: files.economy?.growthRates?.[key],
    },
    reference: { base, growth },
    source: "apk line anchors 4766-4767",
    requiredAction: "Keep original base/growth values in original_economy_constants.json.",
  });
}

addComparison({
  id: "economy.cost_formula_runtime",
  area: "runtime/economy",
  severity: "P0",
  pass:
    files.main.includes("function originalEconomyCost") &&
    files.main.includes("Math.floor(base * Math.pow(growth, level) * originalWorldCostMultiplier())") &&
    !files.main.includes("state.worldIndex * 0.3") &&
    !files.main.includes("state.worldIndex * 0.26") &&
    !files.main.includes("state.worldIndex * 0.22"),
  current: {
    hasOriginalFormula: files.main.includes("function originalEconomyCost"),
    hardcodedWorldSlopes: matchingLines(files.main, /state\.worldIndex \* 0\.(3|26|22)/, 8),
  },
  reference: "floor(base * growth^level * world.upgradeCostMultiplier)",
  source: "apk line anchors 16585-16588",
  requiredAction: "All current upgrade costs must go through original economy config and world config multiplier.",
});

addComparison({
  id: "economy.galaxy_travel",
  area: "config/economy",
  severity: "P0",
  pass:
    files.economy?.galaxyTravel?.baseCost === 5000 &&
    files.economy?.galaxyTravel?.growth === 15 &&
    files.economy?.galaxyTravel?.instantMultiplier === 2.5,
  current: files.economy?.galaxyTravel || null,
  reference: { baseCost: 5000, growth: 15, instantMultiplier: 2.5 },
  source: "apk line anchors 4768, 16592-16593",
  requiredAction: "Keep Galaxy travel costs config-driven from original constants.",
});

addComparison({
  id: "unlock.drone_slots",
  area: "config/unlock",
  severity: "P0",
  pass:
    JSON.stringify(files.uiUnlocks?.drone?.slotRequirementsGalaxy) === JSON.stringify([1, 3, 5, 8, 20, 30]) &&
    files.uiUnlocks?.drone?.maxSlots === 6 &&
    JSON.stringify(files.economy?.slotUnlocks?.droneWing?.requirementsGalaxy) === JSON.stringify([1, 3, 5, 8, 20, 30]),
  current: {
    ui: files.uiUnlocks?.drone,
    economy: files.economy?.slotUnlocks?.droneWing,
  },
  reference: { requirementsGalaxy: [1, 3, 5, 8, 20, 30], maxSlots: 6 },
  source: "apk drone slot evidence",
  requiredAction: "Drone slot UI and runtime counts must use the same original slot config.",
});

addComparison({
  id: "unlock.vacuum_slots",
  area: "config/unlock",
  severity: "P0",
  pass:
    JSON.stringify(files.uiUnlocks?.vacuum?.slotRequirementsGalaxy) === JSON.stringify([2, 4, 6, 8]) &&
    files.uiUnlocks?.vacuum?.maxSlots === 4 &&
    JSON.stringify(files.economy?.slotUnlocks?.vacuumPull?.requirementsGalaxy) === JSON.stringify([2, 4, 6, 8]),
  current: {
    ui: files.uiUnlocks?.vacuum,
    economy: files.economy?.slotUnlocks?.vacuumPull,
  },
  reference: { requirementsGalaxy: [2, 4, 6, 8], maxSlots: 4 },
  source: "apk vacuum slot evidence",
  requiredAction: "Vacuum slot UI and runtime counts must use the same original slot config.",
});

const weaponOriginalKeyGaps = [];
for (const weapon of files.uiUnlocks?.defenseWeapons || []) {
  for (const part of weapon.parts || []) {
    if (!part.originalKey || files.economy?.baseCosts?.[part.originalKey] === undefined || files.economy?.growthRates?.[part.originalKey] === undefined) {
      weaponOriginalKeyGaps.push({ weapon: weapon.id, part: part.id, originalKey: part.originalKey || null });
    }
  }
}
addComparison({
  id: "defense.weapon_cost_keys",
  area: "config/defense",
  severity: "P0",
  pass: weaponOriginalKeyGaps.length === 0,
  current: { gaps: weaponOriginalKeyGaps },
  reference: "Every original defense card part must map to a base/growth key when such key exists in the APK.",
  source: "apk line anchors 4766-4767",
  requiredAction: "Remove prototype costScale/growth fallback from configured original weapon parts.",
});

const hardcodedScans = [
  {
    id: "hardcode.weapon_tuning",
    severity: "P1",
    area: "runtime/combat",
    pattern: "const WEAPON_TUNING",
    sourceFile: "src/main.js",
    requiredAction: "Move weapon cooldown/damage factors to a reference-derived config table, or mark each field as intentional overlay.",
  },
  {
    id: "hardcode.kills_for_boss",
    severity: "P0",
    area: "runtime/progression",
    pattern: "return 26 + state.worldIndex * 5",
    sourceFile: "src/main.js",
    requiredAction: "Replace boss gate kills with original config/formula evidence, then validate against original first-session captures.",
  },
  {
    id: "hardcode.legacy_spawn_wave_quantity",
    severity: "P1",
    area: "runtime/spawn",
    pattern: "0.55 + state.worldIndex * 0.02 + state.systems.spawn * 0.015",
    sourceFile: "src/main.js",
    requiredAction: "Either delete the unused legacy wave path or map it to original DOT_COUNT/DOT_SPAWN_RATE spawn logic only.",
  },
  {
    id: "hardcode.boss_reward_preview",
    severity: "P1",
    area: "runtime/economy",
    pattern: "worldValueScale() * 160 * (state.worldIndex + 1)",
    sourceFile: "src/main.js",
    requiredAction: "Replace prototype reward preview with original Galaxy reward calculation or config evidence.",
  },
  {
    id: "hardcode.theme_colors",
    severity: "P2",
    area: "runtime/visual",
    pattern: "function themeColors()",
    sourceFile: "src/main.js",
    requiredAction: "Keep final visual palette in skin/theme config, not in runtime branches, unless it is a generated overlay.",
  },
  {
    id: "hardcode.boss_debug_hook",
    severity: "P1",
    area: "ui/progression",
    pattern: "ui.bossBtn.addEventListener(\"click\", () => startBoss())",
    sourceFile: "src/main.js",
    requiredAction: "Confirm boss debug button is removed from normal shell; original Galaxy tab should not expose Enter Boss.",
  },
];

for (const scan of hardcodedScans) {
  const sourceText = scan.sourceFile === "src/main.js" ? files.main : files.index;
  const line = findCurrentLine(sourceText, scan.pattern);
  if (!line) continue;
  addFinding({
    severity: scan.severity,
    id: scan.id,
    area: scan.area,
    status: "hardcoded_or_unverified",
    current: { file: scan.sourceFile, line, pattern: scan.pattern },
    reference: "Reference APK code/config should be the source of truth.",
    source: scan.sourceFile,
    requiredAction: scan.requiredAction,
  });
}

const slotUnlockRuntimeLine = findCurrentLine(files.main, "if (originalEconomy().slotUnlocks?.[kind]) return 0;");
const hasRewardedSystemResolver =
  files.main.includes("function originalRewardedPlacementForSystem") &&
  files.main.includes("await resolveRewardedPlacement(rewardedPlacement") &&
  files.main.includes("grantSystemUpgrade(kind, 0)");
if (slotUnlockRuntimeLine && !hasRewardedSystemResolver) {
  addFinding({
    severity: "P0",
    id: "monetization.slot_unlock_reward_resolution",
    area: "iaa/rewarded",
    status: "incomplete_runtime_chain",
    current: {
      file: "src/main.js",
      line: slotUnlockRuntimeLine,
      detail: "Slot unlock cost is zero and UI label is AD, but buySystem still resolves locally instead of a rewarded-ad callback.",
    },
    reference: "Original slot unlocks are rewarded placement flows; target contract requires AdMob SSV before reward resolution.",
    source: "original_economy_constants.json slotUnlocks + monetization_backend_contract.json",
    requiredAction: "Route drone/vacuum slot unlock through reward placement resolver before incrementing slots.",
  });
}

const hasGalaxyRewardedResolver =
  files.main.includes("const placementId = originalEconomy().galaxyTravel?.adPlacement || \"galaxy_travel\"") &&
  files.main.includes("await resolveRewardedPlacement(placementId") &&
  files.main.includes("action: \"galaxy_travel\"");
if (!hasGalaxyRewardedResolver) {
  addFinding({
    severity: "P0",
    id: "monetization.galaxy_travel_reward_resolution",
    area: "iaa/rewarded",
    status: "incomplete_runtime_chain",
    current: "Galaxy WATCH AD path does not pass through rewarded placement resolver.",
    reference: "Original galaxy travel ad path waits for rewarded completion before consuming cash and traveling.",
    source: "src/main.js + original_economy_constants.json",
    requiredAction: "Route galaxy travel ad flow through resolveRewardedPlacement before state mutation.",
  });
}

const mappedIapProducts = files.iapProductCatalog?.products || [];
if (mappedIapProducts.length < 24) {
  addFinding({
    severity: "P1",
    id: "iap.store_catalog_coverage",
    area: "iap/store",
    status: "coverage_gap",
    current: {
      products: mappedIapProducts.length,
      ids: mappedIapProducts.map((item) => item.id),
    },
    reference: "Original APK contains a broader IAP catalogue; target product also requires Google/Apple backend products.",
    source: "iap_product_catalog.json + original IAP code evidence",
    requiredAction: "Build a full product SKU map from original product code and new Google/Apple backend IDs; keep MOD products excluded.",
  });
}

addReferenceIssue({
  severity: "P0",
  id: "reference.iaa_provider_mismatch",
  area: "iaa/backend",
  evidence: originalEvidence.appLovin,
  issue: "Reference APK product chain is AppLovin MAX style client rewarded/interstitial logic, while this product target is AdMob with server-side reward verification.",
  decision: "Do not copy provider SDK calls directly; copy placement semantics only, then bind to monetization_backend_contract.json.",
});

addReferenceIssue({
  severity: "P1",
  id: "reference.early_interstitial_pressure",
  area: "iaa/experience",
  evidence: matchingLines(files.originalJs, /interstitial_first_show_seconds|interstitial_interval_seconds|interstitial_cooldown_seconds|120|240|90/i, 12),
  issue: "Reference config appears to permit earlier forced interstitial timing than the current quality guardrail.",
  decision: "Keep current no-forced-interstitial guardrail at 300 seconds or higher unless product explicitly changes it.",
});

addReferenceIssue({
  severity: "P1",
  id: "reference.core_progression_ad_gates",
  area: "iaa/experience",
  evidence: originalEvidence.turretMode,
  issue: "Reference turret acquisition mode A and slot unlocks tie core power progression to rewarded placements.",
  decision: "Preserve exact unlock semantics during parity work, but evaluate a softer placement plan before production balance lock.",
});

addReferenceIssue({
  severity: "P2",
  id: "reference.console_observability",
  area: "code/diagnostics",
  evidence: originalEvidence.consoleSuppression,
  issue: "Reference code suppresses console.info, which makes runtime diagnosis weaker.",
  decision: "Do not carry this into prototype runtime; keep audit hooks and structured logs available in debug builds.",
});

const report = {
  generatedAt: new Date().toISOString(),
  root,
  originalJsPath,
  summary: {
    comparisons: comparisons.length,
    comparisonFailures: comparisons.filter((item) => item.pass === false).length,
    findings: findings.length,
    p0Findings: findings.filter((item) => item.severity === "P0").length,
    referenceIssues: referenceIssues.length,
  },
  originalEvidence,
  comparisons,
  findings,
  referenceIssues,
};

fs.writeFileSync(path.join(outputDir, "reference_consistency_deep_audit_20260701.json"), JSON.stringify(report, null, 2), "utf8");

const findingLines = findings.length
  ? findings.map((item) => `- [${item.severity}] ${item.id}: ${item.requiredAction}`)
  : ["- No current mismatches detected by this audit pass."];

const referenceIssueLines = referenceIssues.length
  ? referenceIssues.map((item) => `- [${item.severity}] ${item.id}: ${item.issue} Decision: ${item.decision}`)
  : ["- No reference-side issues recorded."];

const md = [
  "# Reference Consistency Deep Audit",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Config/code comparisons: ${report.summary.comparisons}`,
  `- Failed comparisons: ${report.summary.comparisonFailures}`,
  `- Current findings: ${report.summary.findings}`,
  `- P0 current findings: ${report.summary.p0Findings}`,
  `- Reference-side issues: ${report.summary.referenceIssues}`,
  "",
  "## Current Project Findings",
  "",
  ...findingLines,
  "",
  "## Reference Project Issues Not To Copy Blindly",
  "",
  ...referenceIssueLines,
  "",
  "## Evidence Anchors",
  "",
  `- Base costs lines: ${originalEvidence.baseCosts.map((hit) => hit.line).join(", ") || "not found"}`,
  `- Growth rates lines: ${originalEvidence.growthRates.map((hit) => hit.line).join(", ") || "not found"}`,
  `- Cost formula lines: ${originalEvidence.costFormula.map((hit) => hit.line).join(", ") || "not found"}`,
  `- Galaxy travel lines: ${originalEvidence.galaxyTravel.map((hit) => hit.line).join(", ") || "not found"}`,
  `- Turret ad mode lines: ${originalEvidence.turretMode.map((hit) => hit.line).join(", ") || "not found"}`,
  `- Drone slot lines: ${originalEvidence.droneSlots.map((hit) => hit.line).join(", ") || "not found"}`,
  `- Vacuum slot lines: ${originalEvidence.vacuumSlots.map((hit) => hit.line).join(", ") || "not found"}`,
].join("\n");

fs.writeFileSync(path.join(outputDir, "reference_consistency_deep_audit_20260701.md"), md, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
