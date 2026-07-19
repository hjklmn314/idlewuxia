/**
 * @typedef {object} ConditionEvaluationContext
 * @property {object} [player]
 * @property {object} [mapMarkers]
 * @property {string} [actionType]
 * @property {string} [satisfiedCombatToken]
 * @property {string[]} [ignoreConditionTokens]
 */

/**
 * @typedef {object} ConditionEvaluation
 * @property {string} status
 * @property {boolean} accepted
 * @property {string} [token]
 */

function compareNumbers(left, operator, right) {
  if (operator === "gt") return Number(left) > Number(right);
  if (operator === "lt") return Number(left) < Number(right);
  return String(left ?? "") === String(right ?? "");
}

function markerValue(markerStore, marker = "") {
  const value = markerStore?.[marker];
  if (value && typeof value === "object") return value.value;
  return value;
}

/**
 * Creates a stateless interpreter for configured condition tokens.
 *
 * Definitions stay immutable. Runtime state is supplied per evaluation, which
 * keeps the evaluator deterministic, testable, and unable to mutate a session.
 *
 * @param {object} dependencies
 * @param {Map<string, object>|Record<string, object>} dependencies.conditionLookup
 * @param {Record<string, string>} [dependencies.rewardAttributeMap]
 */
export function createConditionEvaluator({
  conditionLookup,
  rewardAttributeMap = {},
} = {}) {
  const conditions = conditionLookup instanceof Map
    ? conditionLookup
    : new Map(Object.entries(conditionLookup || {}));

  function conditionRecord(token) {
    return conditions.get(token) || null;
  }

  function playerAttributeValue(player, sourceKey = "") {
    const field = rewardAttributeMap[sourceKey]
      || {
        exp: "experience",
        pot: "potential",
        qi: "hp",
        jing: "spirit",
        neili: "mp",
      }[sourceKey]
      || sourceKey;
    return Number(player?.[field] ?? 0);
  }

  function skillLevel(player, skillId = "") {
    return Number(player?.skillLevels?.[skillId] ?? 0);
  }

  /**
   * @param {string} token
   * @param {ConditionEvaluationContext} context
   * @returns {ConditionEvaluation & Record<string, unknown>}
   */
  function evaluateToken(token, context = {}) {
    if (!token) return { status: "ignored_empty_condition", accepted: true };
    if (context.satisfiedCombatToken && token === context.satisfiedCombatToken) {
      return { status: "satisfied_combat_outcome", accepted: true };
    }
    const condition = conditionRecord(token);
    if (!condition) return { status: "unknown_condition_token", accepted: false, token };

    const player = context.player || {};
    const mapMarkers = context.mapMarkers || {};
    const action = condition.arg1 || "";
    const arg2 = condition.arg2 || "";
    const arg3 = Number(condition.arg3 ?? 0);

    if (action === "玩家进入房间") {
      return { status: "checked_player_in_current_room", accepted: true, token };
    }
    if (action === "门派等于" || action === "门派不等于") {
      const actual = String(player.sectId || player.sect || "");
      const expected = String(arg2 || "");
      const accepted = action === "门派等于" ? actual === expected : actual !== expected;
      return {
        status: action === "门派等于" ? "checked_sect_eq" : "checked_sect_ne",
        accepted,
        token,
        field: "sectId",
        actual,
        expected,
        expectedLabel: String(condition.arg3 || arg2 || ""),
      };
    }
    if (action === "玩家标记等于" || action === "玩家标记大于" || action === "玩家标记小于") {
      const actual = Number(player.markers?.[arg2] || 0);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return {
        status: `checked_player_marker_${operator}`,
        accepted: compareNumbers(actual, operator, arg3),
        token,
        marker: arg2,
        actual,
        expected: arg3,
      };
    }
    if (action === "可传承玩家标记等于" || action === "可传承玩家标记大于" || action === "可传承玩家标记小于") {
      const actual = Number(player.inheritableMarkers?.[arg2] || 0);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return {
        status: `checked_inheritable_marker_${operator}`,
        accepted: compareNumbers(actual, operator, arg3),
        token,
        marker: arg2,
        actual,
        expected: arg3,
      };
    }
    if (action === "玩家物品大于") {
      return {
        status: "checked_inventory_gt",
        accepted: Number(player.inventory?.[arg2] || 0) > arg3,
        token,
        itemId: arg2,
        threshold: arg3,
      };
    }
    if (action === "玩家物品小于") {
      return {
        status: "checked_inventory_lt",
        accepted: Number(player.inventory?.[arg2] || 0) < arg3,
        token,
        itemId: arg2,
        threshold: arg3,
      };
    }
    if (action === "地图标记等于") {
      return {
        status: "checked_map_marker_eq",
        accepted: String(mapMarkers[arg2] ?? "") === String(condition.arg3 ?? ""),
        token,
        marker: arg2,
        expected: condition.arg3,
      };
    }
    if (action === "玩家属性大于" || action === "玩家属性小于" || action === "玩家属性等于") {
      const actual = playerAttributeValue(player, arg2);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return {
        status: `checked_player_attribute_${operator}`,
        accepted: compareNumbers(actual, operator, arg3),
        token,
        field: arg2,
        actual,
        expected: arg3,
      };
    }
    if (action === "玩家时间标记等于" || action === "玩家时间标记大于" || action === "玩家时间标记小于") {
      const actual = markerValue(player.timeMarkers, arg2) ?? "";
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return {
        status: `checked_player_time_marker_${operator}`,
        accepted: compareNumbers(actual, operator, condition.arg3 ?? ""),
        token,
        marker: arg2,
        actual,
        expected: condition.arg3,
      };
    }
    if (action === "玩家定时标记等于" || action === "玩家定时标记大于" || action === "玩家定时标记小于") {
      const actual = markerValue(player.timedMarkers, arg2) ?? "";
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return {
        status: `checked_player_timed_marker_${operator}`,
        accepted: compareNumbers(actual, operator, condition.arg3 ?? ""),
        token,
        marker: arg2,
        actual,
        expected: condition.arg3,
      };
    }
    if (action === "玩家武功等级大于" || action === "玩家武功等级小于" || action === "玩家武功等级等于") {
      const actual = skillLevel(player, arg2);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return {
        status: `checked_skill_level_${operator}`,
        accepted: compareNumbers(actual, operator, arg3),
        token,
        skillId: arg2,
        actual,
        expected: arg3,
      };
    }
    if (action === "玩家武功等级大于玩家等级" || action === "玩家武功等级小于玩家等级" || action === "玩家武功等级等于玩家等级") {
      const actual = skillLevel(player, arg2);
      const expected = Number(player.level || 0);
      const operator = action.includes("大于") ? "gt" : action.includes("小于") ? "lt" : "eq";
      return {
        status: `checked_skill_level_vs_player_level_${operator}`,
        accepted: compareNumbers(actual, operator, expected),
        token,
        skillId: arg2,
        actual,
        expected,
      };
    }
    return { status: "unsupported_condition_semantics", accepted: false, token, action };
  }

  /**
   * @param {object} branch
   * @param {ConditionEvaluationContext} context
   */
  function evaluateBranch(branch, context = {}) {
    const checks = (branch?.conditionTokens || [])
      .filter((token) => (
        token
        && token !== context.actionType
        && !token.startsWith("caozuo")
        && token !== "talk"
        && token !== "gift"
        && !token.startsWith("gorome")
        && !(context.ignoreConditionTokens || []).includes(token)
      ))
      .map((token) => evaluateToken(token, context));
    return {
      accepted: checks.every((check) => check.accepted),
      checks,
    };
  }

  return Object.freeze({
    contractVersion: "idlewuxia.condition_evaluator.v1",
    evaluateToken,
    evaluateBranch,
  });
}
