import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const presentation = JSON.parse(fs.readFileSync(path.join(root, "config", "presentation_runtime_tuning.json"), "utf8"));
const mainJs = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");

const checks = [];
const findings = [];

function addCheck(group, name, condition, detail = "", evidence = {}) {
  const status = condition ? "pass" : "fail";
  checks.push({ group, name, status, detail, evidence });
  if (!condition) findings.push({ severity: "error", group, name, detail, evidence });
}

function functionBody(name) {
  const marker = `function ${name}`;
  const start = mainJs.indexOf(marker);
  if (start < 0) return "";
  const open = mainJs.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let index = open; index < mainJs.length; index += 1) {
    if (mainJs[index] === "{") depth += 1;
    if (mainJs[index] === "}") {
      depth -= 1;
      if (depth === 0) return mainJs.slice(start, index + 1);
    }
  }
  return "";
}

function hasNumber(object, key) {
  return Number.isFinite(Number(object?.[key]));
}

function hasAllNumbers(object, keys) {
  return keys.every((key) => hasNumber(object, key));
}

function hasString(object, key) {
  return typeof object?.[key] === "string" && object[key].trim().length > 0;
}

function hasAll(source, fragments) {
  return fragments.every((fragment) => source.includes(fragment));
}

function hasNone(source, fragments) {
  return fragments.every((fragment) => !source.includes(fragment));
}

const visuals = presentation.visuals || {};
const dot = visuals.dot || {};
const boss = visuals.boss || {};
const projectile = visuals.projectile || {};
const helper = visuals.helper || {};
const turret = visuals.turret || {};
const themePresets = visuals.themePresets || {};
const drawDots = functionBody("drawDots");
const drawBoss = functionBody("drawBoss");
const drawDotDurability = functionBody("drawDotDurability");
const drawProjectiles = functionBody("drawProjectiles");
const drawCollectorUnits = functionBody("drawCollectorUnits");
const drawVacuumUnits = functionBody("drawVacuumUnits");
const drawOriginalTurretUnit = functionBody("drawOriginalTurretUnit");
const themePresentation = functionBody("themePresentation");

const requiredDotKeys = [
  "spawnScaleBase",
  "spawnScaleRange",
  "spawnScaleMs",
  "chargerPulseMs",
  "chargerPulseScale",
  "vacuumShrinkMax",
  "hitRadiusScale",
  "impactScaleX",
  "impactScaleY",
  "shadowCleanAlpha",
  "shadowDefaultAlpha",
  "glowRadiusScale",
  "glowBaseAlpha",
  "glowHitAlpha",
  "chargerGlowBlur",
  "blackHoleGlowBlur",
  "defaultGlowBlur",
  "chargerBodyBlur",
  "defaultBodyBlur",
  "rimRadiusScale",
  "rimHitScale",
  "innerStrokeScale",
  "specularAlpha",
  "durabilityWidthMin",
  "durabilityWidthScale",
];

const requiredBossKeys = [
  "shadowAlpha",
  "shadowFillAlpha",
  "phasePulseRingAlpha",
  "phasePulseShadowBlur",
  "phasePulseWidth",
  "phasePulseRadiusBase",
  "phasePulseRadiusRange",
  "auraMinAlpha",
  "auraMaxAlpha",
  "auraHitAlpha",
  "auraRadiusScale",
  "auraPulseMs",
  "bodyChargeShadowBlur",
  "bodyDefaultShadowBlur",
  "bodyOuterStrokeAlpha",
  "bodyOuterStrokeScale",
  "bodyCoreBaseScale",
  "bodyCoreDamagedScale",
  "hpRingScale",
  "shieldRingScale",
  "shieldRingAlpha",
  "shieldRingPulseAlpha",
  "chargeSeconds",
  "chargeRingScale",
  "chargeRingAlpha",
  "chargeRingPulseAlpha",
  "collapseShardCount",
];

const requiredProjectileKeys = [
  "sparkAlpha",
  "trailShadowBlur",
  "spaceTrailWidth",
  "defaultTrailWidth",
  "spaceLengthBase",
  "spaceLengthRadiusScale",
  "spaceWidthMin",
  "spaceWidthRadiusScale",
  "spaceHeadAlpha",
  "sparkLineMin",
  "sparkLineWidthScale",
  "coreMinX",
  "coreRadiusScaleX",
  "coreMinY",
  "coreRadiusScaleY",
  "sparkTipOffsetScale",
  "sparkTipMinX",
  "sparkTipRadiusScaleX",
  "sparkTipMinY",
  "sparkTipRadiusScaleY",
];

const requiredHelperKeys = [
  "thrusterAlpha",
  "rangeAlpha",
  "collectorTrailAlphaBase",
  "collectorTrailAlphaPulse",
  "collectorAuraAlphaBase",
  "collectorAuraAlphaPulse",
  "collectorAuraRadiusScale",
  "collectorShadowBlur",
  "collectorBodyStrokeWidth",
  "collectorAccentStrokeWidth",
  "collectorNoseAlpha",
  "vacuumRangeStrokeAlpha",
  "vacuumRangeStrokeWidth",
  "vacuumIntakeAlphaScale",
  "vacuumIntakeXScale",
  "vacuumIntakeOuterRadiusScale",
  "vacuumIntakeEllipseXScale",
  "vacuumIntakeEllipseRadiusX",
  "vacuumIntakeEllipseRadiusY",
  "vacuumBodyShadowBlur",
  "vacuumBodyStrokeWidth",
  "vacuumFanStrokeWidth",
  "vacuumFanArmCount",
  "vacuumFanArmLengthScale",
  "vacuumCoreRadiusScale",
];

