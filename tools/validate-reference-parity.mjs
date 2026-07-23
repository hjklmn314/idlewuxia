import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
const mainPath = path.join(root, "src", "main.js");
const indexPath = path.join(root, "index.html");
const stylesPath = path.join(root, "src", "wuxia.css");
const unlocksPath = path.join(root, "config", "original_ui_unlocks.json");
const economyPath = path.join(root, "config", "original_economy_constants.json");

fs.mkdirSync(outputDir, { recursive: true });

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const files = {
  main: read(mainPath),
  index: read(indexPath),
  styles: read(stylesPath),
  unlocks: JSON.parse(read(unlocksPath)),
  economy: JSON.parse(read(economyPath)),
};

const checks = [];

function addCheck(id, severity, source, evidence, pass, detail) {
  checks.push({
    id,
    severity,
    source,
    evidence,
    pass: Boolean(pass),
    detail,
  });
}

function hasAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function absentEverywhere(terms, texts) {
  return terms.every((term) => texts.every((text) => !text.includes(term)));
}

addCheck(
  "combat.turret.original_constants",
  "P0",
  "apk line anchors 6512, 6850",
  "Original turret maxCount=5, intervalBase=2.8, intervalDecay=.85, damageBase=5, damageScale=8.",
  hasAll(files.main, [
    "const ORIGINAL_TURRET",
    "maxCount: 5",
    "intervalBase: 2.8",
    "intervalDecay: 0.85",
    "damageBase: 5",
    "damageScale: 8",
    "damageLinearScale: 0.05",
  ]),
  "Turret constants must be traceable to the APK formula instead of prototype tuning."
);

addCheck(
  "combat.turret.independent_shooters",
  "P0",
  "apk line anchors 6527-6603",
  "Original SHOOTER_COUNT owns separate shooter entries with xRatio and lastShotTime.",
  hasAll(files.main, ["function syncShooters()", "function shooterXRatios(count)", "function updateTurretShooters()", "xRatio", "lastShotTime"]) &&
    files.main.includes("drawOriginalTurrets(colors);") &&
    !files.main.includes("const barrelCount = Math.min(4, shooterCount())"),
  "TURRET must render/fire as independent shooters, not extra barrels on one body."
);

addCheck(
  "combat.projectile.target_rotation",
  "P0",
  "apk line anchors 6527-6603, 9270",
  "Original projectile angle is atan2(target - shooter) and rendered with rotated barrel/projectile direction.",
  hasAll(files.main, ["vx: Math.cos(angle) * speed", "vy: Math.sin(angle) * speed", "p.angle = Math.atan2", "ctx.rotate(angle + Math.PI / 2)"]),
  "Projectiles must move and draw in their actual target direction."
);

addCheck(
  "combat.spawn.original_capacity_and_batch",
  "P0",
  "apk line anchor 7890",
  "Original dot capacity is 10 + DOT_COUNT * 5 and spawn batch is 1 + floor(DOT_SPAWN_RATE / 5).",
  hasAll(files.main, [
    "function originalDotCapacity()",
    "originalRuntimeFormula(\"dotCapacity\", \"base\", 10)",
    "originalRuntimeFormula(\"dotCapacity\", \"perDotCountLevel\", 5)",
    "function originalDotSpawnBatch()",
    "originalRuntimeFormula(\"dotSpawnBatch\", \"base\", 1)",
    "originalRuntimeFormula(\"dotSpawnBatch\", \"levelsPerBatch\", 5)",
    "maintainOriginalDotPopulation()",
  ]) &&
    files.economy.runtimeFormulas?.dotCapacity?.base === 10 &&
    files.economy.runtimeFormulas?.dotCapacity?.perDotCountLevel === 5 &&
    files.economy.runtimeFormulas?.dotSpawnBatch?.base === 1 &&
    files.economy.runtimeFormulas?.dotSpawnBatch?.levelsPerBatch === 5,
  "Normal play should maintain original dot population rhythm instead of custom wave bursts."
);

