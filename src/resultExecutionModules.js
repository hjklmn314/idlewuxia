import { cloneData } from "./dataClone.js";

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function argumentValue(result, key) {
  return result?.args?.[key] ?? "";
}

function stripConfiguredPrefixes(value, prefixes = []) {
  let text = String(value ?? "").trim();
  for (const prefix of prefixes) {
    if (nonEmptyString(prefix) && text.startsWith(prefix)) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  return text;
}

export function splitConfiguredResultTokens(rawValue, delimiter = ";") {
  return String(rawValue ?? "")
    .split(delimiter)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function createChoiceDefinition(result, policy = {}, resolveResult = () => null) {
  if (!result || result.action !== policy.actionName) {
    return { accepted: false, reason: "result does not match choice policy" };
  }
  const optionRows = Array.isArray(policy.options) ? policy.options : [];
  if (!nonEmptyString(policy.titleArg) || optionRows.length < 2) {
    return { accepted: false, reason: "invalid choice policy" };
  }

  const title = stripConfiguredPrefixes(
    argumentValue(result, policy.titleArg),
    policy.stripDisplayPrefixes || [],
  );
  if (!title) return { accepted: false, reason: "choice title is empty" };

  const options = [];
  for (const row of optionRows) {
    const optionId = String(row?.optionId || "").trim();
    const label = stripConfiguredPrefixes(
      argumentValue(result, row?.labelArg),
      policy.stripDisplayPrefixes || [],
    );
    const resultTokens = splitConfiguredResultTokens(
      argumentValue(result, row?.resultListArg),
      policy.resultDelimiter || ";",
    );
    if (!optionId || !label || resultTokens.length === 0) {
      return {
        accepted: false,
        reason: "choice option is incomplete",
        optionId,
      };
    }
    const missingResultToken = resultTokens.find((token) => !resolveResult(token));
    if (missingResultToken) {
      return {
        accepted: false,
        reason: "choice option references an unknown result",
        optionId,
        resultToken: missingResultToken,
      };
    }
    options.push({ optionId, label, resultTokens });
  }

  return {
    accepted: true,
    definition: {
      schema: policy.definitionSchema || "idlewuxia.choice_definition.v1",
      choiceId: result.resultId || "",
      title,
      options,
      dismissPolicy: policy.dismissPolicy || "explicit_option_only",
      evidence: cloneData(policy.evidence || {}),
    },
  };
}

export function isValidPendingChoice(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && nonEmptyString(value.choiceId)
    && nonEmptyString(value.title)
    && nonEmptyString(value.sourceId)
    && Array.isArray(value.options)
    && value.options.length >= 2
    && value.options.every((option) => (
      nonEmptyString(option?.optionId)
      && nonEmptyString(option?.label)
      && Array.isArray(option?.resultTokens)
      && option.resultTokens.length > 0
      && option.resultTokens.every(nonEmptyString)
    ));
}

function skillExperienceAtLevel(level, curve = {}) {
  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel) || numericLevel < 0) {
    return { accepted: false, reason: "player level is invalid" };
  }
  const threshold = Number(curve.identityBelowLevel ?? 8);
  let value = numericLevel;
  if (numericLevel >= threshold) {
    const coefficient = Number(curve.coefficient);
    const exponent = Number(curve.exponent);
    const offset = Number(curve.offset);
    if (![coefficient, exponent, offset].every(Number.isFinite)) {
      return { accepted: false, reason: "skill experience curve is invalid" };
    }
    value = coefficient * (numericLevel ** exponent) + offset;
    if (curve.rounding === "ceil") value = Math.ceil(value);
    else if (curve.rounding === "floor") value = Math.floor(value);
    else if (curve.rounding === "round") value = Math.round(value);
  }
  return Number.isFinite(value)
    ? { accepted: true, value }
    : { accepted: false, reason: "skill experience cap is invalid" };
}

