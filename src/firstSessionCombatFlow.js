import {
  recordCombatPresentationEvent,
  summarizeCombatPresentationAudit,
  validateCombatPresentationAudit,
} from "./combatPresentationAudit.js";
import {
  resolveBossHitCue,
  resolveBossPhaseCue,
  resolveDamageCue,
} from "./combatReadability.js";

const DEFAULT_TARGETS = Object.freeze({
  bossAppearsBySecond: 6.2,
  fullScreenRewardBySecond: 9.5,
});

function combatFeedbackFrom(config) {
  return config?.combatFeedback || config?.combat_feedback || config || {};
}

function adDemosFrom(config) {
  return config?.adDemos || config?.ad_demo_timelines || {};
}

function vfxRecipesFrom(config) {
  return config?.vfxRecipes || config?.vfx_recipes || {};
}

function demoTimeline(config, demoId) {
  const adDemos = adDemosFrom(config);
  return adDemos.demos?.[demoId] || [];
}

function globalRules(config) {
  return adDemosFrom(config).globalRules || {};
}

function actionAt(timeline, action) {
  return timeline.find((item) => item.action === action) || null;
}

function actionsAt(timeline, action) {
  return timeline.filter((item) => item.action === action);
}

function semanticTheme(timeline) {
  const theme = actionAt(timeline, "setTheme")?.theme || "blackhole";
  if (theme === "clean") return "clean";
  if (theme === "paint") return "paint";
  return "blackhole";
}

function semanticDeathEffect(theme) {
  if (theme === "clean") return "foam_pop_fade";
  if (theme === "paint") return "watercolor_bloom";
  return "spiral_absorb";
}