addCheck(
  "combat.drone.runtime_entity",
  "P0",
  "apk line anchors 8195-8223",
  "Original Drone/Collector creates collector_* units, chases dots, collects on collision, increments drone source.",
  hasAll(files.main, [
    "collectorUnits",
    "function syncCollectorUnits()",
    "function updateCollectorUnits(dt)",
    "function drawCollectorUnits(colors)",
    "originalRuntimeFormula(\"drone\", \"speedBase\", 60)",
    "originalRuntimeFormula(\"drone\", \"accelerationBase\", 200)",
    "originalRuntimeFormula(\"drone\", \"radiusBase\", 6)",
    "source: \"drone\"",
  ]) &&
    files.economy.runtimeFormulas?.drone?.speedBase === 60 &&
    files.economy.runtimeFormulas?.drone?.speedPerCollectorHull === 12 &&
    files.economy.runtimeFormulas?.drone?.accelerationBase === 200 &&
    files.economy.runtimeFormulas?.drone?.accelerationPerCollectorAgility === 40,
  "Drone unlock must create visible combat units in the play field."
);

addCheck(
  "combat.vacuum.runtime_entity",
  "P0",
  "apk line anchors 8236-8291, 9076",
  "Original Vacuum creates vacuum_* units, sweeps rows, pulls dots, shrinks and kills close dots.",
  hasAll(files.main, [
    "vacuumUnits",
    "function syncVacuumUnits()",
    "function updateVacuumUnits(dt)",
    "function drawVacuumUnits(colors)",
    "originalRuntimeFormula(\"vacuum\", \"speedBase\", 40)",
    "originalRuntimeFormula(\"vacuum\", \"rangeBase\", 30)",
    "originalRuntimeFormula(\"vacuum\", \"suctionBase\", 55)",
    "dot.vacuumShrink",
    "source: \"vacuum\"",
  ]) &&
    files.economy.runtimeFormulas?.vacuum?.speedBase === 40 &&
    files.economy.runtimeFormulas?.vacuum?.speedPerVacuumSpeed === 10 &&
    files.economy.runtimeFormulas?.vacuum?.rangeBase === 30 &&
    files.economy.runtimeFormulas?.vacuum?.rangePerVacuumSuction === 5 &&
    files.economy.runtimeFormulas?.vacuum?.suctionBase === 55 &&
    files.economy.runtimeFormulas?.vacuum?.suctionPerVacuumSuction === 3,
  "Vacuum unlock must create visible sweeping suction units in the play field."
);

addCheck(
  "ui.galaxy.no_enter_boss",
  "P0",
  "apk galaxy travel evidence lines 4623-4640",
  "Original Galaxy tab is a Next Galaxy travel panel, not a visible Enter Boss button.",
  absentEverywhere(["ENTER BOSS", "Enter Boss"], [files.main, files.index]) &&
    hasAll(files.main, ["travelGalaxy(\"ad\")", "travelGalaxy(\"instant\")"]) &&
    hasAll(files.index, ["galaxyInstantBtn", "WATCH AD", "INSTANT"]),
  "Visible Galaxy UI must not expose prototype Enter Boss wording or route."
);

addCheck(
  "ui.unlock_slots.no_minus_one_primary_slots",
  "P0",
  "config original_ui_unlocks.json plus QA parity setup",
  "droneWing/vacuumPull are configured as slotSystemKey values and represent owned slot counts.",
  !files.main.includes("droneWing: Math.max(0, droneReadySlots - 1)") &&
    !files.main.includes("vacuumPull: Math.max(0, vacuumReadySlots - 1)") &&
    files.main.includes("droneWing: droneReadySlots") &&
    files.main.includes("vacuumPull: vacuumReadySlots"),
  "QA parity setup must not show Slot 1 ON while spawning zero helper units."
);

addCheck(
  "config.original_slot_mapping",
  "P1",
  "config original_ui_unlocks.json",
  "Original slot requirements: Drone [1,3,5,8,20,30], Vacuum [2,4,6,8].",
  JSON.stringify(files.unlocks.drone?.slotRequirementsGalaxy) === JSON.stringify([1, 3, 5, 8, 20, 30]) &&
    JSON.stringify(files.unlocks.vacuum?.slotRequirementsGalaxy) === JSON.stringify([2, 4, 6, 8]) &&
    files.unlocks.drone?.originalUpgradeMapping?.droneFocus === "COLLECTOR_HULL" &&
    files.unlocks.vacuum?.originalUpgradeMapping?.vacuumSurge === "VACUUM_SUCTION",
  "Unlock config must keep the original slot and upgrade-key mapping."
);

