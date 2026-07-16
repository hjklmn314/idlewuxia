const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const DEFAULT_DAMAGE_COLORS = Object.freeze({
  turret: "#ffffff",
  drone: "#60a5fa",
  swipe: "#ffffff",
  vacuum: "#8b5cf6",
  burn: "#fb923c",
  mortar: "#f97316",
  marines: "#22c55e",
  tesla: "#38bdf8",
  laser: "#facc15",
  security_beam: "#2dd4bf",
  missile: "#fb7185",
  railgun: "#a78bfa",
  flame: "#fb923c",
  cryo: "#7dd3fc",
  plasma: "#c084fc",
});

const DEFAULT_BOSS_PHASES = Object.freeze({
  core_warmup: {
    label: "Core Warmup",
    color: "#fb7185",
    ringAlpha: 0.22,
    hitSparkScale: 1,
    phaseBurstCount: 20,
  },
  shield_ring: {
    label: "Shield Ring",
    color: "#38bdf8",
    ringAlpha: 0.36,
    hitSparkScale: 0.72,
    shieldHitText: "SHIELD",
    phaseBurstCount: 28,
  },
  supernova_charge: {
    label: "Supernova Charge",
    color: "#fb7185",
    ringAlpha: 0.44,
    hitSparkScale: 1.18,
    phaseBurstCount: 36,
    warningText: "INTERRUPT",
  },
  collapse_reward: {
    label: "Collapse Reward",
    color: "#34d399",
    ringAlpha: 0.52,
    hitSparkScale: 1.45,
    phaseBurstCount: 42,
    warningText: "VULNERABLE",
  },
});

const DEFAULT_BOSS_HIT = Object.freeze({
  minVisibleDamageRatio: 0.003,
  heavyHitDamageRatio: 0.035,
  hitShake: 2.4,
  heavyHitText: "CRACK",
  shieldBreakText: "BREAK",
});

function combatFeedbackFrom(config) {
  if (!config) return {};
  return config.combatFeedback || config;
}

function isHexColor(value) {
  return HEX_COLOR.test(String(value || ""));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function intAtLeast(value, fallback, min = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.floor(number));
}

function colorWithFallback(candidate, fallback) {
  return isHexColor(candidate) ? candidate : fallback;
}

function fallbackDamageColor(source, fallbackColors = {}) {
  return (
    fallbackColors[source] ||
    fallbackColors.default ||
    DEFAULT_DAMAGE_COLORS[source] ||
    "#ffffff"
  );
}

function fallbackPhaseColor(phase, fallbackColors = {}) {
  if (fallbackColors[phase]) return fallbackColors[phase];
  if (fallbackColors.default) return fallbackColors.default;
  if (DEFAULT_BOSS_PHASES[phase]?.color) return DEFAULT_BOSS_PHASES[phase].color;
  return "#fb7185";
}

export function resolveDamageCue(config, source = "turret", fallbackColors = {}) {
  const key = source || "turret";
  const feedback = combatFeedbackFrom(config);
  const configured = feedback.damageSources?.[key] || {};
  return {
    source: key,
    color: colorWithFallback(configured.color, fallbackDamageColor(key, fallbackColors)),
    impact: positiveNumber(configured.impact, 1),
    sparkBonus: intAtLeast(configured.sparkBonus, 0),
    arcCount: intAtLeast(configured.arcCount, 0),
    deathKind: configured.deathKind || "none",
  };
}

export function resolveDamageColor(config, source = "turret", fallbackColors = {}) {
  return resolveDamageCue(config, source, fallbackColors).color;
}

export function resolveDeathCue(config, source = "turret", fallbackColors = {}) {
  const cue = resolveDamageCue(config, source, fallbackColors);
  return {
    source: cue.source,
    kind: cue.deathKind,
    color: cue.color,
    sparkBonus: cue.sparkBonus,
    arcCount: cue.arcCount,
    semanticDeath: cue.deathKind === "none",
  };
}

export function resolveBossPhaseCue(config, phase = "core_warmup", fallbackColors = {}) {
  const key = phase || "core_warmup";
  const feedback = combatFeedbackFrom(config);
  const defaults = DEFAULT_BOSS_PHASES[key] || {};
  const configured = feedback.bossPhases?.[key] || {};
  return {
    phase: key,
    label: configured.label || defaults.label || String(key).replaceAll("_", " "),
    color: colorWithFallback(configured.color, fallbackPhaseColor(key, fallbackColors)),
    ringAlpha: positiveNumber(configured.ringAlpha, positiveNumber(defaults.ringAlpha, 0.24)),
    hitSparkScale: positiveNumber(configured.hitSparkScale, positiveNumber(defaults.hitSparkScale, 1)),
    phaseBurstCount: intAtLeast(configured.phaseBurstCount, intAtLeast(defaults.phaseBurstCount, 20, 1), 1),
    shieldHitText: configured.shieldHitText || defaults.shieldHitText || "SHIELD",
    warningText: configured.warningText || defaults.warningText || "",
  };
}

export function resolveBossHitCue(config) {
  const feedback = combatFeedbackFrom(config);
  const configured = feedback.bossHit || {};
  return {
    minVisibleDamageRatio: positiveNumber(
      configured.minVisibleDamageRatio,
      DEFAULT_BOSS_HIT.minVisibleDamageRatio,
    ),
    heavyHitDamageRatio: positiveNumber(
      configured.heavyHitDamageRatio,
      DEFAULT_BOSS_HIT.heavyHitDamageRatio,
    ),
    hitShake: nonNegativeNumber(configured.hitShake, DEFAULT_BOSS_HIT.hitShake),
    heavyHitText: configured.heavyHitText || DEFAULT_BOSS_HIT.heavyHitText,
    shieldBreakText: configured.shieldBreakText || DEFAULT_BOSS_HIT.shieldBreakText,
  };
}