function recipeParticles(config, effect, fallback) {
  const number = Number(vfxRecipesFrom(config)?.[effect]?.particleCount);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function eventTime(action, fallback) {
  const number = Number(action?.t);
  return Number.isFinite(number) ? number : fallback;
}

function makeEvent(stage, event) {
  return {
    stage,
    required: true,
    ...event,
  };
}

function orderedEventMatches(actual, expected) {
  if (actual.type !== expected.type) return false;
  for (const key of ["source", "phase", "deathKind", "semanticTheme", "effect"]) {
    if (expected[key] && actual[key] !== expected[key]) return false;
  }
  return true;
}

function validateOrderedSequence(events, expectedSequence) {
  const findings = [];
  let cursor = 0;
  for (const expected of expectedSequence.filter((event) => event.required !== false)) {
    const foundAt = events.findIndex((event, index) => index >= cursor && orderedEventMatches(event, expected));
    if (foundAt < 0) {
      findings.push({
        severity: "error",
        type: "missing-ordered-event",
        stage: expected.stage,
        expected: {
          type: expected.type,
          source: expected.source || "",
          phase: expected.phase || "",
          deathKind: expected.deathKind || "",
          semanticTheme: expected.semanticTheme || "",
          effect: expected.effect || "",
        },
      });
      continue;
    }
    cursor = foundAt + 1;
  }
  return findings;
}

export function buildFirstSessionCombatFlow(config, options = {}) {
  const demoId = options.demoId || "blackhole10";
  const timeline = demoTimeline(config, demoId);
  const rules = globalRules(config);
  const feedback = combatFeedbackFrom(config);
  const theme = semanticTheme(timeline);
  const semanticEffect = semanticDeathEffect(theme);
  const spawnBoss = actionAt(timeline, "spawnBoss");
  const bossCharge = actionAt(timeline, "bossCharge");
  const ultimate = actionAt(timeline, "ultimate");
  const reward = actionAt(timeline, "reward");
  const swipeActions = actionsAt(timeline, "scriptSwipe");
  const turret = resolveDamageCue(feedback, "turret");
  const swipe = resolveDamageCue(feedback, "swipe");
  const shield = resolveBossPhaseCue(feedback, spawnBoss?.phase || "shield_ring");
  const charge = resolveBossPhaseCue(feedback, "supernova_charge");
  const collapse = resolveBossPhaseCue(feedback, "collapse_reward");
  const bossHit = resolveBossHitCue(feedback);
  const sequence = [
    makeEvent("first_turret_hit_ring", {
      t: 1.1,
      type: "hit_ring",
      source: "turret",
      targetKind: "dot_basic",
      color: turret.color,
      particleCount: 1,
    }),
    makeEvent("first_turret_impact_sparks", {
      t: 1.11,
      type: "impact_sparks",
      source: "turret",
      targetKind: "dot_basic",
      color: turret.color,
      particleCount: 3 + turret.sparkBonus,
      arcCount: turret.arcCount,
      sparkBonus: turret.sparkBonus,
    }),
    makeEvent("first_dot_semantic_death", {
      t: 1.12,
      type: "semantic_death",
      source: "turret",
      targetKind: "dot_basic",
      color: turret.color,
      deathKind: turret.deathKind,
      semanticTheme: theme,
      effect: semanticEffect,
      particleCount: recipeParticles(config, semanticEffect, 12),
    }),
    makeEvent("first_swipe_hit", {
      t: eventTime(swipeActions[0], 1.2),
      type: "hit_ring",
      source: "swipe",
      targetKind: "dot_basic",
      color: swipe.color,
      particleCount: 1,
    }),
    makeEvent("first_swipe_death", {
      t: eventTime(swipeActions[0], 1.2) + 0.08,
      type: "semantic_death",
      source: "swipe",
      targetKind: "dot_basic",
      color: swipe.color,
      deathKind: swipe.deathKind,
      semanticTheme: theme,
      effect: semanticEffect,
      particleCount: recipeParticles(config, semanticEffect, 12),
    }),
    makeEvent("boss_shield_phase", {
      t: eventTime(spawnBoss, rules.bossAppearsBySecond || DEFAULT_TARGETS.bossAppearsBySecond),
      type: "boss_phase",
      phase: shield.phase,
      targetKind: "boss",
      color: shield.color,
      text: shield.warningText || shield.shieldHitText,
      particleCount: 2 + shield.phaseBurstCount,
    }),
    makeEvent("boss_shield_hit", {
      t: eventTime(spawnBoss, 5.8) + 0.35,
      type: "boss_hit",
      source: "turret",
      phase: shield.phase,
      targetKind: "boss",
      color: shield.color,
      particleCount: 1,
      shielded: true,
    }),
    makeEvent("boss_charge_warning", {
      t: eventTime(bossCharge, 7.0),
      type: "boss_phase",
      phase: charge.phase,
      targetKind: "boss",
      color: charge.color,
      text: charge.warningText,
      particleCount: 2 + charge.phaseBurstCount + (charge.warningText ? 1 : 0),
    }),
    makeEvent("skill_ultimate_resolution", {
      t: eventTime(ultimate, 8.8),
      type: "skill_ultimate",
      source: "iaa_skill",
      targetKind: "screen",
      color: collapse.color,
      effect: ultimate?.effect || "void_collapse",
      particleCount: recipeParticles(config, ultimate?.effect || "void_collapse", 160),
    }),
    makeEvent("boss_collapse_reward", {
      t: eventTime(ultimate, 8.8) + 0.15,
      type: "boss_phase",
      phase: collapse.phase,
      targetKind: "boss",
      color: collapse.color,
      text: collapse.warningText,
      particleCount: 2 + collapse.phaseBurstCount + (collapse.warningText ? 1 : 0),
    }),
    makeEvent("boss_heavy_confirmation", {
      t: eventTime(ultimate, 8.8) + 0.3,
      type: "boss_hit",
      source: "turret",
      phase: collapse.phase,
      targetKind: "boss",
      color: collapse.color,
      particleCount: 1,
      heavy: true,
      text: bossHit.heavyHitText,
    }),
  ].sort((a, b) => a.t - b.t);

  return {
    demoId,
    targets: {
      bossAppearsBySecond: Number(rules.bossAppearsBySecond) || DEFAULT_TARGETS.bossAppearsBySecond,
      fullScreenRewardBySecond: Number(rules.fullScreenRewardBySecond) || eventTime(reward, DEFAULT_TARGETS.fullScreenRewardBySecond),
    },
    semanticTheme: theme,
    rewardText: reward?.text || "",
    sequence,
    requiredTypes: ["hit_ring", "impact_sparks", "semantic_death", "boss_phase", "boss_hit", "skill_ultimate"],
    requiredSources: ["turret", "swipe"],
    requiredPhases: [shield.phase, charge.phase, collapse.phase],
  };
}

export function recordFirstSessionCombatFlow(audit, flow) {
  if (!audit || !flow) return [];
  return flow.sequence.map((event) =>
    recordCombatPresentationEvent(audit, {
      ...event,
      at: event.t * 1000,
    }),
  );
}

export function validateFirstSessionCombatFlow(audit, flow, options = {}) {
  const summary = summarizeCombatPresentationAudit(audit);
  const base = validateCombatPresentationAudit(audit, {
    requiredTypes: options.requiredTypes || flow.requiredTypes,
    requiredSources: options.requiredSources || flow.requiredSources,
    requiredPhases: options.requiredPhases || flow.requiredPhases,
    minParticleBudget: options.minParticleBudget || 120,
  });
  const findings = [...base.findings];
  findings.push(...validateOrderedSequence(summary.recentEvents, flow.sequence));

  if (flow.targets.bossAppearsBySecond > DEFAULT_TARGETS.bossAppearsBySecond) {
    findings.push({
      severity: "error",
      type: "boss-target-too-late",
      actual: flow.targets.bossAppearsBySecond,
      expected: DEFAULT_TARGETS.bossAppearsBySecond,
    });
  }
  if (flow.targets.fullScreenRewardBySecond > DEFAULT_TARGETS.fullScreenRewardBySecond) {
    findings.push({
      severity: "error",
      type: "reward-target-too-late",
      actual: flow.targets.fullScreenRewardBySecond,
      expected: DEFAULT_TARGETS.fullScreenRewardBySecond,
    });
  }

  return {
    summary,
    expected: {
      demoId: flow.demoId,
      semanticTheme: flow.semanticTheme,
      rewardText: flow.rewardText,
      orderedStages: flow.sequence.map((event) => event.stage),
    },
    findings,
  };
}
