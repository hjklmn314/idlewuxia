import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

const mainJs = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const originalEconomy = readJson("config/original_economy_constants.json");
const uiUnlocks = readJson("config/original_ui_unlocks.json");

const checks = [];
const findings = [];

function addCheck(group, name, condition, detail = "", evidence = {}) {
  const status = condition ? "pass" : "fail";
  checks.push({ group, name, status, detail, evidence });
  if (!condition) findings.push({ severity: "error", group, name, detail, evidence });
}

function addWarning(group, name, condition, detail = "", evidence = {}) {
  const status = condition ? "pass" : "warn";
  checks.push({ group, name, status, detail, evidence });
  if (!condition) findings.push({ severity: "warning", group, name, detail, evidence });
}

function contains(source, fragment) {
  return source.includes(fragment);
}

function functionBody(name) {
  const marker = `function ${name}`;
  const start = mainJs.indexOf(marker);
  if (start < 0) return "";
  const signatureEnd = mainJs.indexOf(") {", start);
  const open = signatureEnd >= 0 ? signatureEnd + 2 : mainJs.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let index = open; index < mainJs.length; index += 1) {
    const char = mainJs[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return mainJs.slice(start, index + 1);
    }
  }
  return "";
}

function numeric(value) {
  return Number.isFinite(value) ? value : null;
}

const formulas = originalEconomy.runtimeFormulas || {};
const dotCapacity = formulas.dotCapacity || {};
const dotSpawnBatch = formulas.dotSpawnBatch || {};
const turretFormula = formulas.turret || {};
const droneFormula = formulas.drone || {};
const vacuumFormula = formulas.vacuum || {};

addCheck("source", "original dot population line is recorded", originalEconomy.sourceEvidence?.dotPopulationLine === 7891, "Expected extracted APK line 7891.", originalEconomy.sourceEvidence);
addCheck("source", "original turret runtime line is recorded", originalEconomy.sourceEvidence?.turretRuntimeLine === 6527, "Expected extracted APK line 6527.", originalEconomy.sourceEvidence);
addCheck("source", "original drone runtime line is recorded", originalEconomy.sourceEvidence?.droneRuntimeLine === 8195, "Expected extracted APK line 8195.", originalEconomy.sourceEvidence);
addCheck("source", "original vacuum runtime line is recorded", originalEconomy.sourceEvidence?.vacuumRuntimeLine === 8236, "Expected extracted APK line 8236.", originalEconomy.sourceEvidence);

addCheck("dot-spawn", "capacity formula matches original", dotCapacity.base === 10 && dotCapacity.perDotCountLevel === 5, "Original: Cs = 10 + DOT_COUNT * 5.", dotCapacity);
addCheck("dot-spawn", "spawn batch formula matches original", dotSpawnBatch.base === 1 && dotSpawnBatch.levelsPerBatch === 5, "Original: pr = 1 + floor(DOT_SPAWN_RATE / 5).", dotSpawnBatch);
addCheck("dot-spawn", "capacity reads config formula", contains(functionBody("originalDotCapacity"), 'originalRuntimeFormula("dotCapacity", "base", 10)') && contains(functionBody("originalDotCapacity"), 'originalRuntimeFormula("dotCapacity", "perDotCountLevel", 5)'), "originalDotCapacity must read runtimeFormulas.", { function: "originalDotCapacity" });
addCheck("dot-spawn", "spawn batch reads config formula", contains(functionBody("originalDotSpawnBatch"), 'originalRuntimeFormula("dotSpawnBatch", "base", 1)') && contains(functionBody("originalDotSpawnBatch"), 'originalRuntimeFormula("dotSpawnBatch", "levelsPerBatch", 5)'), "originalDotSpawnBatch must read runtimeFormulas.", { function: "originalDotSpawnBatch" });

