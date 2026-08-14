import { cloneData } from "./dataClone.js";

const EPSILON = 1e-9;

export const COMBAT_CAPABILITIES = Object.freeze({
  turnOrderPolicies: Object.freeze(["speed_then_seeded_tiebreak"]),
  skillKinds: Object.freeze(["direct_damage", "elemental_damage", "multi_hit", "heal", "heal_over_time", "shield", "control", "damage_over_time", "defensive_stance", "stat_modifier", "resource", "cleanse", "utility"]),
  effectKinds: Object.freeze(["damage", "heal", "shield", "applyBuff", "removeBuff", "resource", "statModifier", "multiHit"]),
  targetSelectors: Object.freeze(["self", "single_enemy", "single_ally", "lowest_hp_ally", "random_enemy", "all_enemies", "all_allies"]),
  buffControls: Object.freeze(["stun", "silence", "root", "taunt"]),
  // Shield and cleanse are effect/skill capabilities, not persistent buff declaration features.
  buffFeatures: Object.freeze(["stat_modifiers", "damage_over_time", "heal_over_time", "stack", "refresh", "replace", "unique", "stun", "silence", "root", "taunt", "reflect", "immunity"]),
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  return Math.floor(number(value, fallback));
}

function replayHash(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `replay-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function indexById(rows, key) {
  return new Map(list(rows).filter((row) => row?.[key]).map((row) => [row[key], row]));
}

function createSeededRandom(seed = 1, restoredState = undefined) {
  // A resumed battle must continue the same deterministic random stream.  The
  // content seed chooses a new encounter stream; a persisted rngState resumes
  // that stream without re-running previous turns.
  let state = (integer(restoredState ?? seed, 1) >>> 0) || 1;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    },
    state() { return state >>> 0; },
  };
}

function resolveFormula(expression, context = {}) {
  if (typeof expression === "number") return expression;
  if (!record(expression)) throw new Error("combat formula must be a number or object");
  if (expression.ref) {
    if (!Object.prototype.hasOwnProperty.call(context, expression.ref) || !Number.isFinite(Number(context[expression.ref]))) {
      throw new Error(`combat formula reference is unavailable: ${expression.ref}`);
    }
    return Number(context[expression.ref]);
  }
  if (expression.const !== undefined) {
    if (!Number.isFinite(Number(expression.const))) throw new Error("combat formula const must be numeric");
    return Number(expression.const);
  }
  const args = list(expression.args).map((item) => resolveFormula(item, context));
  switch (expression.op) {
    case "add": return args.reduce((sum, item) => sum + item, 0);
    case "sub": return (args[0] || 0) - (args[1] || 0);
    case "mul": return (args[0] || 0) * (args[1] || 0);
    case "div": {
      if (args.length !== 2 || Math.abs(args[1]) < EPSILON) throw new Error("combat formula division requires a non-zero divisor");
      return args[0] / args[1];
    }
    case "min": return Math.min(...args);
    case "max": return Math.max(...args);
    case "clamp": return clamp(args[0] || 0, args[1] || 0, args[2] ?? args[1] ?? 0);
    case "round": return Math.round(args[0] || 0);
    case "floor": return Math.floor(args[0] || 0);
    case "ceil": return Math.ceil(args[0] || 0);
    default: throw new Error(`unsupported combat formula op: ${expression.op || "<empty>"}`);
  }
}

function formulaReferences(expression, refs = new Set()) {
  if (!record(expression)) return refs;
  if (typeof expression.ref === "string") refs.add(expression.ref);
  for (const arg of list(expression.args)) formulaReferences(arg, refs);
  return refs;
}

function resolveDerivedAttributes(formulas, context) {
  const pending = new Map(Object.entries(formulas || {}));
  const resolved = {};
  while (pending.size) {
    let progressed = false;
    for (const [attributeId, formula] of [...pending]) {
      const refs = [...formulaReferences(formula)];
      if (refs.some((ref) => pending.has(ref))) continue;
      resolved[attributeId] = resolveFormula(formula, { ...context, ...resolved });
      pending.delete(attributeId);
      progressed = true;
    }
    if (!progressed) throw new Error(`combat derived attribute cycle: ${[...pending.keys()].join(",")}`);
  }
  return resolved;
}

function normalizeAttributeContext(unit, attributes) {
  return {
    level: number(unit.level, 1),
    ...attributes,
    maxHp: number(attributes.maxHp, 1),
    maxMp: number(attributes.maxMp, 0),
  };
}

function hostile(factions, sourceFaction, targetFaction) {
  if (!sourceFaction || !targetFaction || sourceFaction === targetFaction) return false;
  const source = factions.get(sourceFaction);
  return Boolean(source?.hostileTo?.includes(targetFaction));
}

function formatName(unit) {
  return unit?.name || unit?.unitId || "单位";
}

function eventText(kind, source, target, value, skill, buff) {
  const sourceName = formatName(source);
  const targetName = formatName(target);
  if (kind === "damage") return `${sourceName}使用${skill?.name || "攻击"}，${targetName}受到${Math.max(0, integer(value))}点伤害`;
  if (kind === "heal") return `${sourceName}使${targetName}恢复${Math.max(0, integer(value))}点气血`;
  if (kind === "shield") return `${targetName}获得${Math.max(0, integer(value))}点护盾`;
  if (kind === "buff") return `${targetName}获得${buff?.name || "状态"}`;
  if (kind === "debuff") return `${targetName}陷入${buff?.name || "负面状态"}`;
  if (kind === "miss") return `${sourceName}的攻击被${targetName}闪开`;
  if (kind === "block") return `${targetName}格挡了攻击`;
  return `${sourceName}对${targetName}执行${skill?.name || "行动"}`;
}

function combatFloatText(event = {}) {
  const value = Math.max(0, integer(event.value));
  if (event.kind === "damage") return `${event.critical ? "暴击 " : ""}-${value}`;
  if (event.kind === "heal") return `+${value}`;
  if (event.kind === "miss") return "闪避";
  if (event.kind === "block") return "格挡";
  if (event.kind === "shield") return `盾 +${value}`;
  if (event.kind === "resource") return `${event.resource || "内力"} ${event.value >= 0 ? "+" : ""}${integer(event.value)}`;
  if (["skill", "skillResolved"].includes(event.kind)) return event.skill?.name || event.skillId || "招式";
  if (event.kind === "buff" || event.kind === "debuff") return event.buff?.name || event.buffId || "状态";
  if (event.kind === "periodic") return event.buff?.name || event.text || event.buffId || "状态";
  if (event.kind === "buffResisted") return "抵抗";
  if (event.kind === "buffImmune") return "免疫";
  if (event.kind === "buffRejected") return "已存在";
  if (event.kind === "buffRemoved") return "净化";
  if (event.kind === "buffExpired") return "消退";
  if (event.kind === "stunned") return "无法行动";
  if (event.kind === "victory") return "胜利";
  if (event.kind === "defeat") return "败北";
  if (event.kind === "draw") return "平局";
  if (event.kind === "runawayAttempt") return event.success ? "脱离" : "未能脱离";
  return event.text || event.buff?.name || event.buffId || event.skill?.name || event.skillId || "状态";
}

function normalizeContent(content) {
  const source = cloneData(content || {});
  const maps = {
    factions: indexById(source.factions, "factionId"),
    units: indexById(source.units, "unitId"),
    skills: indexById(source.skills, "skillId"),
    buffs: indexById(source.buffs, "buffId"),
    encounters: indexById(source.encounters, "encounterId"),
    rewards: indexById(source.rewards, "rewardId"),
    aiPolicies: indexById(source.aiPolicies, "aiPolicyId"),
    visualCues: indexById(source.visualCues, "cueId"),
    audioCues: indexById(source.audioCues, "audioCueId"),
  };
  return { source, maps };
}

function validateReference(id, map, path, findings) {
  if (!id || !map.has(id)) findings.push({ severity: "error", path, message: `missing reference ${id || "<empty>"}` });
}

function validateUniqueIds(rows, key, path, findings) {
  const seen = new Set();
  for (const [index, row] of list(rows).entries()) {
    const id = row?.[key];
    if (!id) findings.push({ severity: "error", path: `${path}.${index}.${key}`, message: "missing id" });
    else if (seen.has(id)) findings.push({ severity: "error", path: `${path}.${index}.${key}`, message: `duplicate id ${id}` });
    seen.add(id);
  }
}

function rulesDamageRule(rules, damageType) {
  return Boolean(rules?.damage?.rules?.[damageType] || rules?.damage?.defaultRule);
}

export function validateCombatContent(content) {
  const { source, maps } = normalizeContent(content);
  const findings = [];
  if (source?.schemaVersion !== "idlewuxia.combat_content.v1") findings.push({ severity: "error", path: "schemaVersion", message: "unsupported combat content schema" });
  const replayRules = source.rules?.replay || {};
  if (!COMBAT_CAPABILITIES.turnOrderPolicies.includes(source.rules?.turnOrder)) findings.push({ severity: "error", path: "rules.turnOrder", message: `unsupported or missing turn order policy ${source.rules?.turnOrder || "<empty>"}` });
  if (replayRules.schema !== "idlewuxia.combat_replay.v1") findings.push({ severity: "error", path: "rules.replay.schema", message: "combat replay contract is missing or unsupported" });
  if (replayRules.allowPause !== true || replayRules.allowReplay !== true) findings.push({ severity: "error", path: "rules.replay", message: "combat replay must allow pause and replay" });
  if (!Number.isInteger(Number(replayRules.maxCommands)) || Number(replayRules.maxCommands) < 1) findings.push({ severity: "error", path: "rules.replay.maxCommands", message: "maxCommands must be a positive integer" });
  if (!Number.isInteger(Number(replayRules.maxReplayEvents)) || Number(replayRules.maxReplayEvents) < 1) findings.push({ severity: "error", path: "rules.replay.maxReplayEvents", message: "maxReplayEvents must be a positive integer" });
  if (!maps.factions.size || !maps.units.size || !maps.skills.size || !maps.encounters.size) findings.push({ severity: "error", path: "content", message: "combat content requires factions, units, skills and encounters" });
  validateUniqueIds(source.factions, "factionId", "factions", findings);
  validateUniqueIds(source.units, "unitId", "units", findings);
  validateUniqueIds(source.skills, "skillId", "skills", findings);
  validateUniqueIds(source.buffs, "buffId", "buffs", findings);
  validateUniqueIds(source.encounters, "encounterId", "encounters", findings);
  validateUniqueIds(source.visualCues, "cueId", "visualCues", findings);
  validateUniqueIds(source.audioCues, "audioCueId", "audioCues", findings);
  validateUniqueIds(source.rewards, "rewardId", "rewards", findings);
  const formulaOps = new Set(["add", "sub", "mul", "div", "min", "max", "clamp", "round", "floor", "ceil"]);
  const formulaArity = { sub: 2, div: 2, clamp: 3, round: 1, floor: 1, ceil: 1 };
  const baseAttributeIds = new Set(["level", ...Object.keys(source.rules?.attributeDefaults || {})]);
  const derivedAttributeIds = new Set(Object.keys(source.rules?.attributes || {}));
  for (const attributeId of derivedAttributeIds) if (baseAttributeIds.has(attributeId)) findings.push({ severity: "error", path: `rules.attributes.${attributeId}`, message: "derived attributes must not shadow base attributes" });
  const formulaAttributeIds = new Set([...baseAttributeIds, ...derivedAttributeIds]);
  const effectFormulaIds = new Set([...formulaAttributeIds, "targetHp", "targetHpMax", "targetMp", "targetMpMax", "targetShield"]);
  const validateFormula = (formula, path) => {
    if (formula === undefined || formula === null || typeof formula === "number") return;
    if (!record(formula)) { findings.push({ severity: "error", path, message: "formula must be a number or object" }); return; }
    const forms = [formula.ref !== undefined, formula.const !== undefined, formula.op !== undefined].filter(Boolean).length;
    if (forms !== 1) findings.push({ severity: "error", path, message: "formula must define exactly one of ref, const or op" });
    if (formula.ref !== undefined && (typeof formula.ref !== "string" || !formula.ref)) findings.push({ severity: "error", path: `${path}.ref`, message: "formula ref must be a non-empty string" });
    if (formula.const !== undefined && !Number.isFinite(Number(formula.const))) findings.push({ severity: "error", path: `${path}.const`, message: "formula const must be numeric" });
    if (formula.op && !formulaOps.has(formula.op)) findings.push({ severity: "error", path: `${path}.op`, message: `unsupported formula op ${formula.op}` });
    if (formula.op && !list(formula.args).length) findings.push({ severity: "error", path: `${path}.args`, message: "formula op requires args" });
    if (formulaArity[formula.op] && list(formula.args).length !== formulaArity[formula.op]) findings.push({ severity: "error", path: `${path}.args`, message: `${formula.op} requires ${formulaArity[formula.op]} args` });
    if (formula.op === "div" && record(formula.args?.[1]) && formula.args[1].const !== undefined && Math.abs(Number(formula.args[1].const)) < EPSILON) findings.push({ severity: "error", path: `${path}.args.1`, message: "division by zero is forbidden" });
    for (const [index, arg] of list(formula.args).entries()) validateFormula(arg, `${path}.args.${index}`);
  };
  for (const [attributeId, formula] of Object.entries(source.rules?.attributes || {})) {
    validateFormula(formula, `rules.attributes.${attributeId}`);
    for (const ref of formulaReferences(formula)) if (!formulaAttributeIds.has(ref)) findings.push({ severity: "error", path: `rules.attributes.${attributeId}`, message: `unknown formula reference ${ref}` });
  }
  const derivedDependencies = new Map([...derivedAttributeIds].map((id) => [id, [...formulaReferences(source.rules.attributes[id])].filter((ref) => derivedAttributeIds.has(ref))]));
  const visiting = new Set();
  const visited = new Set();
  const visitDerived = (id) => {
    if (visiting.has(id)) { findings.push({ severity: "error", path: `rules.attributes.${id}`, message: `derived attribute cycle includes ${id}` }); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of derivedDependencies.get(id) || []) visitDerived(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of derivedAttributeIds) visitDerived(id);
  validateReference(source.rules?.defaultActionId, maps.skills, "rules.defaultActionId", findings);
  validateReference(source.rules?.defaultAiPolicyId, maps.aiPolicies, "rules.defaultAiPolicyId", findings);
  validateReference(source.rules?.defaultEncounterId, maps.encounters, "rules.defaultEncounterId", findings);
  for (const [kind, cueId] of Object.entries(source.rules?.presentation?.cueIds || {})) validateReference(cueId, maps.visualCues, `rules.presentation.cueIds.${kind}`, findings);
  for (const [kind, audioCueId] of Object.entries(source.rules?.presentation?.audioCueIds || {})) validateReference(audioCueId, maps.audioCues, `rules.presentation.audioCueIds.${kind}`, findings);
  for (const [factionId, faction] of maps.factions) {
    for (const targetFactionId of list(faction.hostileTo)) validateReference(targetFactionId, maps.factions, `factions.${factionId}.hostileTo`, findings);
  }
  for (const [unitId, unit] of maps.units) {
    validateReference(unit.factionId, maps.factions, `units.${unitId}.factionId`, findings);
    for (const skillId of list(unit.skillIds)) validateReference(skillId, maps.skills, `units.${unitId}.skillIds`, findings);
    validateReference(unit.aiPolicyId || source.rules?.defaultAiPolicyId, maps.aiPolicies, `units.${unitId}.aiPolicyId`, findings);
    const policy = maps.aiPolicies.get(unit.aiPolicyId || source.rules?.defaultAiPolicyId);
    if (policy?.fallbackSkillId && !list(unit.skillIds).includes(policy.fallbackSkillId)) findings.push({ severity: "error", path: `units.${unitId}.skillIds`, message: `AI fallback skill ${policy.fallbackSkillId} is not equipped` });
  }
  for (const [skillId, skill] of maps.skills) {
    if (!COMBAT_CAPABILITIES.skillKinds.includes(skill.kind)) findings.push({ severity: "error", path: `skills.${skillId}.kind`, message: `unsupported or missing skill kind ${skill.kind || "<empty>"}` });
    if (!COMBAT_CAPABILITIES.targetSelectors.includes(skill.target)) findings.push({ severity: "error", path: `skills.${skillId}.target`, message: `unsupported or missing target selector ${skill.target || "<empty>"}` });
    if (!skill.presentationCueId) findings.push({ severity: "error", path: `skills.${skillId}.presentationCueId`, message: "skill requires a presentation cue" });
    if (!list(skill.effects).length) findings.push({ severity: "error", path: `skills.${skillId}.effects`, message: "skill requires at least one effect" });
    for (const [resource, cost] of Object.entries(skill.cost || {})) {
      if (!Number.isFinite(Number(cost)) || Number(cost) < 0) findings.push({ severity: "error", path: `skills.${skillId}.cost.${resource}`, message: "skill cost must be a non-negative number" });
    }
    if (skill.cooldown !== undefined && (!Number.isFinite(Number(skill.cooldown)) || Number(skill.cooldown) < 0)) findings.push({ severity: "error", path: `skills.${skillId}.cooldown`, message: "skill cooldown must be a non-negative number" });
    const validateEffect = (effect, path) => {
      if (!COMBAT_CAPABILITIES.effectKinds.includes(effect.kind)) findings.push({ severity: "error", path: `${path}.kind`, message: `unsupported or missing effect kind ${effect.kind || "<empty>"}` });
      if (effect.kind === "applyBuff") validateReference(effect.buffId, maps.buffs, `${path}.buffId`, findings);
      if (effect.kind === "damage") {
        if (!effect.damageType) findings.push({ severity: "error", path: `${path}.damageType`, message: "damage effect requires damageType" });
        if (!source.rules?.damageTypes?.includes(effect.damageType || "physical")) findings.push({ severity: "error", path: `${path}.damageType`, message: `damage type ${effect.damageType || "physical"} is not declared in rules.damageTypes` });
        if (!rulesDamageRule(source.rules, effect.damageType || "physical")) findings.push({ severity: "error", path: `${path}.damageType`, message: `damage type ${effect.damageType || "physical"} has no damage rule` });
      }
      if (["damage", "heal", "shield", "resource"].includes(effect.kind) && effect.power === undefined) findings.push({ severity: "error", path: `${path}.power`, message: `${effect.kind} effect requires power` });
      validateFormula(effect.power, `${path}.power`);
      for (const ref of formulaReferences(effect.power)) if (!effectFormulaIds.has(ref)) findings.push({ severity: "error", path: `${path}.power`, message: `unknown formula reference ${ref}` });
      if (effect.chance !== undefined && (!Number.isFinite(Number(effect.chance)) || Number(effect.chance) < 0 || Number(effect.chance) > 1)) findings.push({ severity: "error", path: `${path}.chance`, message: "effect chance must be between 0 and 1" });
      if (effect.kind === "removeBuff" && effect.maxCount !== undefined && integer(effect.maxCount, 0) < 1) findings.push({ severity: "error", path: `${path}.maxCount`, message: "maxCount must be >= 1" });
      if (effect.kind === "resource" && !["hp", "mp"].includes(effect.resource)) findings.push({ severity: "error", path: `${path}.resource`, message: `unsupported or missing resource ${effect.resource || "<empty>"}` });
      if (effect.kind === "statModifier" && (!formulaAttributeIds.has(effect.attribute) || !["add", "mul"].includes(effect.op) || !Number.isInteger(Number(effect.duration)) || Number(effect.duration) < 1 || (effect.power === undefined && !Number.isFinite(Number(effect.value))))) findings.push({ severity: "error", path, message: "statModifier requires a known attribute, explicit add/mul op, positive duration and numeric value or power" });
      if (effect.kind === "multiHit" && (integer(effect.hits, 0) < 1 || !list(effect.effects).length)) findings.push({ severity: "error", path, message: "multiHit requires hits >= 1 and at least one nested effect" });
      if (effect.kind === "multiHit") for (const [nestedIndex, nested] of list(effect.effects).entries()) validateEffect(nested, `${path}.effects.${nestedIndex}`);
    };
    for (const [effectIndex, effect] of list(skill.effects).entries()) validateEffect(effect, `skills.${skillId}.effects.${effectIndex}`);
    if (skill.presentationCueId) validateReference(skill.presentationCueId, maps.visualCues, `skills.${skillId}.presentationCueId`, findings);
  }
  for (const [buffId, buff] of maps.buffs) {
    const policy = buff.stackPolicy || "refresh";
    const allowedPolicies = list(source.rules?.buffRules?.stackPolicies);
    if (!["stack", "refresh", "replace", "unique"].includes(policy) || !allowedPolicies.includes(policy)) findings.push({ severity: "error", path: `buffs.${buffId}.stackPolicy`, message: `unsupported or undeclared stack policy ${policy}` });
    if (integer(buff.duration, 0) < 1) findings.push({ severity: "error", path: `buffs.${buffId}.duration`, message: "buff duration must be >= 1" });
    if (buff.maxStacks !== undefined && integer(buff.maxStacks, 0) < 1) findings.push({ severity: "error", path: `buffs.${buffId}.maxStacks`, message: "buff maxStacks must be >= 1" });
    if (integer(buff.maxStacks, 1) > integer(source.rules?.buffRules?.maxStacks, 0)) findings.push({ severity: "error", path: `buffs.${buffId}.maxStacks`, message: "buff maxStacks exceeds rules.buffRules.maxStacks" });
    if (buff.control && !COMBAT_CAPABILITIES.buffControls.includes(buff.control)) findings.push({ severity: "error", path: `buffs.${buffId}.control`, message: `unsupported control ${buff.control}` });
    if (buff.periodic?.kind && !COMBAT_CAPABILITIES.effectKinds.includes(buff.periodic.kind)) findings.push({ severity: "error", path: `buffs.${buffId}.periodic.kind`, message: `unsupported periodic effect ${buff.periodic.kind}` });
    if (buff.periodic?.trigger && !["turn_start", "turn_end"].includes(buff.periodic.trigger)) findings.push({ severity: "error", path: `buffs.${buffId}.periodic.trigger`, message: `unsupported trigger ${buff.periodic.trigger}` });
    if (policy === "stack" && buff.periodic && !["multiply", "independent"].includes(buff.periodic.stackScaling)) findings.push({ severity: "error", path: `buffs.${buffId}.periodic.stackScaling`, message: "stacked periodic buffs must declare multiply or independent scaling" });
    if (buff.periodic?.kind === "damage") {
      if (!source.rules?.damageTypes?.includes(buff.periodic.damageType || "physical")) findings.push({ severity: "error", path: `buffs.${buffId}.periodic.damageType`, message: `periodic damage type ${buff.periodic.damageType || "physical"} is not declared` });
      if (!rulesDamageRule(source.rules, buff.periodic.damageType || "physical")) findings.push({ severity: "error", path: `buffs.${buffId}.periodic.damageType`, message: `periodic damage type ${buff.periodic.damageType || "physical"} has no damage rule` });
    }
    validateFormula(buff.periodic?.power, `buffs.${buffId}.periodic.power`);
    for (const ref of formulaReferences(buff.periodic?.power)) if (!effectFormulaIds.has(ref)) findings.push({ severity: "error", path: `buffs.${buffId}.periodic.power`, message: `unknown formula reference ${ref}` });
    for (const [index, modifier] of list(buff.modifiers).entries()) if (!formulaAttributeIds.has(modifier.attribute) || !["add", "mul"].includes(modifier.op || "add") || !Number.isFinite(Number(modifier.value))) findings.push({ severity: "error", path: `buffs.${buffId}.modifiers.${index}`, message: "buff modifier requires a known attribute, add/mul op and numeric value" });
  }
  for (const [aiPolicyId, policy] of maps.aiPolicies) {
    if (!["weighted_skill", "player_queue_then_basic"].includes(policy.mode)) findings.push({ severity: "error", path: `aiPolicies.${aiPolicyId}.mode`, message: `unsupported AI mode ${policy.mode}` });
    if (!Number.isFinite(Number(policy.defaultWeight)) || Number(policy.defaultWeight) < 0) findings.push({ severity: "error", path: `aiPolicies.${aiPolicyId}.defaultWeight`, message: "AI defaultWeight must be an explicit non-negative number" });
    for (const [skillId, weight] of Object.entries(policy.weights || {})) {
      validateReference(skillId, maps.skills, `aiPolicies.${aiPolicyId}.weights.${skillId}`, findings);
      if (!Number.isFinite(Number(weight)) || Number(weight) < 0) findings.push({ severity: "error", path: `aiPolicies.${aiPolicyId}.weights.${skillId}`, message: "AI weight must be non-negative" });
    }
    validateReference(policy.fallbackSkillId, maps.skills, `aiPolicies.${aiPolicyId}.fallbackSkillId`, findings);
  }
  for (const [encounterId, encounter] of maps.encounters) {
    const roster = [...list(encounter.playerUnitIds), ...list(encounter.enemyUnitIds)];
    for (const unitId of roster) validateReference(unitId, maps.units, `encounters.${encounterId}.unitIds`, findings);
    if (new Set(roster).size !== roster.length) findings.push({ severity: "error", path: `encounters.${encounterId}.unitIds`, message: "encounter rosters must be unique and disjoint" });
    for (const rewardId of list(encounter.rewardIds)) validateReference(rewardId, maps.rewards, `encounters.${encounterId}.rewardIds`, findings);
  }
  return {
    schemaVersion: source?.schemaVersion || "",
    version: number(source?.version, 0),
    counts: Object.fromEntries(Object.entries(maps).map(([key, map]) => [key, map.size])),
    findings,
    accepted: findings.every((item) => item.severity !== "error"),
  };
}

function createUnit(unitDefinition, rules) {
  const baseAttributes = { ...(rules.attributeDefaults || {}), ...(unitDefinition.attributes || {}) };
  const context = normalizeAttributeContext(unitDefinition, baseAttributes);
  const derived = resolveDerivedAttributes(rules.attributes, context);
  const attributes = { ...baseAttributes, ...derived };
  const hpMax = Math.max(1, integer(attributes.maxHp, 1));
  const mpMax = Math.max(0, integer(attributes.maxMp, 0));
  return {
    unitId: unitDefinition.unitId,
    name: unitDefinition.displayName || unitDefinition.unitId,
    roleLabel: unitDefinition.roleLabel || "",
    factionId: unitDefinition.factionId,
    level: number(unitDefinition.level, 1),
    skillIds: list(unitDefinition.skillIds),
    aiPolicyId: unitDefinition.aiPolicyId || rules.defaultAiPolicyId,
    visual: cloneData(unitDefinition.visual || {}),
    baseAttributes,
    attributes,
    hpMax,
    hp: clamp(integer(unitDefinition.hp, hpMax), 0, hpMax),
    initialHp: clamp(integer(unitDefinition.hp, hpMax), 0, hpMax),
    mpMax,
    mp: clamp(integer(unitDefinition.mp, mpMax), 0, mpMax),
    initialMp: clamp(integer(unitDefinition.mp, mpMax), 0, mpMax),
    shield: 0,
    buffs: [],
    runtimeModifiers: [],
    cooldowns: {},
    alive: integer(unitDefinition.hp, hpMax) > 0,
    actionCount: 0,
  };
}

export function buildCombatPresentation(snapshot, options = {}) {
  const units = list(snapshot?.units);
  const leftUnitId = list(snapshot?.playerUnitIds)[0] || units.find((unit) => unit.factionId === "player")?.unitId || units[0]?.unitId;
  const left = units.find((unit) => unit.unitId === leftUnitId) || units[0] || {};
  const right = units.find((unit) => unit.unitId !== left.unitId && list(snapshot?.enemyUnitIds).includes(unit.unitId))
    || units.find((unit) => unit.unitId !== left.unitId && unit.alive !== false)
    || units.find((unit) => unit.unitId !== left.unitId)
    || units[1] || {};
  const sideFor = (unitId) => unitId === left.unitId ? "left" : "right";
  const events = list(snapshot?.events).map((event, index) => {
    const value = event.kind === "damage" ? -number(event.value, 0) : number(event.value, 0);
    const source = units.find((unit) => unit.unitId === event.sourceUnitId);
    const target = units.find((unit) => unit.unitId === event.targetUnitId);
    const cue = event.cue || {};
    return {
      seq: integer(event.seq, index),
      time: `${(number(event.timeMs, index * 720) / 1000).toFixed(2)}s`,
      kind: event.kind || event.eventType || "event",
      actor: formatName(source),
      targetSide: sideFor(event.targetUnitId),
      value,
      floatText: combatFloatText(event),
      text: event.text || eventText(event.kind, source, target, event.value, event.skill, event.buff),
      logLines: event.logLines || [event.text || eventText(event.kind, source, target, event.value, event.skill, event.buff)],
      logTones: event.logTones || [event.kind || ""],
      sourceUnitId: event.sourceUnitId || "",
      targetUnitId: event.targetUnitId || "",
      cueId: event.cueId || "",
      audioCueId: event.audioCueId || "",
      cue,
      audioCue: cloneData(event.audioCue || {}),
      buffs: cloneData(event.buffs || target?.buffs || []),
    };
  });
  const unitView = (unit) => ({
    unitId: unit.unitId,
    name: unit.name,
    roleLabel: unit.roleLabel,
    hp: number(unit.initialHp ?? unit.hpMax, unit.hpMax),
    hpMax: unit.hpMax,
    mp: number(unit.initialMp ?? unit.mpMax, unit.mpMax),
    mpMax: unit.mpMax,
    shield: 0,
    alive: true,
    buffs: [],
    final: { hp: number(unit.hp, unit.hpMax), mp: number(unit.mp, unit.mpMax), shield: number(unit.shield, 0), alive: unit.alive !== false, buffs: cloneData(unit.buffs || []) },
    attributes: cloneData(unit.effectiveAttributes || unit.attributes || {}),
    visual: unit.visual,
    emptyBuffText: "无",
  });
  const allUnits = units.map(unitView);
  return {
    previewId: options.previewId || snapshot.encounterId || "combat_runtime",
    encounterId: snapshot.encounterId || "",
    scene: { theme: options.sceneTheme || snapshot.sceneId || "", visualCueId: snapshot.sceneId || "" },
    units: {
      left: unitView(left),
      right: unitView(right),
      all: allUnits,
      players: allUnits.filter((unit) => list(snapshot?.playerUnitIds).includes(unit.unitId)),
      enemies: allUnits.filter((unit) => list(snapshot?.enemyUnitIds).includes(unit.unitId)),
    },
    events,
    result: cloneData(snapshot.result || null),
    combatOutcome: snapshot.result?.outcome || "",
  };
}

export function createCombatSession(content, options = {}) {
  const { source, maps } = normalizeContent(content);
  const validation = validateCombatContent(source);
  if (!validation.accepted) throw new Error(`Invalid combat content: ${validation.findings.map((item) => `${item.path}:${item.message}`).join(", ")}`);
  const rules = source.rules || {};
  const encounterId = options.encounterId || rules.defaultEncounterId || source.encounters[0]?.encounterId;
  const encounter = maps.encounters.get(encounterId);
  if (!encounter) throw new Error(`Unknown combat encounter ${encounterId}`);
  const restoredSnapshot = options.runtimeSnapshot && record(options.runtimeSnapshot)
    ? cloneData(options.runtimeSnapshot)
    : null;
  const random = createSeededRandom(
    options.seed ?? restoredSnapshot?.seed ?? encounter.seed ?? 1,
    restoredSnapshot?.rngState,
  );
  const units = new Map();
  const playerUnitIds = list(encounter.playerUnitIds);
  const enemyUnitIds = list(encounter.enemyUnitIds);
  for (const unitId of [...playerUnitIds, ...enemyUnitIds]) {
    const definition = maps.units.get(unitId);
    if (!definition) throw new Error(`Encounter ${encounterId} references missing unit ${unitId}`);
    units.set(unitId, createUnit(definition, rules));
  }
  const state = {
    encounterId,
    sceneId: encounter.sceneId || "",
    playerUnitIds,
    enemyUnitIds,
    status: "idle",
    paused: false,
    outcome: "",
    round: 0,
    turnIndex: 0,
    turnOrder: [],
    eventSeq: 0,
    events: [],
    eventLimitReached: false,
    result: null,
    seed: number(options.seed ?? restoredSnapshot?.seed ?? encounter.seed, 1),
    actionQueue: {},
    commandLog: [],
  };

  function currentReplayId() {
    return replayHash({
      schema: "idlewuxia.combat_replay.v1",
      encounterId: state.encounterId,
      seed: state.seed,
      commands: state.commandLog,
    });
  }

  function recordCommand(command) {
    const maxCommands = Math.max(1, integer(rules.replay?.maxCommands, 256));
    if (state.commandLog.length >= maxCommands) throw new Error("combat replay command limit reached");
    state.commandLog.push({
      seq: state.commandLog.length,
      ...cloneData(command),
    });
  }

  function canRecordCommand() {
    return state.commandLog.length < Math.max(1, integer(rules.replay?.maxCommands, 256));
  }

  function alive(unit) { return Boolean(unit && unit.alive && unit.hp > 0); }

  function effectiveAttributes(unit) {
    const modifiers = {};
    for (const active of unit.buffs) {
      const definition = maps.buffs.get(active.buffId);
      for (const modifier of list(definition?.modifiers)) {
        const current = modifiers[modifier.attribute] || { add: 0, mul: 1 };
        if (modifier.op === "mul") current.mul *= number(modifier.value, 1) ** Math.max(1, active.stacks || 1);
        else current.add += number(modifier.value, 0) * Math.max(1, active.stacks || 1);
        modifiers[modifier.attribute] = current;
      }
    }
    for (const modifier of list(unit.runtimeModifiers)) {
      const current = modifiers[modifier.attribute] || { add: 0, mul: 1 };
      if (modifier.op === "mul") current.mul *= number(modifier.value, 1);
      else current.add += number(modifier.value, 0);
      modifiers[modifier.attribute] = current;
    }
    const applyModifier = (attributeId, value) => {
      const modifier = modifiers[attributeId];
      return modifier ? (number(value, 0) + modifier.add) * modifier.mul : number(value, 0);
    };
    const base = { ...unit.baseAttributes };
    for (const attributeId of Object.keys(base)) base[attributeId] = applyModifier(attributeId, base[attributeId]);
    const context = normalizeAttributeContext(unit, base);
    const derived = resolveDerivedAttributes(rules.attributes, context);
    for (const attributeId of Object.keys(derived)) derived[attributeId] = applyModifier(attributeId, derived[attributeId]);
    const combined = { ...base, ...derived };
    combined.maxHp = Math.max(1, number(combined.maxHp, unit.hpMax));
    combined.maxMp = Math.max(0, number(combined.maxMp, unit.mpMax));
    combined.attackPower = Math.max(0, number(combined.attackPower, unit.attributes.strength));
    combined.defensePower = Math.max(0, number(combined.defensePower, unit.attributes.constitution));
    combined.initiative = Math.max(0, number(combined.initiative, unit.attributes.speed));
    return combined;
  }

  function emit(event) {
    const seq = state.eventSeq;
    const defaultTimeMs = seq * Math.max(1, number(rules.presentation?.turnDurationMs, 720));
    const normalized = {
      TimeSeconds: number(event.timeMs, defaultTimeMs) / 1000,
      EventType: event.eventType || event.kind || "event",
      AudioCueId: audioCueFor(event.kind || event.eventType || "", event.audioCueId || ""),
      sourceUnitId: event.sourceUnitId || "",
      targetUnitId: event.targetUnitId || "",
      SkillId: event.skillId || "",
      BuffId: event.buffId || "",
      CueId: event.cueId || "",
      Value: number(event.value, 0),
      RawValue: number(event.rawValue ?? event.value, 0),
      VisualValue: number(event.visualValue ?? event.value, 0),
      Stack: integer(event.stack, 0),
      Duration: integer(event.duration, 0),
      EvidenceLevel: event.evidenceLevel || "config_confirmed",
      WarningCode: event.warningCode || "",
      ...event,
      cue: cloneData(event.cue || maps.visualCues.get(event.cueId || "") || {}),
      audioCue: cloneData(event.audioCue || maps.audioCues.get(event.audioCueId || audioCueFor(event.kind || event.eventType || "", "")) || {}),
      audioCueId: audioCueFor(event.kind || event.eventType || "", event.audioCueId || ""),
      seq,
      timeMs: number(event.timeMs, defaultTimeMs),
    };
    state.eventSeq += 1;
    state.events.push(normalized);
    const maxEvents = Math.max(32, integer(rules.maxEvents, 512));
    if (state.events.length > maxEvents) {
      state.eventLimitReached = true;
      state.events.splice(0, state.events.length - maxEvents);
    }
    return normalized;
  }

  function orderedEffects(effects) {
    const order = list(rules.effectOrder);
    if (!order.length) return list(effects);
    return list(effects).map((effect, index) => ({ effect, index, rank: order.indexOf(effect.kind) })).sort((left, right) => {
      const leftRank = left.rank < 0 ? order.length : left.rank;
      const rightRank = right.rank < 0 ? order.length : right.rank;
      return leftRank - rightRank || left.index - right.index;
    }).map(({ effect }) => effect);
  }

  function side(unitId) { return playerUnitIds.includes(unitId) ? "player" : "enemy"; }
  function isHostile(source, target) { return hostile(maps.factions, source?.factionId, target?.factionId); }
  function activeTauntersFor(source) {
    return [...units.values()].filter((unit) => alive(unit) && isHostile(source, unit) && unit.buffs.some((active) => maps.buffs.get(active.buffId)?.control === "taunt"));
  }
  function audioCueFor(kind, explicit = "") {
    if (explicit && maps.audioCues.has(explicit)) return explicit;
    const configured = rules.presentation?.audioCueIds?.[kind] || "";
    return configured && maps.audioCues.has(configured) ? configured : "";
  }

  function visualCueFor(kind, explicit = "") {
    if (explicit && maps.visualCues.has(explicit)) return explicit;
    const configured = rules.presentation?.cueIds?.[kind] || rules.presentation?.cueIds?.default || "";
    return configured && maps.visualCues.has(configured) ? configured : "";
  }

  function presentationOffset(kind) {
    return Math.max(0, integer(rules.presentation?.eventOffsetsMs?.[kind], 0));
  }

  function damageRuleFor(damageType) {
    return rules.damage?.rules?.[damageType] || rules.damage?.defaultRule || {
      defenseAttribute: "defensePower",
      defenseConstant: 100,
      usesResistance: true,
      resistanceKey: `${damageType}Resistance`,
      canCrit: true,
      canBlock: true,
      canGlance: true,
    };
  }

  function unitContext(unit, attributes = effectiveAttributes(unit)) {
    return normalizeAttributeContext(unit, attributes);
  }

  function targetMatchesSkill(source, target, skill) {
    if (!alive(target) || !skill) return false;
    const selector = skill.target || "single_enemy";
    if (["self"].includes(selector)) return target.unitId === source.unitId;
    if (["single_ally", "lowest_hp_ally", "all_allies"].includes(selector)) return target.factionId === source.factionId;
    if (["single_enemy", "random_enemy", "all_enemies"].includes(selector)) return isHostile(source, target);
    return isHostile(source, target);
  }

  function skillBelongsToUnit(unit, skillId) {
    return Boolean(unit && skillId && list(unit.skillIds).includes(skillId));
  }

  function validateRequestedTargets(source, skill, targetIds, options = {}) {
    const requestedIds = list(targetIds).filter((id) => typeof id === "string" && id.length > 0);
    const selector = skill?.target || "single_enemy";
    const playerSelected = ["single_enemy", "single_ally"].includes(selector);
    if (!requestedIds.length) {
      if (options.requirePlayerSelection && playerSelected) return { accepted: false, reason: "target_required" };
      return { accepted: true, targets: [] };
    }
    if (!playerSelected) return { accepted: false, reason: "runtime_target_override_forbidden" };
    if (new Set(requestedIds).size !== requestedIds.length) return { accepted: false, reason: "duplicate_target" };
    if (requestedIds.length !== 1) return { accepted: false, reason: "target_count_mismatch" };
    const targets = requestedIds.map((id) => units.get(id));
    if (targets.some((target) => !target || !targetMatchesSkill(source, target, skill))) return { accepted: false, reason: "invalid_target" };
    if (selector === "single_enemy") {
      const taunters = activeTauntersFor(source);
      if (taunters.length && !taunters.some((target) => requestedIds.includes(target.unitId))) return { accepted: false, reason: "taunt_target_required" };
    }
    return { accepted: true, targets };
  }

  function targetsFor(source, selector) {
    const all = [...units.values()].filter(alive);
    const allies = all.filter((unit) => unit.factionId === source.factionId);
    const enemies = all.filter((unit) => isHostile(source, unit));
    if (selector === "self") return [source];
    if (selector === "all_enemies") return enemies;
    if (selector === "all_allies") return allies;
    if (selector === "lowest_hp_ally") return [allies.sort((a, b) => (a.hp / a.hpMax) - (b.hp / b.hpMax))[0] || source];
    if (selector === "random_enemy") {
      const candidates = activeTauntersFor(source);
      const pool = candidates.length ? candidates : enemies;
      return pool.length ? [pool[Math.floor(random.next() * pool.length)]] : [];
    }
    if (selector === "single_ally") return [allies.sort((a, b) => a.hp - b.hp)[0] || source];
    const taunter = activeTauntersFor(source)[0];
    return [taunter || enemies.sort((a, b) => a.hp - b.hp)[0]].filter(Boolean);
  }

  function targetCandidatesFor(source, selector) {
    const all = [...units.values()].filter(alive);
    const allies = all.filter((unit) => unit.factionId === source?.factionId);
    const enemies = all.filter((unit) => isHostile(source, unit));
    switch (selector) {
      case "self": return source ? [source] : [];
      case "single_ally":
      case "lowest_hp_ally":
      case "all_allies": return allies;
      case "single_enemy": {
        const taunters = activeTauntersFor(source);
        return taunters.length ? taunters : enemies;
      }
      case "random_enemy": {
        const taunters = activeTauntersFor(source);
        return taunters.length ? taunters : enemies;
      }
      case "all_enemies": return enemies;
      default: return enemies;
    }
  }

  function applyBuff(source, target, buffId, chance = 1, timeMs = 0) {
    const definition = maps.buffs.get(buffId);
    if (!definition) return { accepted: false, reason: `missing buff ${buffId}` };
    const targetAttrs = effectiveAttributes(target);
    const harmful = definition.tags?.includes("negative") || (definition.tags?.includes("control") && !definition.tags?.includes("positive"));
    const controlResistance = harmful && definition.tags?.includes("control") ? clamp(1 - number(targetAttrs.tenacity, 0), 0, 1) : 1;
    if (random.next() > clamp(number(chance, 1) * controlResistance, 0, 1)) {
      emit({ eventType: "buffResisted", kind: "buffResisted", sourceUnitId: source.unitId, targetUnitId: target.unitId, buffId, value: 0, text: `${formatName(target)}抵抗了${definition.name || buffId}`, timeMs });
      return { accepted: false, reason: "chance_failed" };
    }
    const blockedByImmunity = harmful && target.buffs.some((activeBuff) => {
      const activeDefinition = maps.buffs.get(activeBuff.buffId);
      return list(activeDefinition?.immunityTags).some((tag) => definition.tags?.includes(tag) || definition.control === tag);
    });
    if (blockedByImmunity) {
      emit({ eventType: "buffImmune", kind: "buffImmune", sourceUnitId: source.unitId, targetUnitId: target.unitId, buffId, value: 0, warningCode: "immune", text: `${formatName(target)}免疫${definition.name || buffId}`, timeMs });
      return { accepted: false, reason: "immune" };
    }
    const active = target.buffs.find((item) => item.buffId === buffId);
    const policy = definition.stackPolicy || "refresh";
    if (active) {
      if (policy === "unique") {
        emit({ eventType: "buffRejected", kind: "buffRejected", sourceUnitId: source.unitId, targetUnitId: target.unitId, buffId, value: 0, warningCode: "unique_active", text: `${formatName(target)}已有${definition.name || buffId}`, timeMs });
        return { accepted: false, reason: "unique_active" };
      }
      if (policy === "stack") active.stacks = Math.min(integer(definition.maxStacks, 1), active.stacks + 1);
      if (policy === "replace") active.stacks = 1;
      active.duration = integer(definition.duration, active.duration);
      active.sourceUnitId = source.unitId;
      active.skipDecrementActionCount = source.unitId === target.unitId && target._activeSkillId ? target.actionCount + 1 : null;
    } else {
      target.buffs.push({ buffId, name: definition.name || buffId, iconLabel: definition.iconLabel || buffId, stacks: 1, duration: integer(definition.duration, 1), tags: list(definition.tags), sourceUnitId: source.unitId, skipDecrementActionCount: source.unitId === target.unitId && target._activeSkillId ? target.actionCount + 1 : null });
    }
    const current = target.buffs.find((item) => item.buffId === buffId);
    emit({ eventType: current?.tags?.includes("negative") ? "debuffApplied" : "buffApplied", kind: current?.tags?.includes("negative") ? "debuff" : "buff", sourceUnitId: source.unitId, targetUnitId: target.unitId, buffId, stack: current?.stacks || 1, duration: current?.duration || 0, cueId: maps.skills.get(source._activeSkillId)?.presentationCueId || "", buff: cloneData(definition), buffs: cloneData(target.buffs), text: eventText(current?.tags?.includes("negative") ? "debuff" : "buff", source, target, 0, null, definition), timeMs });
    return { accepted: true };
  }

  function removeBuff(target, options = {}, timeMs = 0) {
    const before = target.buffs.length;
    let removed = 0;
    const maxCount = options.maxCount === undefined ? Number.POSITIVE_INFINITY : Math.max(1, integer(options.maxCount, 1));
    target.buffs = target.buffs.filter((active) => {
      const definition = maps.buffs.get(active.buffId);
      const matchesId = options.buffId ? active.buffId === options.buffId : true;
      const matchesTag = options.tags?.length ? options.tags.some((tag) => definition?.tags?.includes(tag)) : true;
      if (matchesId && matchesTag && removed < maxCount) { removed += 1; return false; }
      return true;
    });
    removed = before - target.buffs.length;
    if (removed) emit({ eventType: "buffRemoved", kind: "buffRemoved", targetUnitId: target.unitId, value: removed, buffs: cloneData(target.buffs), text: `${formatName(target)}的负面状态被清除`, timeMs });
    return removed;
  }

  function applyDamage(source, target, rawValue, damageType, skill, options = {}, timeMs = 0) {
    if (!alive(target)) return { value: 0, outcome: "dead" };
    const sourceAttrs = effectiveAttributes(source);
    const targetAttrs = effectiveAttributes(target);
    const damageRule = damageRuleFor(damageType);
    const accuracy = clamp(number(sourceAttrs.accuracy, 1), 0, 1);
    const evasion = clamp(number(targetAttrs.evasionChance, 0), 0, 0.8);
    if (random.next() > clamp(accuracy - evasion, 0.05, 1)) {
      emit({ eventType: "miss", kind: "miss", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId: visualCueFor("miss"), value: 0, text: eventText("miss", source, target, 0, skill), timeMs });
      return { value: 0, outcome: "miss" };
    }
    const isCritical = damageRule.canCrit !== false && random.next() < clamp(number(sourceAttrs.critChance, 0), 0, 1);
    const blocked = damageRule.canBlock !== false && random.next() < clamp(number(targetAttrs.blockChance, 0), 0, 0.8);
    const resistanceKey = damageRule.resistanceKey || `${damageType}Resistance`;
    const resistance = damageRule.usesResistance === false
      ? 0
      : clamp(number(targetAttrs[resistanceKey], 0) - number(sourceAttrs.penetration, 0), number(rules.damage?.resistanceFloor, -0.75), number(rules.damage?.resistanceCeiling, 0.9));
    const defense = Math.max(0, number(targetAttrs[damageRule.defenseAttribute], 0) - number(sourceAttrs.defensePenetration, 0));
    const defenseConstant = Math.max(1, number(damageRule.defenseConstant, 100));
    const defenseMultiplier = damageRule.defenseAttribute
      ? defenseConstant / (defenseConstant + defense)
      : 1;
    const criticalMultiplier = isCritical ? number(rules.damage?.criticalMultiplier, 1.5) : 1;
    const blockMultiplier = blocked ? clamp(number(rules.damage?.blockMultiplier, 0.55) * (1 - number(targetAttrs.blockPower, 0)), 0.1, 1) : 1;
    const takenMultiplier = number(targetAttrs.damageTakenMultiplier, 1);
    const glancing = (options.canGlance ?? damageRule.canGlance !== false) && random.next() < clamp(number(rules.damage?.glanceChance, 0.15), 0, 1);
    const glancingMultiplier = glancing ? clamp(number(rules.damage?.glancingMultiplier, 0.75), 0.05, 1) : 1;
    const beforeBlock = Math.max(number(rules.damage?.minimumDamage, 1), number(rawValue, 0) * criticalMultiplier * glancingMultiplier * defenseMultiplier * (1 - resistance) * takenMultiplier);
    const blockedAmount = blocked ? Math.max(0, Math.round(beforeBlock - (beforeBlock * blockMultiplier))) : 0;
    const mitigated = Math.max(number(rules.damage?.minimumDamage, 1), beforeBlock * blockMultiplier);
    let remaining = Math.max(0, Math.round(mitigated));
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
    target.hp = clamp(target.hp - remaining, 0, target.hpMax);
    if (target.hp <= 0) { target.hp = 0; target.alive = false; }
    const cueId = visualCueFor(remaining > 0 ? "damage" : "shield", skill?.presentationCueId || "");
    const event = emit({ eventType: "damage", kind: "damage", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId, value: remaining, rawValue: number(rawValue, 0), visualValue: remaining, critical: isCritical, blocked, blockedAmount, glancing, absorbed, damageType, resistance, defenseMultiplier, skill: cloneData(skill || {}), text: eventText("damage", source, target, remaining, skill), timeMs, impact: maps.visualCues.get(cueId)?.impact || "hit_spark" });
    if (blocked) emit({ eventType: "block", kind: "block", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId, value: blockedAmount, text: eventText("block", source, target, blockedAmount, skill), timeMs: timeMs + presentationOffset("block") });
    if (!target.alive) emit({ eventType: "defeat", kind: "defeat", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId: visualCueFor("defeat"), value: 0, text: `${formatName(target)}倒下了`, timeMs: timeMs + presentationOffset("defeat") });
    const lifesteal = clamp(number(sourceAttrs.lifesteal, 0), 0, 1);
    if (remaining > 0 && lifesteal > 0) applyHeal(source, source, remaining * lifesteal, skill, timeMs + presentationOffset("lifesteal"));
    const reflectDefinition = list(target.buffs).map((active) => maps.buffs.get(active.buffId)).find((definition) => definition?.reflect?.percent);
    if (remaining > 0 && reflectDefinition && !options.isReflect && alive(source)) {
      const reflectedValue = remaining * clamp(number(reflectDefinition.reflect.percent, 0), 0, 1);
      if (reflectedValue > 0) applyDamage(target, source, reflectedValue, reflectDefinition.reflect.damageType || "internal", skill, { isReflect: true }, timeMs + presentationOffset("reflect"));
    }
    return { value: remaining, outcome: target.alive ? "hit" : "defeat", event };
  }

  function applyHeal(source, target, rawValue, skill, timeMs = 0) {
    if (!alive(target)) return { value: 0, outcome: "dead" };
    const value = Math.max(0, Math.min(target.hpMax - target.hp, Math.round(number(rawValue, 0))));
    target.hp += value;
    emit({ eventType: "heal", kind: "heal", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId: visualCueFor("heal", skill?.presentationCueId || ""), value, rawValue: number(rawValue, 0), visualValue: value, skill: cloneData(skill || {}), text: eventText("heal", source, target, value, skill), timeMs });
    return { value, outcome: "heal" };
  }

  function applyShield(source, target, rawValue, skill, timeMs = 0) {
    const value = Math.max(0, Math.round(number(rawValue, 0)));
    target.shield += value;
    emit({ eventType: "shield", kind: "shield", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId: visualCueFor("shield", skill?.presentationCueId || ""), value, rawValue: value, visualValue: value, skill: cloneData(skill || {}), text: eventText("shield", source, target, value, skill), timeMs });
    return { value, outcome: "shield" };
  }

  function executeEffect(source, target, effect, skill, timeMs = 0, runtime = {}) {
    if (!alive(target)) return { accepted: false, value: 0, outcome: "dead" };
    const context = {
      ...unitContext(source),
      targetHp: number(target?.hp, 0),
      targetHpMax: number(target?.hpMax, 0),
      targetMp: number(target?.mp, 0),
      targetMpMax: number(target?.mpMax, 0),
      targetShield: number(target?.shield, 0),
    };
    const power = resolveFormula(effect.power || { const: 0 }, context) * Math.max(0, number(runtime.powerMultiplier, 1));
    if (effect.kind === "damage") return applyDamage(source, target, power, effect.damageType || "physical", skill, effect, timeMs);
    if (effect.kind === "heal") return applyHeal(source, target, power, skill, timeMs);
    if (effect.kind === "shield") return applyShield(source, target, power, skill, timeMs);
    if (effect.kind === "applyBuff") return applyBuff(source, target, effect.buffId, effect.chance, timeMs);
    if (effect.kind === "removeBuff") return { value: removeBuff(target, { buffId: effect.buffId, tags: effect.tags, maxCount: effect.maxCount }, timeMs), outcome: "cleanse" };
    if (effect.kind === "resource") {
      const resource = effect.resource || "mp";
      const maxKey = `${resource}Max`;
      const before = number(target[resource], 0);
      const targetAttrs = effectiveAttributes(target);
      target[resource] = clamp(before + power, 0, number(targetAttrs[maxKey] ?? target[maxKey], before));
      if (resource === "hp") target.alive = target[resource] > 0;
      emit({ eventType: "resource", kind: "resource", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId: skill?.presentationCueId || "", value: target[resource] - before, resource, text: `${formatName(target)}的${resource}变化${target[resource] - before}`, timeMs });
      return { value: target[resource] - before, outcome: "resource" };
    }
    if (effect.kind === "statModifier") {
      if (!effect.attribute) return { accepted: false, reason: "missing_stat_attribute" };
      const value = power || number(effect.value, 0);
      const duration = Math.max(1, integer(effect.duration, 1));
      target.runtimeModifiers.push({ attribute: effect.attribute, op: effect.op || "add", value, duration, skipDecrementActionCount: source.unitId === target.unitId && target._activeSkillId ? target.actionCount + 1 : null });
      emit({ eventType: "statModifier", kind: "statModifier", sourceUnitId: source.unitId, targetUnitId: target.unitId, skillId: skill?.skillId, cueId: skill?.presentationCueId || "", value, duration, text: `${formatName(target)}属性变化`, timeMs });
      return { value, outcome: "stat_modifier" };
    }
    if (effect.kind === "multiHit") {
      const results = [];
      const interval = Math.max(1, integer(rules.presentation?.impactMs, 120));
      for (let index = 0; index < Math.max(1, integer(effect.hits, 1)); index++) for (const nested of orderedEffects(effect.effects)) results.push(executeEffect(source, target, nested, skill, timeMs + index * interval));
      return { value: results.reduce((sum, result) => sum + number(result?.value, 0), 0), outcome: "multi_hit", results };
    }
    return { accepted: false, reason: `unsupported effect kind ${effect.kind}` };
  }

  function canUseSkill(unit, skill) {
    if (!skill || !unit || !alive(unit)) return { accepted: false, reason: "invalid_actor_or_skill" };
    const cooldown = integer(unit.cooldowns[skill.skillId], 0);
    if (cooldown > 0) return { accepted: false, reason: `cooldown:${cooldown}` };
    if (unit.buffs.some((active) => maps.buffs.get(active.buffId)?.control === "silence") && skill.skillId !== rules.defaultActionId) return { accepted: false, reason: "silenced" };
    for (const [resource, cost] of Object.entries(skill.cost || {})) if (number(unit[resource], 0) < number(cost, 0)) return { accepted: false, reason: `insufficient_${resource}` };
    return { accepted: true };
  }

  function resolveSkill(source, skillId, targetIds = [], timeMs = 0) {
    const skill = maps.skills.get(skillId);
    const availability = canUseSkill(source, skill);
    if (availability.accepted && !skillBelongsToUnit(source, skillId)) {
      availability.accepted = false;
      availability.reason = "skill_not_equipped";
    }
    if (!availability.accepted) {
      emit({ eventType: "actionRejected", kind: "actionRejected", sourceUnitId: source.unitId, SkillId: skillId, skillId, value: 0, warningCode: availability.reason, text: `${formatName(source)}无法使用${skill?.name || skillId}：${availability.reason}`, timeMs });
      return availability;
    }
    source._activeSkillId = skill.skillId;
    const requested = validateRequestedTargets(source, skill, targetIds);
    if (!requested.accepted) {
      delete source._activeSkillId;
      emit({ eventType: "actionRejected", kind: "actionRejected", sourceUnitId: source.unitId, skillId, value: 0, warningCode: requested.reason, text: `${formatName(source)}无法对指定目标使用${skill.name || skillId}：${requested.reason}`, timeMs });
      return { accepted: false, reason: requested.reason };
    }
    const targets = requested.targets.length ? requested.targets : targetsFor(source, skill.target);
    if (!targets.length) {
      delete source._activeSkillId;
      emit({ eventType: "actionRejected", kind: "actionRejected", sourceUnitId: source.unitId, skillId, value: 0, warningCode: "no_valid_target", text: `${formatName(source)}无法使用${skill.name || skillId}：no_valid_target`, timeMs });
      return { accepted: false, reason: "no_valid_target" };
    }
    // Target resolution is intentionally completed before charging resources or starting cooldowns.
    // A rejected action must not mutate the combat state.
    for (const [resource, cost] of Object.entries(skill.cost || {})) source[resource] = Math.max(0, number(source[resource], 0) - number(cost, 0));
    // Cooldown is authored as the number of future owner turns for which the
    // skill remains unavailable. The current turn-end decrement therefore
    // starts from N + 1 and exposes N in the post-action snapshot.
    if (skill.cooldown) source.cooldowns[skill.skillId] = integer(skill.cooldown, 0) + 1;
    emit({ eventType: "skillStarted", kind: "skill", sourceUnitId: source.unitId, skillId: skill.skillId, cueId: skill.presentationCueId || "", skill: cloneData(skill), text: `${formatName(source)}使出${skill.name || skill.skillId}`, timeMs });
    const results = [];
    const anticipationMs = Math.max(0, integer(rules.presentation?.anticipationMs, 180));
    const impactMs = Math.max(0, integer(rules.presentation?.impactMs, 120));
    for (const target of targets) for (const effect of orderedEffects(skill.effects)) results.push(executeEffect(source, target, effect, skill, timeMs + anticipationMs));
    emit({ eventType: "skillResolved", kind: "skillResolved", sourceUnitId: source.unitId, skillId: skill.skillId, cueId: skill.presentationCueId || "", value: results.reduce((sum, result) => sum + number(result?.value, 0), 0), skill: cloneData(skill), text: `${skill.name || skill.skillId}完成`, timeMs: timeMs + anticipationMs + impactMs });
    source.actionCount += 1;
    delete source._activeSkillId;
    return { accepted: true, skillId, results };
  }

  function chooseAiAction(unit) {
    const policy = maps.aiPolicies.get(unit.aiPolicyId) || maps.aiPolicies.get(rules.defaultAiPolicyId);
    const queued = state.actionQueue?.[unit.unitId]?.shift?.();
    if (queued?.skillId) return queued;
    const available = unit.skillIds.map((skillId) => maps.skills.get(skillId)).filter((skill) => canUseSkill(unit, skill).accepted);
    if (!available.length) return { skillId: policy?.fallbackSkillId || rules.defaultActionId };
    if (policy?.mode === "player_queue_then_basic") return { skillId: available.find((skill) => skill.skillId === (policy.fallbackSkillId || rules.defaultActionId))?.skillId || available[0].skillId };
    const weighted = available.map((skill) => ({
      skill,
      weight: Math.max(0, number(policy?.weights?.[skill.skillId], number(policy?.defaultWeight, 0))),
    })).filter((entry) => entry.weight > 0);
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return { skillId: available.find((skill) => skill.skillId === (policy?.fallbackSkillId || rules.defaultActionId))?.skillId || available[0].skillId };
    let roll = random.next() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll < 0) return { skillId: entry.skill.skillId };
    }
    return { skillId: weighted[weighted.length - 1].skill.skillId };
  }

  function rebuildTurnOrder() {
    const ordered = [...units.values()].filter(alive).map((unit) => ({
      unit,
      initiative: number(effectiveAttributes(unit).initiative, 0),
    })).sort((left, right) => {
      const speedDiff = right.initiative - left.initiative;
      return Math.abs(speedDiff) > EPSILON ? speedDiff : left.unit.unitId.localeCompare(right.unit.unitId);
    });
    for (let start = 0; start < ordered.length;) {
      let end = start + 1;
      while (end < ordered.length && Math.abs(ordered[end].initiative - ordered[start].initiative) <= EPSILON) end += 1;
      if (end - start > 1) {
        const tied = ordered.slice(start, end).map((entry) => ({ ...entry, seededTieBreak: random.next() }));
        tied.sort((left, right) => left.seededTieBreak - right.seededTieBreak || left.unit.unitId.localeCompare(right.unit.unitId));
        ordered.splice(start, tied.length, ...tied);
      }
      start = end;
    }
    state.turnOrder = ordered.map((entry) => entry.unit.unitId);
    state.turnIndex = 0;
  }

  function prepareNextRoundIfNeeded() {
    if (state.turnOrder.length && state.turnIndex < state.turnOrder.length) return false;
    state.round += 1;
    if (state.round > integer(rules.maxRounds, 40)) {
      finish("draw", "max_rounds");
      return true;
    }
    rebuildTurnOrder();
    return true;
  }

  function tickBuffs(unit, trigger, timeMs) {
    for (const active of [...unit.buffs]) {
      const definition = maps.buffs.get(active.buffId);
      const periodic = definition?.periodic;
      if (periodic?.trigger === trigger) {
        const source = units.get(active.sourceUnitId) || unit;
        const stackMultiplier = periodic.stackScaling === "multiply" ? Math.max(1, integer(active.stacks, 1)) : 1;
        executeEffect(source, unit, periodic, null, timeMs, { powerMultiplier: stackMultiplier });
        emit({ eventType: "periodic", kind: "periodic", sourceUnitId: source.unitId, targetUnitId: unit.unitId, buffId: active.buffId, buff: cloneData(definition || {}), value: 0, text: `${formatName(unit)}的${definition?.name || active.buffId}生效`, timeMs: timeMs + presentationOffset("periodicSummary") });
      }
      if (trigger === "turn_end" && active.skipDecrementActionCount !== unit.actionCount) active.duration -= 1;
      if (trigger === "turn_end" && active.skipDecrementActionCount === unit.actionCount) active.skipDecrementActionCount = null;
    }
    const expired = unit.buffs.filter((active) => active.duration <= 0);
    for (const active of expired) emit({ eventType: "buffExpired", kind: "buffExpired", targetUnitId: unit.unitId, buffId: active.buffId, value: 0, text: `${formatName(unit)}的${maps.buffs.get(active.buffId)?.name || active.buffId}消退`, timeMs });
    unit.buffs = unit.buffs.filter((active) => active.duration > 0);
    unit.runtimeModifiers = list(unit.runtimeModifiers).map((modifier) => {
      const skip = trigger === "turn_end" && modifier.skipDecrementActionCount === unit.actionCount;
      return { ...modifier, skipDecrementActionCount: skip ? null : modifier.skipDecrementActionCount, duration: integer(modifier.duration, 1) - (trigger === "turn_end" && !skip ? 1 : 0) };
    }).filter((modifier) => modifier.duration > 0);
  }

  function checkOutcome() {
    const playersAlive = playerUnitIds.some((id) => alive(units.get(id)));
    const enemiesAlive = enemyUnitIds.some((id) => alive(units.get(id)));
    if (!enemiesAlive && encounter.rules?.victoryOnAllEnemiesDefeated !== false) return "victory";
    if (!playersAlive) return "defeat";
    return "";
  }

  function finish(outcome, reason = "") {
    state.status = "finished";
    state.outcome = outcome;
    const combatStats = {
      damage: state.events.filter((event) => event.kind === "damage").reduce((sum, event) => sum + number(event.value, 0), 0),
      healing: state.events.filter((event) => event.kind === "heal").reduce((sum, event) => sum + number(event.value, 0), 0),
      shields: state.events.filter((event) => event.kind === "shield").reduce((sum, event) => sum + number(event.value, 0), 0),
      resources: state.events.filter((event) => event.kind === "resource").reduce((sum, event) => sum + number(event.value, 0), 0),
      criticalHits: state.events.filter((event) => event.kind === "damage" && event.critical).length,
      misses: state.events.filter((event) => event.kind === "miss").length,
      blocks: state.events.filter((event) => event.kind === "block").length,
      buffsApplied: state.events.filter((event) => ["buff", "debuff"].includes(event.kind)).length,
      buffsRemoved: state.events.filter((event) => ["buffRemoved", "buffExpired"].includes(event.kind)).length,
    };
    state.result = {
      outcome,
      reason,
      round: state.round,
      eventCount: state.events.length,
      seed: state.seed,
      playerUnitIds,
      enemyUnitIds,
      rewardIds: cloneData(encounter.rewardIds || []),
      combatStats,
      finalUnits: [...units.values()].map((unit) => ({ unitId: unit.unitId, hp: unit.hp, hpMax: unit.hpMax, mp: unit.mp, mpMax: unit.mpMax, shield: unit.shield, alive: unit.alive, buffs: cloneData(unit.buffs) })),
    };
    emit({ eventType: outcome, kind: outcome, value: 0, text: outcome === "victory" ? "战斗胜利" : outcome === "defeat" ? "战斗失败" : "战斗结束", timeMs: state.eventSeq * Math.max(1, integer(rules.presentation?.turnDurationMs, 720)) });
    // The terminal outcome is part of the replay/event contract. Update the
    // count after emitting it so result.eventCount always matches snapshot.events.
    state.result.eventCount = state.events.length;
  }

  function start() {
    if (state.status !== "idle") return snapshot();
    state.status = "active";
    state.paused = false;
    state.round = 1;
    rebuildTurnOrder();
    emit({ eventType: "combatStarted", kind: "combatStarted", value: 0, text: encounter.name || "战斗开始", timeMs: 0 });
    return snapshot();
  }

  function pause() {
    if (state.status !== "active") return { accepted: false, reason: "combat_not_active", snapshot: snapshot() };
    if (rules.replay?.allowPause !== true) return { accepted: false, reason: "pause_disabled", snapshot: snapshot() };
    if (state.paused) return { accepted: false, reason: "combat_already_paused", snapshot: snapshot() };
    if (!canRecordCommand()) return { accepted: false, reason: "combat_replay_command_limit", snapshot: snapshot() };
    state.paused = true;
    const event = emit({ eventType: "combatPaused", kind: "combatPaused", value: 0, text: "战斗已暂停" });
    recordCommand({ kind: "pause", eventSeq: event.seq });
    return { accepted: true, event, snapshot: snapshot() };
  }

  function resume() {
    if (state.status !== "active") return { accepted: false, reason: "combat_not_active", snapshot: snapshot() };
    if (!state.paused) return { accepted: false, reason: "combat_not_paused", snapshot: snapshot() };
    if (!canRecordCommand()) return { accepted: false, reason: "combat_replay_command_limit", snapshot: snapshot() };
    state.paused = false;
    const event = emit({ eventType: "combatResumed", kind: "combatResumed", value: 0, text: "战斗继续" });
    recordCommand({ kind: "resume", eventSeq: event.seq });
    return { accepted: true, event, snapshot: snapshot() };
  }

  function step(actionOverride = null) {
    if (state.status === "idle") start();
    if (state.paused) return { accepted: false, reason: "combat_paused", snapshot: snapshot() };
    if (state.status !== "active") return { accepted: false, reason: "combat_not_active", snapshot: snapshot() };
    const preOutcome = checkOutcome();
    if (preOutcome) { finish(preOutcome, "pre_turn_check"); return { accepted: true, outcome: preOutcome, snapshot: snapshot() }; }
    if (!state.turnOrder.length || state.turnIndex >= state.turnOrder.length) {
      prepareNextRoundIfNeeded();
      if (state.status !== "active") return { accepted: true, outcome: state.outcome || "draw", snapshot: snapshot() };
    }
    const actor = units.get(state.turnOrder[state.turnIndex++]);
    if (!actor || !alive(actor)) return step(actionOverride);
    const turnDurationMs = Math.max(1, integer(rules.presentation?.turnDurationMs, 720));
    const settleMs = Math.max(0, integer(rules.presentation?.settleMs, 240));
    const timeMs = state.eventSeq * turnDurationMs;
    tickBuffs(actor, "turn_start", timeMs);
    const stunned = actor.buffs.some((buff) => maps.buffs.get(buff.buffId)?.control === "stun");
    let actionResult;
    if (stunned) {
      emit({ eventType: "stunned", kind: "stunned", targetUnitId: actor.unitId, value: 0, text: `${formatName(actor)}被点穴，无法行动`, timeMs });
      actionResult = { accepted: true, skipped: true, reason: "stunned" };
    } else {
      const queued = list(state.actionQueue?.[actor.unitId]).shift() || null;
      if (state.actionQueue?.[actor.unitId]?.length === 0) delete state.actionQueue[actor.unitId];
      const action = actionOverride || queued || chooseAiAction(actor);
      const policy = maps.aiPolicies.get(actor.aiPolicyId) || maps.aiPolicies.get(rules.defaultAiPolicyId);
      const fallbackSkillId = policy?.fallbackSkillId || rules.defaultActionId;
      actionResult = resolveSkill(actor, action.skillId || fallbackSkillId, action.targetIds || [], timeMs);
      if (!actionResult.accepted && action.skillId !== fallbackSkillId) actionResult = resolveSkill(actor, fallbackSkillId, [], timeMs + Math.max(1, Math.round(settleMs / 3)));
    }
    for (const skillId of Object.keys(actor.cooldowns)) actor.cooldowns[skillId] = Math.max(0, integer(actor.cooldowns[skillId], 0) - 1);
    tickBuffs(actor, "turn_end", timeMs + settleMs);
    const outcome = state.eventLimitReached ? "draw" : checkOutcome();
    if (state.eventLimitReached) finish("draw", "max_events");
    else if (outcome) finish(outcome, "all_units_check");
    return { accepted: true, actorId: actor.unitId, action: actionResult, outcome: state.outcome || "", snapshot: snapshot() };
  }

  function runToEnd(options = {}) {
    if (state.status === "idle") start();
    if (state.paused) return { ...snapshot(), steps: 0, rejected: "combat_paused" };
    const maxSteps = Math.max(1, integer(options.maxSteps, integer(rules.maxRounds, 40) * Math.max(1, units.size) * 4));
    let steps = 0;
    while (state.status === "active" && steps < maxSteps) { step(); steps += 1; }
    if (state.status === "active") finish("draw", "max_steps");
    return { ...snapshot(), steps }; 
  }

  function attemptRunaway(unitId = playerUnitIds[0]) {
    if (state.status === "idle") start();
    if (state.paused) return { accepted: false, reason: "combat_paused", snapshot: snapshot() };
    if (state.status !== "active") return { accepted: false, reason: "combat_not_active", snapshot: snapshot() };
    if (!canRecordCommand()) return { accepted: false, reason: "combat_replay_command_limit", snapshot: snapshot() };
    if (encounter.rules?.allowRunaway === false) return { accepted: false, reason: "runaway_disabled", snapshot: snapshot() };
    const actor = units.get(unitId);
    if (!alive(actor) || !playerUnitIds.includes(unitId)) return { accepted: false, reason: "invalid_runaway_actor", snapshot: snapshot() };
    const turn = currentTurn();
    if (turn.actorId !== unitId || !turn.requiresPlayerInput) return { accepted: false, reason: "not_current_player_turn", snapshot: snapshot() };
    if (turn.rooted) return { accepted: false, reason: "rooted", snapshot: snapshot() };
    const timeMs = state.eventSeq * Math.max(1, integer(rules.presentation?.turnDurationMs, 720));
    tickBuffs(actor, "turn_start", timeMs);
    if (!alive(actor)) {
      const outcome = checkOutcome();
      if (outcome) finish(outcome, "runaway_turn_start");
      return { accepted: false, reason: "runaway_actor_defeated", snapshot: snapshot() };
    }
    const chance = clamp(number(encounter.rules?.runawayChance, 1), 0, 1);
    const success = random.next() <= chance;
    emit({ eventType: "runawayAttempt", kind: "runawayAttempt", sourceUnitId: unitId, value: chance, success, text: success ? `${formatName(actor)}成功脱离战斗` : `${formatName(actor)}未能脱离战斗`, timeMs });
    recordCommand({ kind: "runaway", unitId, success });
    if (success) finish("runaway", "runaway_success");
    else {
      state.turnIndex += 1;
      tickBuffs(actor, "turn_end", timeMs + Math.max(0, integer(rules.presentation?.settleMs, 240)));
      const outcome = checkOutcome();
      if (outcome) finish(outcome, "runaway_failed_turn_end");
    }
    return { accepted: true, success, outcome: state.outcome || "", snapshot: snapshot() };
  }

  function availableActions(unitId = playerUnitIds[0]) {
    const unit = units.get(unitId);
    if (!unit) return { unitId, skills: [], canRunaway: false };
    return {
      unitId,
      skills: unit.skillIds.map((skillId) => maps.skills.get(skillId)).filter(Boolean).map((skill) => ({
        skillId: skill.skillId,
        name: skill.name || skill.skillId,
        kind: skill.kind || "utility",
        target: skill.target || "single_enemy",
        cost: cloneData(skill.cost || {}),
        cooldown: integer(unit.cooldowns[skill.skillId], 0),
        available: canUseSkill(unit, skill).accepted,
        reason: canUseSkill(unit, skill).reason || "",
        targetSelection: ["single_enemy", "single_ally"].includes(skill.target || "single_enemy") ? "player_select" : "runtime_select",
        targetCandidates: targetCandidatesFor(unit, skill.target || "single_enemy").map((target) => ({
          unitId: target.unitId,
          name: target.name || target.unitId,
          side: side(target.unitId),
          alive: alive(target),
        })),
      })),
      canRunaway: state.status === "active" && encounter.rules?.allowRunaway !== false && currentTurn().actorId === unitId && !currentTurn().rooted,
    };
  }

  function currentTurn() {
    if (state.status !== "active") {
      return {
        status: state.status,
        round: state.round,
        actorId: "",
        side: "",
        requiresPlayerInput: false,
        reason: state.status === "finished" ? "combat_finished" : "combat_not_started",
      };
    }
    const nextActorId = state.turnOrder.slice(state.turnIndex).find((unitId) => alive(units.get(unitId))) || "";
    const actor = units.get(nextActorId);
    if (state.paused) {
      return {
        status: state.status,
        paused: true,
        round: state.round,
        actorId: actor?.unitId || "",
        actorName: actor?.name || actor?.unitId || "",
        side: actor ? side(actor.unitId) : "",
        controlled: false,
        rooted: false,
        requiresPlayerInput: false,
        reason: "combat_paused",
      };
    }
    const controlled = Boolean(actor?.buffs.some((buff) => maps.buffs.get(buff.buffId)?.control === "stun"));
    const rooted = Boolean(actor?.buffs.some((buff) => maps.buffs.get(buff.buffId)?.control === "root"));
    const playerTurn = Boolean(actor && playerUnitIds.includes(actor.unitId));
    return {
      status: state.status,
      round: state.round,
      actorId: actor?.unitId || "",
      actorName: actor?.name || actor?.unitId || "",
      side: actor ? side(actor.unitId) : "",
      controlled,
      rooted,
      requiresPlayerInput: playerTurn && !controlled,
      reason: actor ? (controlled ? "controlled" : (playerTurn ? "player_turn" : "enemy_turn")) : "turn_order_refresh_required",
    };
  }

  function combatControlState() {
    const turn = currentTurn();
    const actions = turn.requiresPlayerInput ? availableActions(turn.actorId) : { unitId: turn.actorId || "", skills: [], canRunaway: false };
    return {
      ...turn,
      availableActions: actions,
      status: state.status,
      outcome: state.outcome,
    };
  }

  function advanceUntilPlayerInput(options = {}) {
    if (state.status === "idle") start();
    if (state.paused) return { accepted: false, reason: "combat_paused", steps: 0, control: combatControlState(), snapshot: snapshot() };
    const maxSteps = Math.max(1, integer(options.maxSteps, Math.max(8, units.size * 8)));
    let steps = 0;
    while (state.status === "active" && steps < maxSteps) {
      const turn = currentTurn();
      if (turn.requiresPlayerInput) break;
      if (turn.reason === "turn_order_refresh_required") {
        prepareNextRoundIfNeeded();
        continue;
      }
      step();
      steps += 1;
    }
    if (state.status === "active" && steps >= maxSteps) finish("draw", "manual_turn_progress_limit");
    return { accepted: true, steps, control: combatControlState(), snapshot: snapshot() };
  }

  function submitPlayerAction(unitId, skillId, targetIds = []) {
    if (state.status === "idle") start();
    if (state.paused) return { accepted: false, reason: "combat_paused", control: combatControlState(), snapshot: snapshot() };
    if (!canRecordCommand()) return { accepted: false, reason: "combat_replay_command_limit", control: combatControlState(), snapshot: snapshot() };
    const turn = currentTurn();
    if (!turn.requiresPlayerInput || turn.actorId !== unitId) {
      return { accepted: false, reason: "not_current_player_turn", control: combatControlState(), snapshot: snapshot() };
    }
    const unit = units.get(unitId);
    const skill = maps.skills.get(skillId);
    if (!skillBelongsToUnit(unit, skillId)) return { accepted: false, reason: "skill_not_equipped", control: combatControlState(), snapshot: snapshot() };
    const usable = canUseSkill(unit, skill);
    if (!usable.accepted) return { accepted: false, reason: usable.reason, control: combatControlState(), snapshot: snapshot() };
    const targetValidation = validateRequestedTargets(unit, skill, targetIds, { requirePlayerSelection: true });
    if (!targetValidation.accepted) return { accepted: false, reason: targetValidation.reason, control: combatControlState(), snapshot: snapshot() };
    const result = step({ skillId, targetIds: list(targetIds) });
    if (!result.accepted) return { ...result, control: combatControlState() };
    const advanced = state.status === "active" ? advanceUntilPlayerInput() : { steps: 0, control: combatControlState() };
    recordCommand({ kind: "player_action", unitId, skillId, targetIds: list(targetIds) });
    return {
      accepted: true,
      actorId: unitId,
      skillId,
      targetIds: list(targetIds),
      action: result.action,
      outcome: state.outcome || "",
      autoAdvancedSteps: advanced.steps || 0,
      control: combatControlState(),
      snapshot: snapshot(),
    };
  }

  function queueAction(unitId, skillId, targetIds = []) {
    if (state.paused) return { accepted: false, reason: "combat_paused" };
    if (state.status === "finished") return { accepted: false, reason: "combat_not_active" };
    const unit = units.get(unitId);
    const skill = maps.skills.get(skillId);
    if (!skillBelongsToUnit(unit, skillId)) return { accepted: false, reason: "skill_not_equipped" };
    const check = canUseSkill(unit, skill);
    if (!check.accepted) return { accepted: false, reason: check.reason };
    const requested = validateRequestedTargets(unit, skill, targetIds);
    if (!requested.accepted) return { accepted: false, reason: requested.reason };
    if (!state.actionQueue) state.actionQueue = {};
    if (!state.actionQueue[unitId]) state.actionQueue[unitId] = [];
    state.actionQueue[unitId].push({ skillId, targetIds: list(targetIds) });
    return { accepted: true, unitId, skillId, targetIds: list(targetIds) };
  }

  function snapshot() {
    return {
      schema: "idlewuxia.combat_runtime.v1",
      encounterId: state.encounterId,
      sceneId: state.sceneId,
      playerUnitIds: cloneData(playerUnitIds),
      enemyUnitIds: cloneData(enemyUnitIds),
      status: state.status,
      paused: state.paused,
      outcome: state.outcome,
      round: state.round,
      turnIndex: state.turnIndex,
      turnOrder: cloneData(state.turnOrder),
      eventSeq: state.eventSeq,
      eventLimitReached: state.eventLimitReached,
      seed: state.seed,
      rngState: random.state(),
      units: cloneData([...units.values()].map((unit) => ({ ...unit, effectiveAttributes: effectiveAttributes(unit), _activeSkillId: undefined }))),
      actionQueue: cloneData(state.actionQueue),
      commandLog: cloneData(state.commandLog),
      replayId: currentReplayId(),
      events: cloneData(state.events),
      result: cloneData(state.result),
    };
  }

  function restoreRuntimeSnapshot(snapshotValue) {
    if (!record(snapshotValue) || snapshotValue.schema !== "idlewuxia.combat_runtime.v1") throw new Error("unsupported combat runtime snapshot");
    if (snapshotValue.encounterId !== encounterId) throw new Error("combat snapshot encounter mismatch");
    if (JSON.stringify(list(snapshotValue.playerUnitIds)) !== JSON.stringify(playerUnitIds)
      || JSON.stringify(list(snapshotValue.enemyUnitIds)) !== JSON.stringify(enemyUnitIds)) {
      throw new Error("combat snapshot roster mismatch");
    }
    if (!Number.isFinite(Number(snapshotValue.rngState)) || Number(snapshotValue.rngState) <= 0) throw new Error("combat snapshot rng state invalid");
    if (snapshotValue.sceneId !== undefined && snapshotValue.sceneId !== state.sceneId) throw new Error("combat snapshot scene mismatch");
    const snapshotUnits = new Map(list(snapshotValue.units).filter((unit) => unit?.unitId).map((unit) => [unit.unitId, unit]));
    if (snapshotUnits.size !== units.size || list(snapshotValue.units).length !== units.size) throw new Error("combat snapshot unit count or identity mismatch");
    const knownAttributes = new Set(["level", ...Object.keys(rules.attributeDefaults || {}), ...Object.keys(rules.attributes || {})]);
    for (const [unitId, unit] of units) {
      const restored = snapshotUnits.get(unitId);
      if (!restored || !Number.isFinite(Number(restored.hp)) || !Number.isFinite(Number(restored.mp)) || !Number.isFinite(Number(restored.hpMax)) || !Number.isFinite(Number(restored.mpMax))) {
        throw new Error(`combat snapshot unit invalid: ${unitId}`);
      }
      const restoredHp = number(restored.hp, -1);
      const restoredHpMax = number(restored.hpMax, 0);
      const restoredMp = number(restored.mp, -1);
      const restoredMpMax = number(restored.mpMax, -1);
      if (restoredHpMax < 1 || restoredMpMax < 0 || restoredHp < 0 || restoredHp > restoredHpMax || restoredMp < 0 || restoredMp > restoredMpMax || number(restored.shield, -1) < 0) throw new Error(`combat snapshot unit ranges invalid: ${unitId}`);
      if (typeof restored.alive !== "boolean" || restored.alive !== (restoredHp > 0)) throw new Error(`combat snapshot alive state invalid: ${unitId}`);
      const restoredBuffIds = list(restored.buffs).map((buff) => buff?.buffId);
      if (new Set(restoredBuffIds).size !== restoredBuffIds.length) throw new Error(`combat snapshot duplicate buff: ${unitId}`);
      for (const active of list(restored.buffs)) {
        const definition = maps.buffs.get(active?.buffId);
        if (!definition || !Number.isInteger(Number(active.stacks)) || number(active.stacks, 0) < 1 || number(active.stacks, 0) > integer(definition.maxStacks, 1) || !Number.isInteger(Number(active.duration)) || number(active.duration, 0) < 1 || !units.has(active.sourceUnitId)) throw new Error(`combat snapshot buff invalid: ${unitId}:${active?.buffId || "<empty>"}`);
      }
      for (const [skillId, value] of Object.entries(record(restored.cooldowns) ? restored.cooldowns : {})) if (!list(unit.skillIds).includes(skillId) || !Number.isInteger(Number(value)) || number(value, -1) < 0) throw new Error(`combat snapshot cooldown invalid: ${unitId}:${skillId}`);
      for (const modifier of list(restored.runtimeModifiers)) if (!knownAttributes.has(modifier?.attribute) || !["add", "mul"].includes(modifier?.op) || !Number.isFinite(Number(modifier?.value)) || !Number.isInteger(Number(modifier?.duration)) || number(modifier?.duration, 0) < 1) throw new Error(`combat snapshot modifier invalid: ${unitId}`);
      unit.hp = restoredHp;
      unit.hpMax = restoredHpMax;
      unit.mp = restoredMp;
      unit.mpMax = restoredMpMax;
      unit.shield = number(restored.shield, 0);
      unit.alive = restored.alive;
      unit.buffs = cloneData(list(restored.buffs));
      unit.cooldowns = cloneData(record(restored.cooldowns) ? restored.cooldowns : {});
      unit.runtimeModifiers = cloneData(list(restored.runtimeModifiers));
      unit.actionCount = Math.max(0, integer(restored.actionCount, 0));
    }
    if (!["idle", "active", "finished"].includes(snapshotValue.status)) throw new Error("combat snapshot status invalid");
    if (snapshotValue.paused !== undefined && typeof snapshotValue.paused !== "boolean") throw new Error("combat snapshot paused flag invalid");
    if (typeof snapshotValue.outcome !== "string" || (snapshotValue.status === "finished") !== Boolean(snapshotValue.outcome)) throw new Error("combat snapshot outcome/status mismatch");
    state.status = snapshotValue.status;
    state.paused = Boolean(snapshotValue.paused);
    if (state.status !== "active" && state.paused) throw new Error("finished or idle combat cannot be paused");
    state.outcome = snapshotValue.outcome;
    if (!Number.isInteger(Number(snapshotValue.round)) || Number(snapshotValue.round) < 0) throw new Error("combat snapshot round invalid");
    state.round = Number(snapshotValue.round);
    const restoredTurnOrder = list(snapshotValue.turnOrder);
    if (new Set(restoredTurnOrder).size !== restoredTurnOrder.length || restoredTurnOrder.some((unitId) => !units.has(unitId))) throw new Error("combat snapshot turn order invalid");
    if (state.status === "active" && [...units.values()].some((unit) => alive(unit) && !restoredTurnOrder.includes(unit.unitId))) throw new Error("combat snapshot turn order omits a living unit");
    if (!Number.isInteger(Number(snapshotValue.turnIndex)) || number(snapshotValue.turnIndex, -1) < 0 || number(snapshotValue.turnIndex, 0) > restoredTurnOrder.length) throw new Error("combat snapshot turn index invalid");
    state.turnIndex = Number(snapshotValue.turnIndex);
    state.turnOrder = restoredTurnOrder;
    const restoredEvents = list(snapshotValue.events);
    const eventSeqs = restoredEvents.map((event) => event?.seq);
    if (restoredEvents.length > Math.max(32, integer(rules.maxEvents, 512)) || new Set(eventSeqs).size !== eventSeqs.length || restoredEvents.some((event) => !record(event) || !Number.isInteger(Number(event.seq)) || !Number.isFinite(Number(event.timeMs)))) throw new Error("combat snapshot events invalid");
    const expectedEventSeq = restoredEvents.reduce((max, event) => Math.max(max, integer(event?.seq, -1) + 1), 0);
    if (!Number.isInteger(Number(snapshotValue.eventSeq)) || Number(snapshotValue.eventSeq) !== expectedEventSeq) throw new Error("combat snapshot event sequence invalid");
    state.events = cloneData(restoredEvents);
    state.eventSeq = expectedEventSeq;
    state.eventLimitReached = Boolean(snapshotValue.eventLimitReached);
    const restoredQueue = record(snapshotValue.actionQueue) ? snapshotValue.actionQueue : {};
    for (const [unitId, actions] of Object.entries(restoredQueue)) {
      const unit = units.get(unitId);
      if (!unit || !Array.isArray(actions)) throw new Error(`combat snapshot action queue invalid: ${unitId}`);
      for (const action of actions) if (!record(action) || !list(unit.skillIds).includes(action.skillId) || list(action.targetIds).some((targetId) => !units.has(targetId))) throw new Error(`combat snapshot queued action invalid: ${unitId}`);
    }
    state.actionQueue = cloneData(restoredQueue);
    const restoredCommands = list(snapshotValue.commandLog);
    if (restoredCommands.length > Math.max(1, integer(rules.replay?.maxCommands, 256)) || restoredCommands.some((command, index) => !record(command) || command.seq !== index || !["player_action", "runaway", "pause", "resume"].includes(command.kind))) {
      throw new Error("combat snapshot command log invalid");
    }
    for (const command of restoredCommands) {
      if (command.kind === "player_action") {
        const unit = units.get(command.unitId);
        if (!unit || !list(unit.skillIds).includes(command.skillId) || list(command.targetIds).some((targetId) => !units.has(targetId))) throw new Error("combat snapshot player command invalid");
      }
      if (command.kind === "runaway" && !playerUnitIds.includes(command.unitId)) throw new Error("combat snapshot runaway command invalid");
    }
    state.commandLog = cloneData(restoredCommands);
    if (snapshotValue.replayId !== undefined && snapshotValue.replayId !== currentReplayId()) throw new Error("combat snapshot replay id mismatch");
    if (snapshotValue.result !== null && snapshotValue.result !== undefined && !record(snapshotValue.result)) throw new Error("combat snapshot result invalid");
    if (state.status === "finished" && snapshotValue.result?.outcome !== state.outcome) throw new Error("combat snapshot result/outcome mismatch");
    state.result = cloneData(snapshotValue.result || null);
    if (state.status === "active" && !state.turnOrder.length) rebuildTurnOrder();
  }

  if (restoredSnapshot) restoreRuntimeSnapshot(restoredSnapshot);

  return Object.freeze({
    start,
    step,
    runToEnd,
    attemptRunaway,
    pause,
    resume,
    availableActions,
    currentTurn,
    combatControlState,
    advanceUntilPlayerInput,
    submitPlayerAction,
    queueAction,
    snapshot,
    validate: () => validateCombatContent(source),
    presentation: (options = {}) => buildCombatPresentation(snapshot(), options),
  });
}

export function replayCombatSession(content, replay = {}, options = {}) {
  if (content?.rules?.replay?.allowReplay !== true) throw new Error("combat replay is disabled by configuration");
  const session = createCombatSession(content, {
    encounterId: replay.encounterId,
    seed: replay.seed,
  });
  session.start();
  session.advanceUntilPlayerInput({ maxSteps: options.maxSteps || 256 });
  for (const command of list(replay.commands)) {
    if (command.kind === "pause") {
      session.pause();
      continue;
    }
    if (command.kind === "resume") {
      session.resume();
      continue;
    }
    if (command.kind === "runaway") {
      session.attemptRunaway(command.unitId);
      continue;
    }
    if (command.kind === "player_action") {
      const result = session.submitPlayerAction(command.unitId, command.skillId, list(command.targetIds));
      if (!result.accepted) throw new Error(`combat replay command rejected at ${command.seq}: ${result.reason}`);
    }
  }
  const result = session.snapshot();
  const maxReplayEvents = Math.max(1, Number(options.maxReplayEvents || content?.rules?.replay?.maxReplayEvents || 512));
  if (result.events.length > maxReplayEvents) throw new Error("combat replay event limit exceeded");
  return result;
}
