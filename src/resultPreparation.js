import { cloneData } from "./dataClone.js";
import {
  applySkillConversionPlan,
  createChoiceDefinition,
  createSkillConversionPlan,
  splitConfiguredResultTokens,
} from "./resultExecutionModules.js";

function lookupMap(value) {
  return value instanceof Map ? value : new Map(Object.entries(value || {}));
}

function matchesAnyPattern(value = "", patterns = []) {
  const text = String(value || "");
  return (patterns || []).some((pattern) => {
    if (!pattern) return false;
    const startsWithWildcard = pattern.startsWith("*");
    const endsWithWildcard = pattern.endsWith("*");
    const needle = pattern.replace(/^\*/, "").replace(/\*$/, "");
    if (startsWithWildcard && endsWithWildcard) return text.includes(needle);
    if (startsWithWildcard) return text.endsWith(needle);
    if (endsWithWildcard) return text.startsWith(needle);
    return text === pattern;
  });
}

function parseItemStackList(raw = "", policy = {}) {
  const stackDelimiter = String(policy.stackDelimiter || "");
  const fieldDelimiters = Array.isArray(policy.stackFieldDelimiters)
    ? policy.stackFieldDelimiters.filter(Boolean).map(String)
    : [];
  if (!stackDelimiter || !fieldDelimiters.length) return [];
  return String(raw || "")
    .replace(/^"+|"+$/g, "")
    .split(stackDelimiter)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const delimiter = fieldDelimiters.find((candidate) => part.includes(candidate));
      const [itemId = "", count = "1"] = delimiter
        ? part.split(delimiter, 2).map((value) => value.trim())
        : [part.trim(), "1"];
      return { itemId, count: Number.isFinite(Number(count)) ? Number(count) : 1 };
    })
    .filter((entry) => entry.itemId);
}

/**
 * Creates a pure preparation module for configured result branches.
 *
 * The module expands nested result sets, validates choices and skill conversion,
 * and simulates inventory costs against a cloned player snapshot. It never
 * commits changes to the caller's runtime state.
 */