const maintainBody = functionBody("maintainOriginalDotPopulation");
addCheck("dot-spawn", "population skips boss and demo", contains(maintainBody, "state.boss || state.demo.active"), "Reference gameplay does not regular-spawn dots during boss/demo layers.", { function: "maintainOriginalDotPopulation" });
addCheck("dot-spawn", "population uses entity cap", contains(maintainBody, "entityCap()") && contains(maintainBody, "state.dots.length < capacity"), "Spawner must respect the current cap.", { function: "maintainOriginalDotPopulation" });
addCheck("dot-spawn", "population uses spawn batch", contains(maintainBody, "originalDotSpawnBatch()"), "Spawner must use DOT_SPAWN_RATE batch formula.", { function: "maintainOriginalDotPopulation" });

const projectileBody = functionBody("spawnProjectile");
const updateProjectilesBody = functionBody("updateProjectiles");
addCheck("projectile", "projectile velocity is derived from angle", contains(projectileBody, "vx: Math.cos(angle) * speed") && contains(projectileBody, "vy: Math.sin(angle) * speed"), "Projectile movement must follow target angle.", { function: "spawnProjectile" });
addCheck("projectile", "projectile stores target and angle", contains(projectileBody, "target,") && contains(projectileBody, "angle,"), "Projectile state must keep target/angle for collision and rendering.", { function: "spawnProjectile" });
addCheck("projectile", "projectile angle updates from motion", contains(updateProjectilesBody, "p.angle = Math.atan2(p.y - p.prevY, p.x - p.prevX);"), "Bullet sprite rotation must follow current travel vector.", { function: "updateProjectiles" });
addCheck("projectile", "projectile collision uses combat targets", contains(functionBody("projectileHitTarget"), "combatTargets()"), "Hit resolution must check game combat targets.", { function: "projectileHitTarget" });

const shooterCountBody = functionBody("shooterCount");
const syncShootersBody = functionBody("syncShooters");
const updateTurretBody = functionBody("updateTurretShooters");
const drawOriginalTurretsBody = functionBody("drawOriginalTurrets");
const drawTurretBody = functionBody("drawTurret");
addCheck("turret", "turret maps to original SHOOTER_COUNT key", originalEconomy.upgradeKeyMap?.turret === "SHOOTER_COUNT" && turretFormula.slotKey === "SHOOTER_COUNT", "Turret card must add shooter units, not a decorative barrel.", { upgradeKey: originalEconomy.upgradeKeyMap?.turret, formula: turretFormula });
addCheck("turret", "shooter count grows by turret upgrade", contains(shooterCountBody, "1 + (state.upgrades.turret || 0)") && contains(shooterCountBody, "ORIGINAL_TURRET.maxCount"), "Upgrade must increase active shooter units.", { function: "shooterCount" });
addCheck("turret", "syncShooters creates multiple shooter units", contains(syncShootersBody, "while (state.shooters.length < count)") && contains(syncShootersBody, "state.shooters.length = count"), "Shooter array must track active turret units.", { function: "syncShooters" });
addCheck("turret", "each shooter targets and fires independently", contains(updateTurretBody, "for (const shooter of state.shooters)") && contains(updateTurretBody, "nearestTargetFrom(x, y)") && contains(updateTurretBody, "spawnProjectile(target"), "Each turret unit must fire from its own x/y.", { function: "updateTurretShooters" });
addCheck("turret", "draw layer renders shooter units", contains(drawOriginalTurretsBody, "for (const shooter of state.shooters)") && contains(drawOriginalTurretsBody, "drawOriginalTurretUnit(shooter"), "Turret visual must render separate units.", { function: "drawOriginalTurrets" });
addCheck("turret", "drawTurret delegates to original multi-unit renderer", contains(drawTurretBody, "drawOriginalTurrets(colors);") && !contains(drawTurretBody, "barrelCount"), "Current renderer should use original-style multi-unit draw path only.", { function: "drawTurret" });

