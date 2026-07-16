import fs from "node:fs";
import path from "node:path";

import {
  createCombatPresentationAudit,
  recordCombatPresentationEvent,
  summarizeCombatPresentationAudit,
  validateCombatPresentationAudit,
} from "../src/combatPresentationAudit.js";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const findings = [];
let checkCount = 0;

function expect(name, condition, detail = "") {
  checkCount += 1;
  if (!condition) findings.push({ severity: "error", name, detail });
}

const audit = createCombatPresentationAudit({ maxEvents: 4 });

recordCombatPresentationEvent(audit, {
  type: "hit_ring",
  source: "turret",
  color: "#ffffff",
  particleCount: 1,
});
recordCombatPresentationEvent(audit, {
  type: "impact_sparks",
  source: "tesla",
  color: "#38bdf8",
  particleCount: 7,
  arcCount: 2,
});
recordCombatPresentationEvent(audit, {
  type: "weapon_death",
  source: "mortar",
  color: "#f97316",
  deathKind: "blast",
  particleCount: 17,
});
recordCombatPresentationEvent(audit, {
  type: "boss_phase",
  phase: "shield_ring",
  color: "#38bdf8",
  text: "SHIELD",
  particleCount: 30,
});
recordCombatPresentationEvent(audit, {
  type: "boss_hit",
  source: "railgun",
  phase: "collapse_reward",
  color: "#a78bfa",
  heavy: true,
  shielded: false,
});

const summary = summarizeCombatPresentationAudit(audit);

expect("summary.totalEvents", summary.totalEvents === 5, JSON.stringify(summary));
expect("summary.recentEvents.capped", summary.recentEvents.length === 4, JSON.stringify(summary.recentEvents));
expect("summary.firstStoredAfterCap", summary.recentEvents[0]?.type === "impact_sparks", JSON.stringify(summary.recentEvents));
expect("summary.hitRingCount", summary.typeCounts.hit_ring === 1, JSON.stringify(summary.typeCounts));
expect("summary.sourceCounts", summary.sourceCounts.tesla === 1 && summary.sourceCounts.mortar === 1, JSON.stringify(summary.sourceCounts));
expect("summary.phaseCounts", summary.phaseCounts.shield_ring === 1 && summary.phaseCounts.collapse_reward === 1, JSON.stringify(summary.phaseCounts));
expect("summary.particleBudget", summary.particleBudget === 55, String(summary.particleBudget));
expect("summary.heavyHits", summary.heavyHits === 1, String(summary.heavyHits));
expect("summary.shieldedHits", summary.shieldedHits === 0, String(summary.shieldedHits));

const validation = validateCombatPresentationAudit(audit, {
  requiredTypes: ["hit_ring", "impact_sparks", "weapon_death", "boss_phase", "boss_hit"],
  requiredSources: ["turret", "tesla", "mortar", "railgun"],
  requiredPhases: ["shield_ring", "collapse_reward"],
  minParticleBudget: 50,
});

expect("validation.clean", validation.findings.length === 0, JSON.stringify(validation.findings));

const report = {
  generatedAt: new Date().toISOString(),
  checks: checkCount,
  summary,
  validation,
  findings,
};

fs.writeFileSync(
  path.join(outputDir, "combat_presentation_audit_validation_report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(JSON.stringify(report, null, 2));

if (findings.some((item) => item.severity === "error")) {
  process.exit(1);
}

