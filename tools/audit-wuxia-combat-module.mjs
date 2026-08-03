import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { COMBAT_CAPABILITIES, createCombatSession, validateCombatContent } from "../src/combatSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = path.join(root, "config", "wuxia_combat_content.json");
const schemaPath = path.join(root, "config", "wuxia_combat_content.schema.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const schemaValidator = ajv.compile(schema);

const flattenEffects = (effects = []) => effects.flatMap((effect) => [effect, ...flattenEffects(effect.effects || [])]);
const configuredEffects = content.skills.flatMap((skill) => flattenEffects(skill.effects));
const configuredBuffFeatures = content.buffs.flatMap((buff) => [
  ...(buff.modifiers?.length ? ["stat_modifiers"] : []),
  ...(buff.periodic?.kind === "damage" ? ["damage_over_time"] : []),
  ...(buff.periodic?.kind === "heal" ? ["heal_over_time"] : []),
  ...(buff.reflect ? ["reflect"] : []),
  ...(buff.immunityTags?.length ? ["immunity"] : []),
  ...(buff.stackPolicy ? [buff.stackPolicy] : []),
  ...(buff.control ? [buff.control] : []),
]);
const configured = {
  skillKinds: [...new Set(content.skills.map((skill) => skill.kind))].sort(),
  effectKinds: [...new Set(configuredEffects.map((effect) => effect.kind))].sort(),
  targetSelectors: [...new Set(content.skills.map((skill) => skill.target))].sort(),
  damageTypes: [...new Set(configuredEffects.map((effect) => effect.damageType).filter(Boolean))].sort(),
  buffPolicies: [...new Set(content.buffs.map((buff) => buff.stackPolicy || "refresh"))].sort(),
  buffControls: [...new Set(content.buffs.map((buff) => buff.control).filter(Boolean))].sort(),
  buffFeatures: [...new Set(configuredBuffFeatures)].sort(),
  visualCues: content.visualCues.map((cue) => cue.cueId).sort(),
  audioCues: content.audioCues.map((cue) => cue.audioCueId).sort(),
};

function collectFormulaRefs(value, refs = new Set()) {
  if (!value || typeof value !== "object") return refs;
  if (typeof value.ref === "string") refs.add(value.ref);
  for (const arg of value.args || []) collectFormulaRefs(arg, refs);
  return refs;
}

const formulaRefs = [...new Set([
  ...Object.values(content.rules?.attributes || {}).flatMap((formula) => [...collectFormulaRefs(formula)]),
  ...configuredEffects.flatMap((effect) => [...collectFormulaRefs(effect.power)]),
  ...content.buffs.flatMap((buff) => [...collectFormulaRefs(buff.periodic?.power)]),
])].sort();
const knownAttributes = new Set([
  ...Object.keys(content.rules?.attributeDefaults || {}),
  ...Object.keys(content.rules?.attributes || {}),
  "level", "maxHp", "maxMp", "targetHp", "targetHpMax", "targetMp", "targetMpMax", "targetShield",
]);
const runtimeAttributeRequirements = [
  "maxHp", "maxMp", "attackPower", "defensePower", "internalDefense", "elementalDefense", "poisonDefense",
  "initiative", "critChance", "evasionChance", "accuracy", "blockChance", "blockPower", "penetration",
  "defensePenetration", "damageTakenMultiplier", "lifesteal", "tenacity",
];
const attributeContract = {
  baseDefaults: Object.keys(content.rules?.attributeDefaults || {}).sort(),
  derived: Object.keys(content.rules?.attributes || {}).sort(),
  formulaRefs,
  unresolvedFormulaRefs: formulaRefs.filter((ref) => !knownAttributes.has(ref)),
  missingRuntimeAttributes: runtimeAttributeRequirements.filter((ref) => !knownAttributes.has(ref)),
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function encounterForSkill(skillId) {
  const unit = content.units.find((candidate) => candidate.skillIds?.includes(skillId));
  if (!unit) return null;
  const encounter = content.encounters.find((candidate) => [...(candidate.playerUnitIds || []), ...(candidate.enemyUnitIds || [])].includes(unit.unitId));
  return unit && encounter ? { unit, encounter } : null;
}

function probeSkill(skill) {
  const location = encounterForSkill(skill.skillId);
  if (!location) return { id: skill.skillId, accepted: false, reason: "no_equipped_unit_or_encounter" };
  const session = createCombatSession(content, { encounterId: location.encounter.encounterId, seed: 9127 });
  const queued = session.queueAction(location.unit.unitId, skill.skillId);
  if (!queued.accepted) return { id: skill.skillId, accepted: false, reason: `queue:${queued.reason}` };
  session.start();
  for (let step = 0; step < 32 && session.snapshot().status === "active"; step += 1) {
    session.step();
    if (session.snapshot().events.some((event) => event.skillId === skill.skillId && ["skill", "skillResolved", "damage", "heal", "shield", "buff", "debuff", "resource", "statModifier"].includes(event.kind))) {
      return { id: skill.skillId, accepted: true, encounterId: location.encounter.encounterId, actorUnitId: location.unit.unitId };
    }
  }
  return { id: skill.skillId, accepted: false, reason: "no_effect_event" };
}

function probeBuff(buff) {
  const original = content.skills.find((skill) => flattenEffects(skill.effects).some((effect) => effect.kind === "applyBuff" && effect.buffId === buff.buffId));
  if (!original) return { id: buff.buffId, accepted: false, reason: "no_applyBuff_effect" };
  const location = encounterForSkill(original.skillId);
  if (!location) return { id: buff.buffId, accepted: false, reason: "no_equipped_unit_or_encounter" };
  const probeContent = clone(content);
  const probeSkill = probeContent.skills.find((skill) => skill.skillId === original.skillId);
  for (const effect of flattenEffects(probeSkill.effects)) if (effect.kind === "applyBuff" && effect.buffId === buff.buffId) effect.chance = 1;
  const session = createCombatSession(probeContent, { encounterId: location.encounter.encounterId, seed: 9127 });
  const queued = session.queueAction(location.unit.unitId, original.skillId);
  if (!queued.accepted) return { id: buff.buffId, accepted: false, reason: `queue:${queued.reason}` };
  session.start();
  for (let step = 0; step < 32 && session.snapshot().status === "active"; step += 1) {
    session.step();
    if (session.snapshot().events.some((event) => event.buffId === buff.buffId && ["buff", "debuff", "buffImmune", "buffResisted", "buffRejected"].includes(event.kind))) {
      return { id: buff.buffId, accepted: true, skillId: original.skillId, actorUnitId: location.unit.unitId };
    }
  }
  return { id: buff.buffId, accepted: false, reason: "no_buff_event" };
}

const schemaAccepted = schemaValidator(content);
const runtimeValidation = validateCombatContent(content);
const probes = {
  skills: content.skills.map(probeSkill),
  buffs: content.buffs.map(probeBuff),
};
const unsupportedConfigured = {
  skillKinds: configured.skillKinds.filter((kind) => !COMBAT_CAPABILITIES.skillKinds.includes(kind)),
  effectKinds: configured.effectKinds.filter((kind) => !COMBAT_CAPABILITIES.effectKinds.includes(kind)),
  targetSelectors: configured.targetSelectors.filter((kind) => !COMBAT_CAPABILITIES.targetSelectors.includes(kind)),
  buffControls: configured.buffControls.filter((kind) => !COMBAT_CAPABILITIES.buffControls.includes(kind)),
  buffPolicies: configured.buffPolicies.filter((kind) => !["stack", "refresh", "replace", "unique"].includes(kind)),
};
const unAuthoredSupported = {
  skillKinds: COMBAT_CAPABILITIES.skillKinds.filter((kind) => !configured.skillKinds.includes(kind)),
  effectKinds: COMBAT_CAPABILITIES.effectKinds.filter((kind) => !configured.effectKinds.includes(kind)),
  targetSelectors: COMBAT_CAPABILITIES.targetSelectors.filter((kind) => !configured.targetSelectors.includes(kind)),
  buffControls: COMBAT_CAPABILITIES.buffControls.filter((kind) => !configured.buffControls.includes(kind)),
  buffFeatures: COMBAT_CAPABILITIES.buffFeatures.filter((kind) => !configured.buffFeatures.includes(kind)),
};
const runtimeFiles = ["src/combatSession.js", "src/chapterSession.js", "src/wuxia-main.js"];
const configuredConcreteIds = new Set([
  ...content.units.map((unit) => unit.unitId),
  ...content.skills.map((skill) => skill.skillId),
  ...content.buffs.map((buff) => buff.buffId),
  ...content.encounters.map((encounter) => encounter.encounterId),
]);
const forbiddenHardcodedIds = runtimeFiles.flatMap((relative) => {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  return [...source.matchAll(/(?:unit|skill|buff|encounter)_[a-z0-9_]+/gi)]
    .map((match) => match[0])
    .filter((token) => configuredConcreteIds.has(token))
    .map((token) => ({ file: relative, token }));
});
const probeFailures = Object.values(probes).flat().filter((probe) => !probe.accepted);
const report = {
  generatedAt: new Date().toISOString(),
  authority: "H:/MyProjectBack/idlewuxia",
  sourceFiles: ["config/wuxia_combat_content.json", "config/wuxia_combat_content.schema.json", ...runtimeFiles],
  schemaValidation: { accepted: schemaAccepted, errors: schemaValidator.errors || [] },
  runtimeValidation,
  configured,
  attributeContract,
  supported: COMBAT_CAPABILITIES,
  unsupportedConfigured,
  unAuthoredSupported,
  probes,
  staticHardcodedConcreteIds: forbiddenHardcodedIds,
  acceptance: {
    schema: schemaAccepted,
    runtimeReferences: runtimeValidation.accepted,
    noUnsupportedConfigured: Object.values(unsupportedConfigured).every((items) => items.length === 0),
    allSkillProbes: probes.skills.every((probe) => probe.accepted),
    allBuffProbes: probes.buffs.every((probe) => probe.accepted),
    noHardcodedConcreteIds: forbiddenHardcodedIds.length === 0,
    attributeContract: attributeContract.unresolvedFormulaRefs.length === 0 && attributeContract.missingRuntimeAttributes.length === 0,
  },
  knownBoundaries: [
    "Probe acceptance proves configured interpreter paths, not full player-facing manual action UI.",
    "Asset and audio cues are contract-level definitions; real-device mix, latency, and visual quality still require device and screenshot gates.",
    "Coverage is limited to authored content currently present in wuxia_combat_content.json; un-authored capability types remain explicit backlog rather than implicit completion.",
  ],
};
report.accepted = Object.values(report.acceptance).every(Boolean);
const outputDir = path.join(root, "outputs", "combat");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "combat_module_audit.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.accepted) process.exit(1);