const syncCollectorBody = functionBody("syncCollectorUnits");
const updateCollectorBody = functionBody("updateCollectorUnits");
const drawCollectorBody = functionBody("drawCollectorUnits");
addCheck("drone", "drone slots match original unlock state", uiUnlocks.drone?.slotSystemKey === "droneWing" && originalEconomy.slotUnlocks?.droneWing?.originalStateKey === "unlockedDroneSlots", "Drone unlocks must be slot-backed.", { ui: uiUnlocks.drone, economy: originalEconomy.slotUnlocks?.droneWing });
addCheck("drone", "drone formula values match original", droneFormula.speedBase === 60 && droneFormula.speedPerCollectorHull === 12 && droneFormula.accelerationBase === 200 && droneFormula.accelerationPerCollectorAgility === 40 && droneFormula.radiusBase === 6 && droneFormula.radiusPerCollectorSize === 0.5, "Original drone movement: radius 6+size*.5, speed 60+hull*12, accel 200+agility*40.", droneFormula);
addCheck("drone", "drone slot creates active units", contains(syncCollectorBody, "state.systems.droneWing") && contains(syncCollectorBody, "state.collectorUnits.push"), "Unlocked Drone slots must spawn combat units.", { function: "syncCollectorUnits" });
addCheck("drone", "drone movement reads config formulas", contains(updateCollectorBody, 'originalRuntimeFormula("drone", "speedBase", 60)') && contains(updateCollectorBody, 'originalRuntimeFormula("drone", "accelerationBase", 200)') && contains(updateCollectorBody, 'originalRuntimeFormula("drone", "radiusBase", 6)'), "Drone runtime constants must be config-driven.", { function: "updateCollectorUnits" });
addCheck("drone", "drone damages dots as drone source", contains(updateCollectorBody, 'damageTarget(dot, dot.hp + 1, { source: "drone"'), "Drone must kill/collect dots, not only show UI.", { function: "updateCollectorUnits" });
addCheck("drone", "drone draw function renders active units", contains(drawCollectorBody, "state.collectorUnits") && contains(drawCollectorBody, "unit.x") && contains(drawCollectorBody, "unit.y"), "Drone units must be visible in playfield.", { function: "drawCollectorUnits" });

const syncVacuumBody = functionBody("syncVacuumUnits");
const updateVacuumBody = functionBody("updateVacuumUnits");
const drawVacuumBody = functionBody("drawVacuumUnits");
addCheck("vacuum", "vacuum slots match original unlock state", uiUnlocks.vacuum?.slotSystemKey === "vacuumPull" && originalEconomy.slotUnlocks?.vacuumPull?.originalStateKey === "unlockedVacuumSlots", "Vacuum unlocks must be slot-backed.", { ui: uiUnlocks.vacuum, economy: originalEconomy.slotUnlocks?.vacuumPull });
addCheck("vacuum", "vacuum formula values match original", vacuumFormula.speedBase === 40 && vacuumFormula.speedPerVacuumSpeed === 10 && vacuumFormula.agilityBase === 150 && vacuumFormula.agilityPerVacuumAgility === 30 && vacuumFormula.rangeBase === 30 && vacuumFormula.rangePerVacuumSuction === 5 && vacuumFormula.suctionBase === 55 && vacuumFormula.suctionPerVacuumSuction === 3 && vacuumFormula.rowStep === 40, "Original vacuum movement/pull formulas must be preserved.", vacuumFormula);
addCheck("vacuum", "vacuum slot creates active units", contains(syncVacuumBody, "state.systems.vacuumPull") && contains(syncVacuumBody, "state.vacuumUnits.push"), "Unlocked Vacuum slots must spawn combat units.", { function: "syncVacuumUnits" });
addCheck("vacuum", "vacuum movement reads config formulas", contains(updateVacuumBody, 'originalRuntimeFormula("vacuum", "speedBase", 40)') && contains(updateVacuumBody, 'originalRuntimeFormula("vacuum", "rangeBase", 30)') && contains(updateVacuumBody, 'originalRuntimeFormula("vacuum", "suctionBase", 55)'), "Vacuum runtime constants must be config-driven.", { function: "updateVacuumUnits" });
addCheck("vacuum", "vacuum pulls and kills dots", contains(updateVacuumBody, "dot.vacuumShrink") && contains(updateVacuumBody, 'damageTarget(dot, dot.hp + 1, { source: "vacuum"'), "Vacuum must act in playfield, not only show UI.", { function: "updateVacuumUnits" });
addCheck("vacuum", "vacuum draw range reads runtime formula", contains(drawVacuumBody, 'originalRuntimeFormula("vacuum", "rangeBase", 30)') && contains(drawVacuumBody, 'originalRuntimeFormula("vacuum", "rangePerVacuumSuction", 5)'), "Visual range must match runtime range.", { function: "drawVacuumUnits" });