const requiredTurretKeys = [
  "aimLineAlpha",
  "recoilGlowAlpha",
  "shotPulseMs",
  "recoilTranslate",
  "shadowAlpha",
  "shadowY",
  "shadowRadiusX",
  "shadowRadiusY",
  "baseGlowAlpha",
  "baseGlowPulseAlpha",
  "baseGlowY",
  "baseGlowRadius",
  "baseGlowPulseRadius",
  "aimLineWidth",
  "aimLineStart",
  "aimLineEnd",
  "barrelShadowBlur",
  "barrelPulseShadowBlur",
  "barrelStrokeWidth",
  "recoilEllipseAlphaScale",
  "recoilEllipseY",
  "recoilEllipsePulseY",
  "recoilEllipseRadiusX",
  "recoilEllipsePulseRadiusX",
  "recoilEllipseRadiusY",
  "recoilEllipsePulseRadiusY",
  "recoilMuzzleY",
  "recoilMuzzlePulseY",
  "recoilMuzzleRadius",
  "recoilMuzzlePulseRadius",
  "bodyShadowBlur",
  "bodyStrokeWidth",
  "plateArcAlpha",
  "plateArcPulseAlpha",
  "plateArcWidth",
  "plateArcRadius",
  "plateArcPulseRadius",
  "highlightAlpha",
  "highlightWidth",
];

const requiredThemePresetNumberKeys = [
  "enemyScale",
  "enemyAlpha",
  "enemyGlowScale",
  "projectileScale",
  "projectileAlpha",
  "turretScale",
  "helperScale",
];

const requiredThemePresetColorKeys = [
  "projectileColor",
  "hullColor",
  "plateColor",
  "muzzleColor",
  "rangeColor",
];

addCheck("config", "dot visual keys are config-driven", hasAllNumbers(dot, requiredDotKeys), "Dot presentation tuning should be adjustable without code edits.", {
  missing: requiredDotKeys.filter((key) => !hasNumber(dot, key)),
});
addCheck("config", "boss visual keys are config-driven", hasAllNumbers(boss, requiredBossKeys), "Boss presentation tuning should be adjustable without code edits.", {
  missing: requiredBossKeys.filter((key) => !hasNumber(boss, key)),
});
addCheck("config", "projectile visual keys are config-driven", hasAllNumbers(projectile, requiredProjectileKeys), "Projectile presentation tuning should be adjustable without code edits.", {
  missing: requiredProjectileKeys.filter((key) => !hasNumber(projectile, key)),
});
addCheck("config", "helper visual keys are config-driven", hasAllNumbers(helper, requiredHelperKeys), "Drone/Canon helper presentation tuning should be adjustable without code edits.", {
  missing: requiredHelperKeys.filter((key) => !hasNumber(helper, key)),
});
addCheck("config", "turret visual keys are config-driven", hasAllNumbers(turret, requiredTurretKeys), "Turret presentation tuning should be adjustable without code edits.", {
  missing: requiredTurretKeys.filter((key) => !hasNumber(turret, key)),
});
addCheck(
  "config",
  "theme preset visual keys are config-driven",
  ["clean", "paint", "cash", "spaceglass", "blackhole"].every(
    (key) =>
      hasAllNumbers(themePresets[key], requiredThemePresetNumberKeys) &&
      requiredThemePresetColorKeys.every((presetKey) => hasString(themePresets[key], presetKey)),
  ),
  "Theme-specific unit, projectile, and helper presentation should be adjustable without code edits.",
  Object.fromEntries(
    ["clean", "paint", "cash", "spaceglass", "blackhole"].map((key) => [
      key,
      [
        ...requiredThemePresetNumberKeys.filter((presetKey) => !hasNumber(themePresets[key], presetKey)),
        ...requiredThemePresetColorKeys.filter((presetKey) => !hasString(themePresets[key], presetKey)),
      ],
    ]),
  ),
);
addCheck(
  "runtime",
  "themePresentation reads theme preset config",
  hasAll(themePresentation, ['visualSection("themePresets")', "semanticThemeKey()", "enemyScale", "projectileScale", "helperScale"]),
  "Theme switching must retint and rescale live combat entities from presentation_runtime_tuning.json.",
);
addCheck("runtime", "drawDots reads dot visual section", hasAll(drawDots, ['visualSection("dot")', 'v("spawnScaleBase"', 'v("vacuumShrinkMax"', 'v("glowRadiusScale"', 'v("rimRadiusScale"']), "drawDots must read P1 visual parameters from presentation config.");
addCheck("runtime", "drawBoss reads boss visual section", hasAll(drawBoss, ['visualSection("boss")', 'v("phasePulseRingAlpha"', 'v("auraRadiusScale"', 'v("shieldRingScale"', 'v("chargeRingScale"']), "drawBoss must read P1 visual parameters from presentation config.");
addCheck("runtime", "dot durability reads config width", hasAll(drawDotDurability, ['visualNumber("dot", "durabilityWidthMin"', 'visualNumber("dot", "durabilityWidthScale"']), "Dot durability bar should scale from tuning config.");
addCheck("runtime", "drawProjectiles reads projectile visual section", hasAll(drawProjectiles, ['visualNumber("projectile"', 'v("sparkAlpha"', 'v("trailShadowBlur"', 'v("spaceTrailWidth"', 'v("coreRadiusScaleY"']), "Projectile rendering must read P1 visual parameters from presentation config.");
addCheck("runtime", "drawCollectorUnits reads helper visual section", hasAll(drawCollectorUnits, ['visualNumber("helper"', 'v("thrusterAlpha"', 'v("collectorTrailAlphaBase"', 'v("collectorAuraRadiusScale"', 'v("collectorNoseAlpha"']), "Collector/drone helper rendering must read P1 visual parameters from presentation config.");
addCheck("runtime", "drawVacuumUnits reads helper visual section", hasAll(drawVacuumUnits, ['visualNumber("helper"', 'v("rangeAlpha"', 'v("vacuumIntakeAlphaScale"', 'v("vacuumFanArmCount"', 'v("vacuumCoreRadiusScale"']), "Canon/Vacuum helper rendering must read P1 visual parameters from presentation config.");
addCheck("runtime", "drawOriginalTurretUnit reads turret visual section", hasAll(drawOriginalTurretUnit, ['visualNumber("turret"', 'v("shotPulseMs"', 'v("aimLineAlpha"', 'v("recoilGlowAlpha"', 'v("plateArcPulseAlpha"']), "Turret rendering must read P1 visual parameters from presentation config.");