export function createResultPreparation({
  resultLookup,
  resultSetPolicy = {},
  skillConversionPolicy = {},
  choiceResultPolicy = {},
  seasonalActivityPolicy = {},
  inventoryMutationPolicy = {},
} = {}) {
  const results = lookupMap(resultLookup);

  function resolveRecord(resultId = "") {
    const key = String(resultId || "").replace(/^rlt_/, "");
    return results.get(key) || results.get(`rlt_${key}`) || null;
  }

  function prepareRecords(records = [], context = {}) {
    const depth = Number(context.depth || 0);
    const maxDepth = Math.max(1, Number(resultSetPolicy.maxDepth || 16));
    if (depth > maxDepth) {
      return { accepted: false, reason: "result chain depth exceeded", depth, maxDepth };
    }
    const trail = Array.isArray(context.trail) ? context.trail : [];
    const projectedPlayer = context.projectedPlayer || {};
    const prepared = [];

    for (const sourceResult of records) {
      const result = cloneData(sourceResult);
      const resultId = result.resultId || "";
      const action = result.action || "";
      if (action === resultSetPolicy.actionName) {
        if (trail.includes(resultId)) {
          return { accepted: false, reason: "result chain cycle detected", resultId, trail: cloneData(trail) };
        }
        const tokens = splitConfiguredResultTokens(
          result.args?.[resultSetPolicy.resultListArg] || "",
          resultSetPolicy.resultDelimiter || ";",
        );
        if (!tokens.length) return { accepted: false, reason: "result set is empty", resultId };
        const children = [];
        for (const token of tokens) {
          const child = resolveRecord(token);
          if (!child) return { accepted: false, reason: "unknown result token", resultId, resultToken: token };
          children.push(child);
        }
        const nested = prepareRecords(children, {
          depth: depth + 1,
          trail: [...trail, resultId],
          projectedPlayer,
        });
        if (!nested.accepted) return nested;
        prepared.push(...nested.records);
        continue;
      }

      if (action === skillConversionPolicy.actionName) {
        if (trail.includes(resultId)) {
          return { accepted: false, reason: "result chain cycle detected", resultId, trail: cloneData(trail) };
        }
        const plan = createSkillConversionPlan(result, skillConversionPolicy, projectedPlayer);
        if (!plan.accepted) return { ...plan, resultId };
        result.executionPlan = { type: "skill_conversion", plan: cloneData(plan) };
        prepared.push(result);
        applySkillConversionPlan(projectedPlayer, plan);
        const children = [];
        for (const token of plan.resultTokens) {
          const child = resolveRecord(token);
          if (!child) return { accepted: false, reason: "unknown result token", resultId, resultToken: token };
          children.push(child);
        }
        const nested = prepareRecords(children, {
          depth: depth + 1,
          trail: [...trail, resultId],
          projectedPlayer,
        });
        if (!nested.accepted) return nested;
        prepared.push(...nested.records);
        continue;
      }

      if (action === choiceResultPolicy.actionName) {
        const choice = createChoiceDefinition(result, choiceResultPolicy, resolveRecord);
        if (!choice.accepted) return { ...choice, resultId };
        result.choiceDefinition = cloneData(choice.definition);
      }
      prepared.push(result);
    }
    return { accepted: true, records: prepared, projectedPlayer };
  }

  function validateInventory(records, projectedPlayer) {
    const categoryName = String(inventoryMutationPolicy.categoryName || "");
    const deltaActionName = String(inventoryMutationPolicy.deltaActionName || "");
    const craftActionName = String(inventoryMutationPolicy.craftActionName || "");
    const itemIdArg = String(inventoryMutationPolicy.itemIdArg || "");
    const deltaArg = String(inventoryMutationPolicy.deltaArg || "");
    const craftIngredientsArg = String(inventoryMutationPolicy.craftIngredientsArg || "");
    const craftProductArg = String(inventoryMutationPolicy.craftProductArg || "");
    if (!categoryName || !deltaActionName || !craftActionName || !itemIdArg || !deltaArg
      || !craftIngredientsArg || !craftProductArg) {
      return { accepted: false, reason: "invalid inventory mutation policy" };
    }
    const projectedInventory = cloneData(projectedPlayer.inventory || {});
    for (const result of records) {
      const args = result.args || {};
      const category = result.category || "";
      const action = result.action || "";
      if (category === categoryName && action === craftActionName) {
        const ingredients = parseItemStackList(args[craftIngredientsArg] || "", inventoryMutationPolicy);
        const productId = args[craftProductArg] || "";
        if (!ingredients.length || !productId) {
          return { accepted: false, reason: "invalid crafting recipe", resultId: result.resultId || "" };
        }
        for (const ingredient of ingredients) {
          if (Number(projectedInventory[ingredient.itemId] || 0) < ingredient.count) {
            return {
              accepted: false,
              reason: "insufficient crafting ingredients",
              resultId: result.resultId || "",
              itemId: ingredient.itemId,
              required: ingredient.count,
              available: Number(projectedInventory[ingredient.itemId] || 0),
            };
          }
          projectedInventory[ingredient.itemId] = Number(projectedInventory[ingredient.itemId] || 0) - ingredient.count;
        }
        projectedInventory[productId] = Number(projectedInventory[productId] || 0) + 1;
        continue;
      }
      if (category === categoryName || action === deltaActionName) {
        const itemId = args[itemIdArg] || "";
        const configuredDelta = args[deltaArg];
        const rawDelta = configuredDelta === "" || configuredDelta === undefined
          ? inventoryMutationPolicy.defaultDelta
          : configuredDelta;
        const delta = Number(rawDelta);
        if (!itemId || !Number.isFinite(delta)) {
          return { accepted: false, reason: "invalid inventory delta", resultId: result.resultId || "" };
        }
        const nextValue = Number(projectedInventory[itemId] || 0) + delta;
        if (nextValue < 0) {
          return {
            accepted: false,
            reason: "insufficient inventory",
            resultId: result.resultId || "",
            itemId,
            delta,
            available: Number(projectedInventory[itemId] || 0),
          };
        }
        projectedInventory[itemId] = nextValue;
      }
    }
    return { accepted: true, projectedInventory };
  }

  function prepare(branch = {}, player = {}) {
    const projectedPlayer = cloneData(player);
    const preparation = prepareRecords(branch.resolvedResults || [], {
      depth: 0,
      trail: [],
      projectedPlayer,
    });
    if (!preparation.accepted) return preparation;
    const inventory = validateInventory(preparation.records, preparation.projectedPlayer);
    if (!inventory.accepted) return inventory;
    return {
      accepted: true,
      reason: "ok",
      projectedPlayer: preparation.projectedPlayer,
      projectedInventory: inventory.projectedInventory,
      preparedBranch: {
        ...branch,
        resolvedResults: preparation.records,
      },
    };
  }

  function isBranchEnabled(branch = {}) {
    return (branch.resolvedResults || []).every((result) => {
      const seasonal = (seasonalActivityPolicy.actionNames || []).includes(result.action)
        || matchesAnyPattern(result.resultId, seasonalActivityPolicy.resultIdPatterns || []);
      return !seasonal || seasonalActivityPolicy.enabledInFirstSession !== false;
    });
  }

  function requiresChoiceUi(branch = {}) {
    const actionName = String(choiceResultPolicy.actionName || "");
    if (!actionName) return false;
    return (branch.resolvedResults || []).some((result) => result.action === actionName);
  }

  function narrativeLines(record) {
    if (!record) return [];
    if (Array.isArray(record.narrativeLines) && record.narrativeLines.length) {
      return record.narrativeLines.filter(Boolean);
    }
    return String(record.args?.Arg2 || "")
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return Object.freeze({
    contractVersion: "idlewuxia.result_preparation.v1",
    prepare,
    resolveRecord,
    isBranchEnabled,
    requiresChoiceUi,
    narrativeLines,
  });
}
