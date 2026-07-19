import { cloneData } from "./dataClone.js";
import {
  applySkillConversionPlan,
  createChoiceDefinition,
  createSkillConversionPlan,
  isValidPendingChoice,
} from "./resultExecutionModules.js";

class EffectTransactionError extends Error {
  constructor(reason, detail = {}) {
    super(reason);
    this.name = "EffectTransactionError";
    this.reason = reason;
    this.detail = detail;
  }
}

function asMap(value) {
  return value instanceof Map ? value : new Map(Object.entries(value || {}));
}

function effectDescriptor(result = {}) {
  return {
    resultId: result.resultId || "",
    category: result.category || "",
    action: result.action || "",
    status: "ignored_text_only",
  };
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

export function createResultEffectExecutor({
  resultLookup,
  npcLookup,
  interactableLookup,
  rewardAttributeMap = {},
  resultEffectPolicies = {},
  chapterClearPolicy = {},
  evaluateBranch = () => ({ accepted: false, checks: [] }),
} = {}) {
  const results = asMap(resultLookup);
  const npcs = asMap(npcLookup);
  const interactables = asMap(interactableLookup);
  const chapterClearChapters = chapterClearPolicy.chapters || {};
  const choicePolicy = resultEffectPolicies.choiceResult || {};
  const skillConversionPolicy = resultEffectPolicies.skillConversion || {};
  const inventoryPolicy = resultEffectPolicies.inventoryMutation || {};
  const officialMeritPolicy = resultEffectPolicies.officialMerit || {};
  const seasonalPolicy = resultEffectPolicies.seasonalActivity || {};
  const runtimePolicy = resultEffectPolicies.runtimeMutation || {};
  const categoryNames = runtimePolicy.categoryNames || {};
  const actionNames = runtimePolicy.actionNames || {};
  const argKeys = runtimePolicy.argKeys || {};

  function resolveRecord(resultId = "") {
    const key = String(resultId || "").replace(/^rlt_/, "");
    return results.get(key) || results.get(`rlt_${key}`) || null;
  }

  function matchesAction(action, policyKey) {
    const configured = actionNames[policyKey];
    return Boolean(configured) && action === configured;
  }

  function matchesCategory(category, policyKey) {
    const configured = categoryNames[policyKey];
    return Boolean(configured) && category === configured;
  }

  function argument(args, keyName) {
    const key = argKeys[keyName];
    return key ? args[key] : "";
  }

  function fail(reason, result = {}, detail = {}) {
    throw new EffectTransactionError(reason, {
      resultId: result.resultId || "",
      category: result.category || "",
      action: result.action || "",
      ...detail,
    });
  }

  function addEntityToRoom(draft, entityId, roomId) {
    if (!entityId || !roomId) return false;
    const set = draft.addedEntityIdsByRoom.get(roomId) || new Set();
    set.add(entityId);
    draft.addedEntityIdsByRoom.set(roomId, set);
    draft.hiddenEntityIds.delete(entityId);
    return true;
  }

  function hideEntity(draft, entityId) {
    if (!entityId) return false;
    draft.hiddenEntityIds.add(entityId);
    for (const set of draft.addedEntityIdsByRoom.values()) set.delete(entityId);
    if (draft.selectedChapterNpcId === entityId) draft.selectedChapterNpcId = "";
    if (draft.selectedChapterInteractableId === entityId) draft.selectedChapterInteractableId = "";
    return true;
  }

  function applyInventoryDelta(draft, itemId, rawDelta, result) {
    const delta = Number(rawDelta);
    if (!itemId || !Number.isFinite(delta)) fail("invalid inventory delta", result, { itemId, delta: rawDelta });
    const available = Number(draft.player.inventory[itemId] || 0);
    const nextValue = available + delta;
    if (nextValue < 0) fail("insufficient inventory", result, { itemId, delta, available });
    draft.player.inventory[itemId] = nextValue;
    return delta;
  }

  function narrativeLines(result) {
    if (Array.isArray(result.narrativeLines) && result.narrativeLines.length) {
      return result.narrativeLines.filter(Boolean);
    }
    return String(argument(result.args || {}, "primary") || "")
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function chapterClearEntry(resultId = "") {
    return Object.entries(chapterClearChapters)
      .find(([, policy]) => policy?.clearProgressResultId === resultId) || null;
  }

  function applyChapterClearIfNeeded(draft, result) {
    const entry = chapterClearEntry(result.resultId || "");
    if (!entry) return null;
    const [chapterId, policy] = entry;
    if (draft.player.chapterClearLedger.some((ledger) => (
      ledger.chapterId === chapterId && ledger.rewardId === policy.rewardId
    ))) {
      return {
        resultId: result.resultId || "",
        category: categoryNames.chapterClear,
        action: actionNames.chapterClear,
        status: "skipped_chapter_clear_already_applied",
        chapterId,
        rewardId: policy.rewardId || "",
      };
    }
    const rewardDeltas = policy.rewardDeltas || {};
    for (const [field, delta] of Object.entries(rewardDeltas)) {
      const value = Number(delta);
      if (!Number.isFinite(value)) fail("invalid chapter clear reward delta", result, { field, delta });
      draft.player[field] = Number(draft.player[field] || 0) + value;
    }
    if (policy.clearFlag) draft.flags.add(policy.clearFlag);
    if (policy.clearStateSignal) draft.flags.add(policy.clearStateSignal);
    draft.flags.add(`chapter_complete:${chapterId}`);
    const ledger = {
      chapterId,
      rewardId: policy.rewardId || "",
      clearProgressResultId: result.resultId || "",
      clearSourceNodeId: policy.clearSourceNodeId || "",
      clearNodeId: policy.clearNodeId || "",
      rewardDeltas: cloneData(rewardDeltas),
      sourceResultId: result.resultId || "",
      evidence: cloneData(policy.evidence || {}),
    };
    draft.player.chapterClearLedger.push(ledger);
    return {
      resultId: result.resultId || "",
      category: categoryNames.chapterClear,
      action: actionNames.chapterClear,
      status: "applied_chapter_clear_reward",
      chapterId,
      rewardId: policy.rewardId || "",
      rewardDeltas: cloneData(rewardDeltas),
      ledger,
    };
  }

  function matchesOfficialMerit(result) {
    return (Boolean(officialMeritPolicy.actionName) && result.action === officialMeritPolicy.actionName)
      || matchesAnyPattern(result.resultId, officialMeritPolicy.resultIdPatterns || []);
  }

  function seasonalResult(result) {
    return (seasonalPolicy.actionNames || []).includes(result.action)
      || matchesAnyPattern(result.resultId, seasonalPolicy.resultIdPatterns || []);
  }

  function combatFollowup(draft, sourceId, result, context) {
    const policy = runtimePolicy.combatFollowup || {};
    const resultId = result.resultId || "";
    const source = npcs.get(sourceId) || interactables.get(sourceId) || null;
    if (policy.compareResultId && resultId === policy.compareResultId && source) {
      const winBranch = (source.branches || []).find((candidate) => (
        (candidate.conditionTokens || []).includes(policy.compareWinConditionToken)
      ));
      if (!winBranch) return { status: "started_compare_without_comparewin_branch" };
      const condition = evaluateBranch(winBranch, {
        player: draft.player,
        mapMarkers: draft.mapMarkers,
        satisfiedCombatToken: policy.compareWinConditionToken,
      });
      if (!condition.accepted) {
        return {
          status: "started_compare_followup_conditions_not_met",
          conditionChecks: condition.checks || [],
          followupConditionTokens: [...(winBranch.conditionTokens || [])],
        };
      }
      const followupSideEffects = applyBranch(draft, sourceId, winBranch, context);
      return {
        status: "resolved_compare_via_comparewin_branch",
        followupResultTokens: [...(winBranch.resultTokens || [])],
        feedbackLines: [...(winBranch.narrativeLines || [])],
        conditionChecks: condition.checks || [],
        followupSideEffects,
      };
    }
    if (policy.inheritanceResultIdPrefix && resultId.startsWith(policy.inheritanceResultIdPrefix)) {
      const autoTextId = result.args?.[policy.autoTextArg] || "";
      const autoText = resolveRecord(autoTextId);
      if (!autoText) return { status: "started_inheritance_combat_missing_autotext", autoTextId };
      const marker = autoText.args?.[policy.autoTextMarkerArg] || "";
      if (marker) draft.flags.add(`combat_marker:${marker}=1`);
      return {
        status: "resolved_inheritance_combat_via_autotext",
        autoTextId,
        marker,
        feedbackLines: narrativeLines(autoText),
      };
    }
    return { status: "started_combat_without_known_resolution" };
  }

  function applyBranch(draft, sourceId, branch, context) {
    const sideEffects = [];
    for (const result of branch.resolvedResults || []) {
      const args = result.args || {};
      const category = result.category || "";
      const action = result.action || "";
      const primary = argument(args, "primary");
      const secondary = argument(args, "secondary");
      const effect = effectDescriptor(result);

      if (choicePolicy.actionName && action === choicePolicy.actionName) {
        const definition = result.choiceDefinition
          || createChoiceDefinition(result, choicePolicy, resolveRecord).definition;
        if (!definition || !isValidPendingChoice({ ...definition, sourceId })) {
          fail("invalid choice definition", result);
        }
        draft.pendingChoice = {
          ...cloneData(definition),
          sourceId,
          openedAtEventIndex: context.eventIndex,
        };
        sideEffects.push({
          ...effect,
          status: "opened_choice",
          choiceId: definition.choiceId,
          optionIds: definition.options.map((option) => option.optionId),
        });
        continue;
      }

      if (skillConversionPolicy.actionName && action === skillConversionPolicy.actionName) {
        const plan = result.executionPlan?.plan
          || createSkillConversionPlan(result, skillConversionPolicy, draft.player);
        if (!plan?.accepted) fail("invalid skill conversion plan", result, { detail: plan?.reason || "" });
        applySkillConversionPlan(draft.player, plan);
        for (const [skillId, delta] of Object.entries(plan.mutations?.skillExpDeltas || {})) {
          draft.flags.add(`skill_exp:${skillId}=${draft.player.skillExp[skillId]}`);
          if (Number(delta || 0) === 0) draft.flags.add(`skill_exp_capped:${skillId}`);
        }
        sideEffects.push({
          ...effect,
          status: plan.outcome === "success"
            ? "applied_skill_conversion"
            : "skill_conversion_source_not_learned",
          outcome: plan.outcome,
          conversion: cloneData(plan.audit || {}),
          mutations: cloneData(plan.mutations || {}),
        });
        continue;
      }

      if (matchesCategory(category, "narrativeFeedback")) {
        sideEffects.push({ ...effect, status: "applied_text_feedback", feedbackLines: narrativeLines(result) });
        continue;
      }

      if (matchesAction(action, "entitySwap")) {
        const fromId = primary || sourceId;
        const toId = secondary || "";
        if (!fromId || !toId) fail("missing entity swap args", result, { fromId, toId });
        for (const [anchorId, replacementId] of draft.replacementEntityById.entries()) {
          if (replacementId === fromId) draft.replacementEntityById.set(anchorId, toId);
        }
        draft.replacementEntityById.set(fromId, toId);
        hideEntity(draft, fromId);
        addEntityToRoom(draft, toId, context.currentRoomId);
        if (npcs.has(toId)) draft.selectedChapterNpcId = toId;
        if (interactables.has(toId)) draft.selectedChapterInteractableId = toId;
        sideEffects.push({ ...effect, status: "applied_entity_swap", fromId, toId });
        continue;
      }

      if (matchesAction(action, "entityAdd")) {
        if (!addEntityToRoom(draft, primary, context.currentRoomId)) fail("missing entity add arg", result);
        sideEffects.push({ ...effect, status: "applied_entity_add", entityId: primary });
        continue;
      }

      if (matchesAction(action, "hideSelf")) {
        if (!hideEntity(draft, sourceId)) fail("missing source for hide self", result);
        sideEffects.push({ ...effect, status: "applied_hide_self", entityId: sourceId });
        continue;
      }

      if (matchesAction(action, "entityDelete")) {
        if (!hideEntity(draft, primary)) fail("missing entity delete arg", result);
        sideEffects.push({ ...effect, status: "applied_entity_delete", entityId: primary });
        continue;
      }

      if (matchesCategory(category, "mapState")
        || matchesAction(action, "mapMarkerSet")
        || matchesAction(action, "mapMarkerChange")) {
        if (!primary) fail("missing map marker arg", result);
        const value = secondary || runtimePolicy.defaultValue;
        draft.mapMarkers[primary] = value;
        draft.flags.add(`map_marker:${primary}=${value}`);
        sideEffects.push({ ...effect, status: "applied_map_marker", marker: primary, value });
        const clearEffect = applyChapterClearIfNeeded(draft, result);
        if (clearEffect) sideEffects.push(clearEffect);
        continue;
      }

      if (matchesCategory(category, "attributeReward") || matchesAction(action, "attributeChange")) {
        const field = rewardAttributeMap[primary] || primary;
        const hasDelta = secondary !== "" && secondary !== undefined && secondary !== null;
        const value = Number(secondary);
        if (!field || !hasDelta || !Number.isFinite(value)) fail("missing attribute delta args", result, { field, value: secondary });
        draft.player[field] = Number(draft.player[field] || 0) + value;
        sideEffects.push({ ...effect, status: "applied_attribute_delta", field, value });
        continue;
      }

      if (category === inventoryPolicy.categoryName && action === inventoryPolicy.craftActionName) {
        const ingredients = parseItemStackList(args[inventoryPolicy.craftIngredientsArg] || "", inventoryPolicy);
        const productId = args[inventoryPolicy.craftProductArg] || "";
        if (!ingredients.length || !productId) fail("invalid crafting recipe", result);
        for (const ingredient of ingredients) applyInventoryDelta(draft, ingredient.itemId, -ingredient.count, result);
        applyInventoryDelta(draft, productId, 1, result);
        sideEffects.push({
          ...effect,
          status: "applied_item_crafting_recipe",
          ingredients,
          productId,
          feedbackLines: String(args[inventoryPolicy.craftFeedbackArg] || "")
            .split(inventoryPolicy.stackDelimiter || ";")
            .filter(Boolean),
        });
        continue;
      }

      if (category === inventoryPolicy.categoryName || action === inventoryPolicy.deltaActionName) {
        const itemId = args[inventoryPolicy.itemIdArg] || "";
        const configuredDelta = args[inventoryPolicy.deltaArg];
        const rawDelta = configuredDelta === "" || configuredDelta === undefined
          ? inventoryPolicy.defaultDelta
          : configuredDelta;
        applyInventoryDelta(draft, itemId, rawDelta, result);
        sideEffects.push({ ...effect, status: "applied_inventory_delta", itemId, delta: rawDelta });
        continue;
      }

      if (matchesCategory(category, "skillProgression") || matchesAction(action, "skillExperienceChange")) {
        const hasDelta = secondary !== "" && secondary !== undefined && secondary !== null;
        const delta = Number(secondary);
        if (!primary || !hasDelta || !Number.isFinite(delta)) fail("missing skill experience args", result, { skillId: primary, delta: secondary });
        draft.player.skillExp[primary] = Number(draft.player.skillExp[primary] || 0) + delta;
        draft.flags.add(`skill_exp:${primary}=${draft.player.skillExp[primary]}`);
        sideEffects.push({ ...effect, status: "applied_skill_exp_delta", skillId: primary, delta, total: draft.player.skillExp[primary] });
        continue;
      }

      if (matchesOfficialMerit(result)) {
        const rawDelta = args[officialMeritPolicy.deltaArg];
        const usedDefaultDelta = rawDelta === "" || rawDelta === undefined || rawDelta === null;
        const delta = usedDefaultDelta ? Number(officialMeritPolicy.defaultDelta) : Number(rawDelta);
        const gateField = officialMeritPolicy.gateField || "";
        const targetField = officialMeritPolicy.playerField || "";
        if (!gateField || !targetField || !Number.isFinite(delta)) fail("missing official merit delta", result);
        const entry = {
          resultId: result.resultId || "",
          sourceId,
          action,
          delta,
          rawDelta,
          usedDefaultDelta,
          gateField,
          gateValue: draft.player[gateField] ?? 0,
          playerField: targetField,
          evidenceLevel: officialMeritPolicy.evidenceLevel || "lua_confirmed",
          sourceFile: officialMeritPolicy.dispatcherSource || result.sourceFile || "",
        };
        if (Number(draft.player[gateField] || 0) !== 0) {
          draft.player[targetField] = Number(draft.player[targetField] || 0) + delta;
          entry.status = "applied_official_merit_delta";
          entry.total = draft.player[targetField];
          draft.flags.add(`merit:${targetField}=${draft.player[targetField]}`);
        } else {
          entry.status = "skipped_official_merit_official_type_gate";
          entry.total = Number(draft.player[targetField] || 0);
        }
        draft.player.meritLedger.push(entry);
        sideEffects.push({ ...effect, status: entry.status, merit: cloneData(entry) });
        continue;
      }

      if (matchesAction(action, "inheritableMarkerSet")) {
        if (!primary) fail("missing inheritable marker arg", result);
        const value = secondary || runtimePolicy.defaultValue;
        draft.player.inheritableMarkers[primary] = value;
        draft.flags.add(`inheritable_marker:${primary}=${value}`);
        sideEffects.push({ ...effect, status: "applied_inheritable_marker", marker: primary, value });
        continue;
      }

      if (matchesCategory(category, "roleState")
        || matchesAction(action, "playerMarkerSet")
        || matchesAction(action, "playerMarkerChange")) {
        if (!primary) fail("missing player marker arg", result);
        const rawValue = secondary === "" || secondary === undefined ? runtimePolicy.defaultValue : secondary;
        const value = matchesAction(action, "playerMarkerChange")
          ? Number(draft.player.markers[primary] || 0) + Number(rawValue)
          : rawValue;
        if (matchesAction(action, "playerMarkerChange") && !Number.isFinite(value)) {
          fail("invalid player marker delta", result, { marker: primary, delta: rawValue });
        }
        draft.player.markers[primary] = value;
        draft.flags.add(`player_marker:${primary}=${value}`);
        sideEffects.push({ ...effect, status: "applied_player_marker", marker: primary, value });
        continue;
      }

      if (matchesAction(action, "playerTimeMarkerSet")) {
        if (!primary) fail("missing player time marker arg", result);
        const value = secondary || runtimePolicy.defaultValue;
        draft.player.timeMarkers[primary] = value;
        draft.flags.add(`time_marker:${primary}=${value}`);
        sideEffects.push({ ...effect, status: "applied_player_time_marker", marker: primary, value });
        continue;
      }

      if (matchesAction(action, "playerTimedMarkerSet")) {
        if (!primary) fail("missing player timed marker arg", result);
        const value = secondary || runtimePolicy.defaultValue;
        const duration = argument(args, "duration") ?? "";
        draft.player.timedMarkers[primary] = { value, duration, setAtEventIndex: context.eventIndex };
        draft.flags.add(`timed_marker:${primary}=${value}`);
        sideEffects.push({ ...effect, status: "applied_player_timed_marker", marker: primary, value, duration });
        continue;
      }

      if (matchesAction(action, "storyDialogue")) {
        const delimiter = runtimePolicy.listDelimiter;
        const feedbackLines = String(primary || "").split(delimiter).map((line) => line.trim()).filter(Boolean);
        if (!feedbackLines.length) fail("missing story dialogue text", result);
        sideEffects.push({
          ...effect,
          status: "applied_story_dialogue_feedback",
          feedbackLines,
          lineDurations: String(secondary || "").split(delimiter).filter(Boolean),
        });
        continue;
      }

      if (matchesAction(action, "navigationStop")) {
        sideEffects.push({ ...effect, status: "recorded_navigation_stop" });
        continue;
      }

      if (seasonalResult(result)) {
        sideEffects.push({ ...effect, status: "scoped_out_seasonal_activity_module_disabled" });
        continue;
      }

      if (matchesCategory(category, "combat")) {
        const followup = combatFollowup(draft, sourceId, result, context);
        sideEffects.push({
          ...effect,
          status: followup.status,
          targetRoleId: primary || sourceId,
          autoTextId: secondary || "",
          feedbackLines: cloneData(followup.feedbackLines || []),
          followupResultTokens: cloneData(followup.followupResultTokens || []),
          followupSideEffects: cloneData(followup.followupSideEffects || []),
          conditionChecks: cloneData(followup.conditionChecks || []),
          marker: followup.marker || "",
        });
        continue;
      }

      fail("unimplemented result effect", result);
    }
    return sideEffects;
  }

  function normalizeState(state) {
    const draft = cloneData(state);
    draft.player ||= {};
    draft.player.inventory ||= {};
    draft.player.skillExp ||= {};
    draft.player.skillMoveExp ||= {};
    draft.player.markers ||= {};
    draft.player.inheritableMarkers ||= {};
    draft.player.timeMarkers ||= {};
    draft.player.timedMarkers ||= {};
    draft.player.meritLedger ||= [];
    draft.player.chapterClearLedger ||= [];
    draft.flags = draft.flags instanceof Set ? draft.flags : new Set(draft.flags || []);
    draft.hiddenEntityIds = draft.hiddenEntityIds instanceof Set ? draft.hiddenEntityIds : new Set(draft.hiddenEntityIds || []);
    draft.addedEntityIdsByRoom = draft.addedEntityIdsByRoom instanceof Map ? draft.addedEntityIdsByRoom : new Map();
    draft.replacementEntityById = draft.replacementEntityById instanceof Map ? draft.replacementEntityById : new Map();
    draft.mapMarkers ||= {};
    draft.pendingChoice ||= null;
    draft.selectedChapterNpcId ||= "";
    draft.selectedChapterInteractableId ||= "";
    return draft;
  }

  function commit({
    sourceId = "",
    currentRoomId = "",
    preparedBranch = {},
    state = {},
    eventIndex = 0,
  } = {}) {
    let draft;
    const sideEffects = [];
    try {
      draft = normalizeState(state);
      sideEffects.push(...applyBranch(draft, sourceId, preparedBranch, { currentRoomId, eventIndex }));
      return { accepted: true, reason: "ok", state: draft, sideEffects };
    } catch (error) {
      if (error instanceof EffectTransactionError) {
        return {
          accepted: false,
          reason: error.reason,
          ...cloneData(error.detail || {}),
          sideEffects: [],
        };
      }
      return {
        accepted: false,
        reason: "effect transaction failed",
        resultId: "",
        category: "",
        action: "",
        detail: String(error?.message || error),
        sideEffects: [],
      };
    }
  }

  return Object.freeze({
    contractVersion: "idlewuxia.result_effect_executor.v1",
    commit,
  });
}