addWarning("hygiene", "legacy single-body turret code is removed", !contains(drawTurretBody, "const barrelCount = Math.min(4, shooterCount())"), "drawTurret should stay on the original-style multi-unit renderer and must not contain the old decorative barrel fallback.", { function: "drawTurret" });
addWarning("hygiene", "no old dot capacity hardcode remains", !contains(functionBody("originalDotCapacity"), "return 10 +") && !contains(functionBody("originalDotSpawnBatch"), "return 1 + Math.floor"), "Dot population formulas should remain config-driven.", { functions: ["originalDotCapacity", "originalDotSpawnBatch"] });
addWarning("hygiene", "no old vacuum visual hardcode remains", !contains(drawVacuumBody, "const range = 30 +"), "Vacuum visual range should remain config-driven.", { function: "drawVacuumUnits" });

const summary = checks.reduce(
  (acc, check) => {
    acc.total += 1;
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  },
  { total: 0, pass: 0, fail: 0, warn: 0 },
);

const report = {
  generatedAt: new Date().toISOString(),
  scope: "first-session combat mechanics parity",
  sourceFiles: [
    "src/main.js",
    "config/original_economy_constants.json",
    "config/original_ui_unlocks.json",
    "apk_contents/focused_game_monetization/game_web/index-DINbkGXA.linebreak.js",
  ],
  sourceEvidence: {
    dotPopulation: "index-DINbkGXA.linebreak.js:7891",
    turretRuntime: "index-DINbkGXA.linebreak.js:6527",
    droneRuntime: "index-DINbkGXA.linebreak.js:8195",
    vacuumRuntime: "index-DINbkGXA.linebreak.js:8236",
  },
  summary,
  checks,
  findings,
};

function markdown(reportData) {
  const byGroup = new Map();
  for (const check of reportData.checks) {
    if (!byGroup.has(check.group)) byGroup.set(check.group, []);
    byGroup.get(check.group).push(check);
  }
  const lines = [
    "# Combat Mechanics Parity Validation",
    "",
    `Generated: ${reportData.generatedAt}`,
    `Scope: ${reportData.scope}`,
    "",
    "## Summary",
    "",
    `Checks: ${reportData.summary.total}`,
    `Passed: ${reportData.summary.pass}`,
    `Warnings: ${reportData.summary.warn || 0}`,
    `Failed: ${reportData.summary.fail || 0}`,
    "",
    "## Source Evidence",
    "",
    "| Area | Source |",
    "| --- | --- |",
    ...Object.entries(reportData.sourceEvidence).map(([area, source]) => `| ${area} | ${source} |`),
    "",
  ];
  for (const [group, groupChecks] of byGroup) {
    lines.push(`## ${group}`, "", "| Status | Check | Detail |", "| --- | --- | --- |");
    for (const check of groupChecks) {
      lines.push(`| ${check.status.toUpperCase()} | ${check.name} | ${check.detail.replaceAll("|", "\\|")} |`);
    }
    lines.push("");
  }
  lines.push("## Findings", "", "| Severity | Group | Name | Detail |", "| --- | --- | --- | --- |");
  if (!reportData.findings.length) {
    lines.push("| info | clean | no blocking findings | |");
  } else {
    for (const finding of reportData.findings) {
      lines.push(`| ${finding.severity} | ${finding.group} | ${finding.name} | ${finding.detail.replaceAll("|", "\\|")} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

fs.writeFileSync(
  path.join(outputDir, "combat_mechanics_parity_report_20260702.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "combat_mechanics_parity_report_20260702.md"),
  markdown(report),
  "utf8",
);

console.log(JSON.stringify({
  checks: summary.total,
  passed: summary.pass,
  warnings: summary.warn || 0,
  failed: summary.fail || 0,
  findings: findings.length,
}, null, 2));

if (findings.some((finding) => finding.severity === "error")) {
  process.exit(1);
}