function finiteNonNegativeRecordValue(record, key) {
  const value = Number(record?.[key] || 0);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function createSkillConversionPlan(result, policy = {}, player = {}) {
  if (!result || result.action !== policy.actionName) {
    return { accepted: false, reason: "result does not match skill conversion policy" };
  }
  const sourceSkillId = String(policy.sourceSkillId || "");
  const targetSkillId = String(policy.targetSkillId || "");
  const playerLevelField = String(policy.experienceCap?.playerLevelField || "");
  const successResultTokens = splitConfiguredResultTokens(
    argumentValue(result, policy.successResultListArg),
    policy.resultDelimiter || ";",
  );
  const failureResultTokens = splitConfiguredResultTokens(
    argumentValue(result, policy.failureResultListArg),
    policy.resultDelimiter || ";",
  );
  if (!sourceSkillId || !targetSkillId || !playerLevelField || !successResultTokens.length || !failureResultTokens.length) {
    return { accepted: false, reason: "skill conversion policy is incomplete" };
  }

  const sourceExp = finiteNonNegativeRecordValue(player.skillExp, sourceSkillId);
  const targetExp = finiteNonNegativeRecordValue(player.skillExp, targetSkillId);
  if (sourceExp === null || targetExp === null) {
    return { accepted: false, reason: "skill experience state is invalid" };
  }
  if (sourceExp <= 0) {
    return {
      accepted: true,
      outcome: "failure",
      resultTokens: failureResultTokens,
      mutations: {
        skillExpDeltas: {},
        skillMoveExpDeltas: {},
        inventoryDeltas: {},
      },
      audit: { sourceSkillId, targetSkillId, sourceExp, targetExp, addExp: 0 },
    };
  }

  const cap = skillExperienceAtLevel(
    player[playerLevelField],
    policy.experienceCap?.curve || {},
  );
  if (!cap.accepted) return cap;
  const addExp = Math.max(0, Math.min(sourceExp, cap.value - targetExp));
  const skillMoveExpDeltas = {};
  for (const transfer of policy.moveTransfers || []) {
    const sourceMoveId = String(transfer?.sourceMoveId || "");
    const targetMoveId = String(transfer?.targetMoveId || "");
    const moveExp = finiteNonNegativeRecordValue(player.skillMoveExp, sourceMoveId);
    if (!sourceMoveId || !targetMoveId || moveExp === null) {
      return { accepted: false, reason: "skill move transfer state is invalid", sourceMoveId, targetMoveId };
    }
    skillMoveExpDeltas[targetMoveId] = Number(skillMoveExpDeltas[targetMoveId] || 0) + moveExp;
  }

  const inventoryDeltas = {};
  for (const transfer of policy.fragmentTransfers || []) {
    const sourceItemId = String(transfer?.sourceItemId || "");
    const targetItemId = String(transfer?.targetItemId || "");
    const count = finiteNonNegativeRecordValue(player.inventory, sourceItemId);
    if (!sourceItemId || !targetItemId || count === null) {
      return { accepted: false, reason: "skill fragment transfer state is invalid", sourceItemId, targetItemId };
    }
    inventoryDeltas[targetItemId] = Number(inventoryDeltas[targetItemId] || 0) + count;
  }

  return {
    accepted: true,
    outcome: "success",
    resultTokens: successResultTokens,
    mutations: {
      skillExpDeltas: { [targetSkillId]: addExp },
      skillMoveExpDeltas,
      inventoryDeltas,
    },
    audit: {
      sourceSkillId,
      targetSkillId,
      sourceExp,
      targetExp,
      targetExpCap: cap.value,
      addExp,
    },
  };
}

export function applySkillConversionPlan(player, plan) {
  if (!plan?.accepted || plan.outcome !== "success") return;
  player.skillExp ||= {};
  player.skillMoveExp ||= {};
  player.inventory ||= {};
  for (const [key, delta] of Object.entries(plan.mutations?.skillExpDeltas || {})) {
    player.skillExp[key] = Number(player.skillExp[key] || 0) + Number(delta || 0);
  }
  for (const [key, delta] of Object.entries(plan.mutations?.skillMoveExpDeltas || {})) {
    player.skillMoveExp[key] = Number(player.skillMoveExp[key] || 0) + Number(delta || 0);
  }
  for (const [key, delta] of Object.entries(plan.mutations?.inventoryDeltas || {})) {
    player.inventory[key] = Number(player.inventory[key] || 0) + Number(delta || 0);
  }
}
