import fs from "node:fs";
import path from "node:path";

import { createCombatPresentationAudit } from "../src/combatPresentationAudit.js";
import {
  buildFirstSessionCombatFlow,
  recordFirstSessionCombatFlow,
  validateFirstSessionCombatFlow,
} from "../src/firstSessionCombatFlow.js";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const combatFeedback = JSON.parse(fs.readFileSync(path.join(root, "config", "combat_feedback.json"), "utf8"));
const adDemos = JSON.parse(fs.readFileSync(path.join(root, "config", "ad_demo_timelines.json"), "utf8"));
const vfxRecipes = JSON.parse(fs.readFileSync(path.join(root, "config", "vfx_recipes.json"), "utf8"));

const config = { combatFeedback, adDemos, vfxRecipes };
const findings = [];
let checkCount = 0;

function expect(name, condition, detail = "") {
  checkCount += 1;
  if (!condition) findings.push({ severity: "error", name, detail });
}

const flow = buildFirstSessionCombatFlow(config, { demoId: "blackhole10" });

expect("flow.demoId", flow.demoId === "blackhole10", flow.demoId);
expect("flow.bossTarget", flow.targets.bossAppearsBySecond <= 6.2, String(flow.targets.bossAppearsBySecond));
expect("flow.rewardTarget", flow.targets.fullScreenRewardBySecond <= 9.5, String(flow.targets.fullScreenRewardBySecond));
expect("flow.sequence.length", flow.sequence.length >= 9, String(flow.sequence.length));
expect("flow.hasSemanticDeath", flow.sequence.some((event) => event.type === "semantic_death" && event.semanticTheme === "blackhole"));
expect("flow.hasSkillUltimate", flow.sequence.some((event) => event.type === "skill_ultimate" && event.effect === "void_collapse"));
expect("flow.hasBossShield", flow.sequence.some((event) => event.type === "boss_phase" && event.phase === "shield_ring"));
expect("flow.hasBossInterrupt", flow.sequence.some((event) => event.type === "boss_phase" && event.phase === "collapse_reward"));

const audit = createCombatPresentationAudit({ maxEvents: 64 });
const recorded = recordFirstSessionCombatFlow(audit, flow);
const validation = validateFirstSessionCombatFlow(audit, flow);

expect("recorded.count", recorded.length === flow.sequence.length, `${recorded.length}/${flow.sequence.length}`);
expect("validation.clean", validation.findings.length === 0, JSON.stringify(validation.findings));
expect("validation.requiredTypes", validation.summary.typeCounts.skill_ultimate === 1 && validation.summary.typeCounts.boss_phase >= 3, JSON.stringify(validation.summary.typeCounts));
expect("validation.requiredSources", validation.summary.sourceCounts.turret >= 2 && validation.summary.sourceCounts.swipe >= 1, JSON.stringify(validation.summary.sourceCounts));
expect("validation.particleBudget", validation.summary.particleBudget >= 120, String(validation.summary.particleBudget));

const report = {
  generatedAt: new Date().toISOString(),
  checks: checkCount,
  flow,
  validation,
  findings,
};

fs.writeFileSync(
  path.join(outputDir, "first_session_combat_flow_validation_report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(JSON.stringify(report, null, 2));

if (findings.some((item) => item.severity === "error")) {
  process.exit(1);
}

