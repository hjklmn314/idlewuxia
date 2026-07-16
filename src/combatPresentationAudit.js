const DEFAULT_MAX_EVENTS = 180;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function cleanKey(value, fallback = "") {
  const key = String(value || "").trim();
  return key || fallback;
}

function cleanColor(value) {
  const color = String(value || "").trim();
  return HEX_COLOR.test(color) ? color : "";
}

function cleanParticleCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

function addCount(target, key, amount = 1) {
  if (!key) return;
  target[key] = (target[key] || 0) + amount;
}

function copyCounts(counts) {
  return Object.fromEntries(Object.entries(counts || {}).sort(([a], [b]) => a.localeCompare(b)));
}

function normalizeEvent(event = {}) {
  const type = cleanKey(event.type, "unknown");
  return {
    type,
    source: cleanKey(event.source),
    phase: cleanKey(event.phase),
    targetKind: cleanKey(event.targetKind),
    color: cleanColor(event.color),
    deathKind: cleanKey(event.deathKind),
    text: cleanKey(event.text),
    effect: cleanKey(event.effect),
    semanticTheme: cleanKey(event.semanticTheme),
    particleCount: cleanParticleCount(event.particleCount),
    arcCount: cleanParticleCount(event.arcCount),
    sparkBonus: cleanParticleCount(event.sparkBonus),
    heavy: Boolean(event.heavy),
    shielded: Boolean(event.shielded),
    at: Number.isFinite(Number(event.at)) ? Number(event.at) : Date.now(),
  };
}

export function createCombatPresentationAudit(options = {}) {
  const maxEvents = cleanParticleCount(options.maxEvents) || DEFAULT_MAX_EVENTS;
  return {
    maxEvents,
    totalEvents: 0,
    particleBudget: 0,
    heavyHits: 0,
    shieldedHits: 0,
    typeCounts: {},
    sourceCounts: {},
    phaseCounts: {},
    deathKindCounts: {},
    effectCounts: {},
    targetKindCounts: {},
    recentEvents: [],
  };
}

export function recordCombatPresentationEvent(audit, event = {}) {
  if (!audit) return null;
  const normalized = normalizeEvent(event);
  audit.totalEvents = (audit.totalEvents || 0) + 1;
  audit.particleBudget = (audit.particleBudget || 0) + normalized.particleCount;
  if (normalized.heavy) audit.heavyHits = (audit.heavyHits || 0) + 1;
  if (normalized.shielded) audit.shieldedHits = (audit.shieldedHits || 0) + 1;
  addCount(audit.typeCounts, normalized.type);
  addCount(audit.sourceCounts, normalized.source);
  addCount(audit.phaseCounts, normalized.phase);
  addCount(audit.deathKindCounts, normalized.deathKind);
  addCount(audit.effectCounts, normalized.effect);
  addCount(audit.targetKindCounts, normalized.targetKind);
  audit.recentEvents.push(normalized);
  while (audit.recentEvents.length > audit.maxEvents) audit.recentEvents.shift();
  return normalized;
}

export function summarizeCombatPresentationAudit(audit) {
  const source = audit || createCombatPresentationAudit();
  return {
    totalEvents: source.totalEvents || 0,
    particleBudget: source.particleBudget || 0,
    heavyHits: source.heavyHits || 0,
    shieldedHits: source.shieldedHits || 0,
    typeCounts: copyCounts(source.typeCounts),
    sourceCounts: copyCounts(source.sourceCounts),
    phaseCounts: copyCounts(source.phaseCounts),
    deathKindCounts: copyCounts(source.deathKindCounts),
    effectCounts: copyCounts(source.effectCounts),
    targetKindCounts: copyCounts(source.targetKindCounts),
    recentEvents: [...(source.recentEvents || [])],
  };
}

export function validateCombatPresentationAudit(audit, rules = {}) {
  const summary = summarizeCombatPresentationAudit(audit);
  const findings = [];

  for (const type of rules.requiredTypes || []) {
    if (!summary.typeCounts[type]) {
      findings.push({ severity: "error", type: "missing-event-type", key: type });
    }
  }

  for (const source of rules.requiredSources || []) {
    if (!summary.sourceCounts[source]) {
      findings.push({ severity: "error", type: "missing-source", key: source });
    }
  }

  for (const phase of rules.requiredPhases || []) {
    if (!summary.phaseCounts[phase]) {
      findings.push({ severity: "error", type: "missing-phase", key: phase });
    }
  }

  if (Number.isFinite(Number(rules.minParticleBudget)) && summary.particleBudget < Number(rules.minParticleBudget)) {
    findings.push({
      severity: "error",
      type: "particle-budget-too-low",
      actual: summary.particleBudget,
      expected: Number(rules.minParticleBudget),
    });
  }

  return { summary, findings };
}