addCheck(
  "hygiene",
  "old dot visual literals are not embedded",
  hasNone(drawDots, [
    "const spawnScale = 0.9 + clamp",
    "Math.sin(now / 120 + dot.angle) * 0.05",
    "clamp(dot.vacuumShrink || 0, 0, 0.82)",
    'dot.type === "charger_dot" ? 24',
    'dot.type === "charger_dot" ? 16 : 7',
    "radius * 1.32",
  ]),
  "Migrated dot presentation values should not drift back into runtime literals.",
);

addCheck(
  "hygiene",
  "old boss visual literals are not embedded",
  hasNone(drawBoss, [
    "phasePulse * 0.34",
    'boss.phase === "supernova_charge" ? 30 : 20',
    "boss.radius * 1.78",
    "boss.radius * 1.82",
    "for (let i = 0; i < 7; i += 1)",
  ]),
  "Migrated boss presentation values should not drift back into runtime literals.",
);

addCheck(
  "hygiene",
  "old projectile/helper/turret flat visual reads are not embedded",
  hasNone(`${drawProjectiles}\n${drawCollectorUnits}\n${drawVacuumUnits}\n${drawOriginalTurretUnit}`, [
    "visuals.projectileSparkAlpha",
    "visuals.helperThrusterAlpha",
    "visuals.helperRangeAlpha",
    "visuals.turretAimLineAlpha",
    "visuals.turretRecoilGlowAlpha",
  ]),
  "Migrated projectile/helper/turret values should not drift back into flat runtime literals.",
);

const summary = checks.reduce(
  (acc, check) => {
    acc.total += 1;
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  },
  { total: 0, pass: 0, fail: 0 },
);

const report = {
  generatedAt: new Date().toISOString(),
  scope: "presentation runtime config hygiene",
  files: ["config/presentation_runtime_tuning.json", "src/main.js"],
  summary,
  checks,
  findings,
};

function markdown(reportData) {
  const lines = [
    "# Presentation Config Validation",
    "",
    `Generated: ${reportData.generatedAt}`,
    `Scope: ${reportData.scope}`,
    "",
    "## Summary",
    "",
    `Checks: ${reportData.summary.total}`,
    `Passed: ${reportData.summary.pass}`,
    `Failed: ${reportData.summary.fail}`,
    "",
    "## Checks",
    "",
    "| Status | Group | Check | Detail |",
    "| --- | --- | --- | --- |",
    ...reportData.checks.map((check) => `| ${check.status.toUpperCase()} | ${check.group} | ${check.name} | ${check.detail.replaceAll("|", "\\|")} |`),
    "",
    "## Findings",
    "",
    reportData.findings.length ? reportData.findings.map((finding) => `- ${finding.severity}: ${finding.group}.${finding.name}`).join("\n") : "- clean",
    "",
  ];
  return lines.join("\n");
}

fs.writeFileSync(path.join(outputDir, "presentation_config_validation_report.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, "presentation_config_validation_report.md"), markdown(report), "utf8");

console.log(JSON.stringify({
  total: summary.total,
  passed: summary.pass,
  failed: summary.fail,
}, null, 2));

if (findings.length) process.exit(1);