addCheck(
  "config.original_economy_formula",
  "P0",
  "apk line anchors 4766-4768, 16585-16588",
  "Original costs use baseCosts[key] * growth[key]^level * world.upgradeCostMultiplier; galaxy travel uses 5000 * 15^world and instant multiplier 2.5.",
  files.economy.baseCosts?.SHOOTER_COUNT === 100 &&
    files.economy.growthRates?.SHOOTER_COUNT === 3.5 &&
    files.economy.baseCosts?.FREQUENCY === 1 &&
    files.economy.growthRates?.DAMAGE === 1.45 &&
    files.economy.upgradeKeyMap?.turret === "SHOOTER_COUNT" &&
    files.economy.upgradeKeyMap?.rate === "FREQUENCY" &&
    files.economy.upgradeKeyMap?.damage === "DAMAGE" &&
    files.economy.galaxyTravel?.baseCost === 5000 &&
    files.economy.galaxyTravel?.growth === 15 &&
    files.economy.galaxyTravel?.instantMultiplier === 2.5,
  "Prototype economy config must preserve original base/growth/travel constants instead of local linear tuning."
);

addCheck(
  "code.no_linear_world_cost_hardcoding",
  "P0",
  "apk line anchor 16588",
  "Original world cost multiplier comes from world config Cs.upgradeCostMultiplier.",
  absentEverywhere(["state.worldIndex * 0.3", "state.worldIndex * 0.26", "state.worldIndex * 0.22"], [files.main]) &&
    hasAll(files.main, ["function originalWorldCostMultiplier()", "upgradeCostMultiplier", "originalEconomyCost"]),
  "Runtime costs must read original world multiplier config, not hardcoded worldIndex slopes."
);

addCheck(
  "config.weapon_original_keys_complete",
  "P0",
  "apk line anchors 4766-4767",
  "Every defense weapon count/damage/range/cooldown part has original base/growth keys.",
  (files.unlocks.defenseWeapons || []).every((weapon) =>
    (weapon.parts || []).every(
      (part) => part.originalKey && files.economy.baseCosts?.[part.originalKey] !== undefined && files.economy.growthRates?.[part.originalKey] !== undefined
    )
  ),
  "Late-game weapon cards must not fall back to prototype costScale/growth values when original keys exist."
);

const failures = checks.filter((check) => !check.pass);
const report = {
  generatedAt: new Date().toISOString(),
  root,
  summary: {
    total: checks.length,
    passed: checks.length - failures.length,
    failed: failures.length,
    p0Failed: failures.filter((check) => check.severity === "P0").length,
  },
  checks,
};

fs.writeFileSync(path.join(outputDir, "reference_parity_validation_report.json"), JSON.stringify(report, null, 2), "utf8");

const md = [
  "# Reference Parity Validation",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `- Checks: ${report.summary.total}`,
  `- Passed: ${report.summary.passed}`,
  `- Failed: ${report.summary.failed}`,
  `- P0 failed: ${report.summary.p0Failed}`,
  "",
  "## Findings",
  "",
  ...checks.map((check) => {
    const mark = check.pass ? "PASS" : "FAIL";
    return `- ${mark} [${check.severity}] ${check.id}: ${check.detail}`;
  }),
  "",
  "## Evidence Scope",
  "",
  "- Original APK product body only: WebView React/Vite Canvas game code and product monetization chain.",
  "- Repacked MOD shell content remains out of scope.",
  "- This validator is intentionally narrow: it gates the P0 issues found in the latest code/reference audit.",
].join("\n");

fs.writeFileSync(path.join(outputDir, "reference_parity_validation_summary.md"), md, "utf8");

console.log(JSON.stringify(report.summary, null, 2));
if (failures.length > 0) process.exit(1);
