import fs from "node:fs";
import path from "node:path";

import {
  resolveBossHitCue,
  resolveBossPhaseCue,
  resolveDamageCue,
  resolveDeathCue,
} from "../src/combatReadability.js";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const combatFeedback = JSON.parse(
  fs.readFileSync(path.join(root, "config", "combat_feedback.json"), "utf8"),
);

const expectedDamageSources = [
  "turret",
  "drone",
  "swipe",
  "vacuum",
  "burn",
  "mortar",
  "marines",
  "tesla",
  "laser",
  "security_beam",
  "missile",
  "railgun",
  "flame",
  "cryo",
  "plasma",
];

const findings = [];
let checkCount = 0;

function expect(name, condition, detail = "") {
  checkCount += 1;
  if (!condition) findings.push({ severity: "error", name, detail });
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

for (const source of expectedDamageSources) {
  const cue = resolveDamageCue(combatFeedback, source);
  expect(`${source}.color.hex`, isHexColor(cue.color), cue.color);
  expect(`${source}.impact.positive`, cue.impact > 0, String(cue.impact));
  expect(`${source}.sparkBonus.nonNegative`, cue.sparkBonus >= 0, String(cue.sparkBonus));
  expect(`${source}.deathKind.present`, typeof cue.deathKind === "string" && cue.deathKind.length > 0, cue.deathKind);
}

const turret = resolveDamageCue(combatFeedback, "turret");
expect("turret.semantic.baseline", turret.color === "#ffffff" && turret.impact === 1 && turret.deathKind === "none");
expect("turret.death.semantic", resolveDeathCue(combatFeedback, "turret").semanticDeath === true);

const mortar = resolveDamageCue(combatFeedback, "mortar");
expect("mortar.heavy.identity", mortar.deathKind === "blast" && mortar.impact >= 1.5 && mortar.sparkBonus >= 3);

const teslaDeath = resolveDeathCue(combatFeedback, "tesla");
expect("tesla.arc.identity", teslaDeath.kind === "arcs" && teslaDeath.arcCount >= 2);

const railgunDeath = resolveDeathCue(combatFeedback, "railgun");
expect("railgun.beam.identity", railgunDeath.kind === "beam_trace" && railgunDeath.sparkBonus >= 4);

const shield = resolveBossPhaseCue(combatFeedback, "shield_ring", { shield_ring: "#00ffff" });
expect("boss.shield.config.wins", shield.color === "#38bdf8" && shield.shieldHitText === "SHIELD");
expect("boss.shield.softer.hit", shield.hitSparkScale < 1);

const charge = resolveBossPhaseCue(combatFeedback, "supernova_charge");
expect("boss.charge.warning", charge.warningText === "INTERRUPT" && charge.phaseBurstCount >= 36);

const reward = resolveBossPhaseCue(combatFeedback, "collapse_reward");
expect("boss.reward.vulnerable", reward.warningText === "VULNERABLE" && reward.hitSparkScale > 1);

const unknownPhase = resolveBossPhaseCue({}, "unknown_phase", { default: "#123456" });
expect("boss.unknown.fallback", unknownPhase.color === "#123456" && unknownPhase.label === "unknown phase");

const bossHit = resolveBossHitCue(combatFeedback);
expect("boss.hit.thresholds", bossHit.minVisibleDamageRatio > 0 && bossHit.heavyHitDamageRatio > bossHit.minVisibleDamageRatio);
expect("boss.hit.labels", bossHit.heavyHitText === "CRACK" && bossHit.shieldBreakText === "BREAK");

const report = {
  generatedAt: new Date().toISOString(),
  checks: checkCount,
  expectedDamageSources,
  findings,
};

fs.writeFileSync(
  path.join(outputDir, "combat_readability_validation_report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(JSON.stringify(report, null, 2));

if (findings.some((item) => item.severity === "error")) {
  process.exit(1);
}

