import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCombatSession, validateCombatContent } from "../src/combatSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.json"), "utf8"));
const simulation = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_simulation.json"), "utf8"));
const validation = validateCombatContent(content);
if (!validation.accepted) throw new Error(`combat content is invalid: ${JSON.stringify(validation.findings)}`);
const args = process.argv.slice(2);
const scenarioArgIndex = args.indexOf("--scenario-id");
const scenarioId = scenarioArgIndex >= 0 ? String(args[scenarioArgIndex + 1] || "") : "";
const selectedScenarios = scenarioId
  ? simulation.scenarios.filter((scenario) => scenario.scenarioId === scenarioId)
  : simulation.scenarios;
if (scenarioId && !selectedScenarios.length) throw new Error(`unknown combat simulation scenario: ${scenarioId}`);

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function chooseAction(control, policy) {
  const skills = (control.availableActions?.skills || []).filter((skill) => skill.available);
  if (!skills.length) return null;
  const scored = skills.map((skill) => {
    const name = String(skill.kind || "");
    const hpRatio = Number(control.actorHpRatio || 1);
    let score = name.includes("damage") || name === "direct_damage" || name === "multi_hit" ? 100 : 10;
    if (policy === "survivability") {
      if (hpRatio < 0.45 && ["heal", "heal_over_time", "shield", "cleanse", "defensive_stance"].includes(name)) score += 150;
      if (name === "resource") score += 20;
    }
    score -= Number(skill.cost?.mp || 0) * 0.1;
    score -= Number(skill.cooldown || 0) * 0.5;
    return { skill, score };
  }).sort((a, b) => b.score - a.score || a.skill.skillId.localeCompare(b.skill.skillId));
  const selected = scored[0].skill;
  const candidates = selected.targetCandidates || [];
  const target = selected.target === "self"
    ? candidates.find((entry) => entry.unitId === control.actorId && entry.alive)
    : candidates.find((entry) => entry.alive && entry.side === "enemy")
      || candidates.find((entry) => entry.alive && entry.side === "player")
      || candidates.find((entry) => entry.alive);
  return {
    unitId: control.actorId,
    skillId: selected.skillId,
    targetIds: target ? [target.unitId] : [],
  };
}

function runScenario(scenario, runIndex) {
  const session = createCombatSession(content, { encounterId: scenario.encounterId, seed: Number(simulation.seedStart) + runIndex });
  session.start();
  session.advanceUntilPlayerInput({ maxSteps: simulation.maxSteps });
  let steps = 0;
  while (session.snapshot().status === "active" && steps < simulation.maxSteps) {
    const control = session.combatControlState();
    if (control.requiresPlayerInput) {
      const current = session.snapshot().units.find((unit) => unit.unitId === control.actorId);
      const actorHpRatio = current ? Number(current.hp) / Math.max(1, Number(current.hpMax)) : 1;
      const action = chooseAction({ ...control, actorHpRatio }, scenario.playerPolicy);
      if (!action) throw new Error(`no legal player action for ${scenario.scenarioId}`);
      const result = session.submitPlayerAction(action.unitId, action.skillId, action.targetIds);
      if (!result.accepted) throw new Error(`simulation action rejected: ${scenario.scenarioId}:${result.reason}`);
    } else {
      const result = session.advanceUntilPlayerInput({ maxSteps: simulation.maxSteps });
      if (!result.accepted) throw new Error(`simulation advance rejected: ${scenario.scenarioId}:${result.reason}`);
    }
    steps += 1;
  }
  if (session.snapshot().status === "active") throw new Error(`simulation did not terminate: ${scenario.scenarioId}`);
  const snapshot = session.snapshot();
  const result = snapshot.result || {};
  return {
    seed: snapshot.seed,
    outcome: result.outcome || snapshot.outcome || "draw",
    rounds: Number(result.round || snapshot.round || 0),
    events: snapshot.events.length,
    damage: Number(result.combatStats?.damage || 0),
    healing: Number(result.combatStats?.healing || 0),
    incomingDamage: Number(result.combatStats?.damageTaken || 0),
    criticalHits: Number(result.combatStats?.criticalHits || 0),
    replayId: snapshot.replayId,
  };
}

const reports = [];
for (const scenario of selectedScenarios) {
  const runs = [];
  for (let index = 0; index < simulation.runsPerScenario; index += 1) runs.push(runScenario(scenario, index));
  const wins = runs.filter((run) => run.outcome === "victory").length;
  const winRate = wins / runs.length;
  const summary = {
    scenarioId: scenario.scenarioId,
    encounterId: scenario.encounterId,
    playerPolicy: scenario.playerPolicy,
    runs: runs.length,
    outcomes: Object.fromEntries([...new Set(runs.map((run) => run.outcome))].map((outcome) => [outcome, runs.filter((run) => run.outcome === outcome).length])),
    winRate,
    medianRounds: percentile(runs.map((run) => run.rounds), 0.5),
    p95Rounds: percentile(runs.map((run) => run.rounds), 0.95),
    p95Events: percentile(runs.map((run) => run.events), 0.95),
    averageDamage: runs.reduce((sum, run) => sum + run.damage, 0) / runs.length,
    averageHealing: runs.reduce((sum, run) => sum + run.healing, 0) / runs.length,
    averageIncomingDamage: runs.reduce((sum, run) => sum + run.incomingDamage, 0) / runs.length,
    limits: scenario.balance,
    balancePass: winRate >= scenario.balance.winRateMin
      && winRate <= scenario.balance.winRateMax
      && percentile(runs.map((run) => run.rounds), 0.5) <= scenario.balance.medianRoundsMax
      && percentile(runs.map((run) => run.events), 0.95) <= scenario.balance.p95EventsMax,
    runs,
  };
  reports.push(summary);
}

const outputDir = path.join(root, "outputs", "combat_simulation");
fs.mkdirSync(outputDir, { recursive: true });
const report = {
  schema: "idlewuxia.combat_simulation_report.v1",
  generatedAt: new Date().toISOString(),
  source: {
    content: "config/wuxia_combat_content.json",
    simulation: "config/wuxia_combat_simulation.json",
    runtime: "src/combatSession.js",
  },
  sharedRuntime: true,
  reports,
  accepted: reports.every((entry) => entry.balancePass),
};
const outputStem = scenarioId ? `combat_simulation_${scenarioId}_report` : "combat_simulation_report";
fs.writeFileSync(path.join(outputDir, `${outputStem}.json`), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, `${outputStem}.md`), [
  "# Combat Simulation Report",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  "The simulator calls the same `src/combatSession.js` interpreter and the same `config/wuxia_combat_content.json` definitions used by runtime.",
  "",
  ...reports.map((entry) => `- ${entry.scenarioId}: winRate=${entry.winRate.toFixed(3)}, medianRounds=${entry.medianRounds}, p95Events=${entry.p95Events}, balance=${entry.balancePass ? "PASS" : "FAIL"}`),
  "",
  `Overall: ${report.accepted ? "PASS" : "FAIL"}`,
  "",
].join("\n"), "utf8");
console.log(JSON.stringify({ accepted: report.accepted, scenarios: reports.map((entry) => ({ scenarioId: entry.scenarioId, winRate: entry.winRate, medianRounds: entry.medianRounds, p95Events: entry.p95Events, balancePass: entry.balancePass })) }, null, 2));
if (!report.accepted) process.exit(1);
