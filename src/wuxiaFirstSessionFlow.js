import { cloneData } from "./dataClone.js";

function resolveActiveChapter(contract, options = {}) {
  return (
    options.initialChapter
    || contract?.activeChapter
    || contract?.chapter
    || contract?.chapters?.[contract?.chapterSystem?.defaultChapterId]
    || Object.values(contract?.chapters || {})[0]
    || contract?.chapter1
    || {}
  );
}

function evidenceLevelOrUnknown(...candidates) {
  return candidates.find((value) => typeof value === "string" && value.trim()) || "unknown";
}

export function createFirstSessionRuntime(contract, options = {}) {
  const activeChapter = resolveActiveChapter(contract, options);
  const states = new Map((contract?.states || []).map((state) => [state.stateId, state]));
  const actions = new Map((contract?.actions || []).map((action) => [action.actionId, action]));
  const rewardClasses = contract?.rewardClasses || {};
  const rewardAttributeMap = contract?.rewardAttributeMap || {};
  const actionsByState = new Map();
  for (const action of contract?.actions || []) {
    const list = actionsByState.get(action.fromState) || [];
    list.push(action);
    actionsByState.set(action.fromState, list);
  }

  const nodeMap = new Map((activeChapter?.nodes || []).map((node) => [node.nodeId, node]));
  const roomMap = new Map((activeChapter?.rooms || []).map((room) => [room.roomId, room]));
  const npcMap = new Map((activeChapter?.npcs || []).map((npc) => [npc.roleId, npc]));
  const interactableMap = new Map((activeChapter?.interactables || []).map((item) => [item.interactableId, item]));
  const gateMap = new Map((activeChapter?.gates || []).map((gate) => [gate.gateId, gate]));
  const rewardMap = new Map((activeChapter?.rewards || []).map((reward) => [reward.rewardId, reward]));
  const resultLookup = new Map(Object.entries(activeChapter?.resultLookup || {}));
  const conditionLookup = new Map(Object.entries(activeChapter?.conditionLookup || {}));
  const resultEffectPolicies = contract?.chapterSystem?.resultEffectPolicies || {};
  const combatActionPolicies = contract?.chapterSystem?.combatActionPolicies || {};
  const officialMeritPolicy = resultEffectPolicies.officialMerit || {};
  const seasonalActivityPolicy = resultEffectPolicies.seasonalActivity || {};
  const chapterClearPolicy = contract?.chapterSystem?.chapterClearPolicy || {};
  const chapterClearChapters = chapterClearPolicy.chapters || {};
  const candidateSaveState = options.initialSaveState || null;
  const saveState = candidateSaveState
    && candidateSaveState.runtimeSchema === (contract?.schema || "")
    && (!candidateSaveState.chapterId || candidateSaveState.chapterId === (activeChapter?.chapterId || ""))
    ? candidateSaveState
    : {};
  const initialFlags = Array.isArray(saveState.flags)
    ? saveState.flags
    : (options.initialFlags || ["new_install_or_new_save"]);
  const flags = new Set(initialFlags);
  const requestedState = saveState.currentState || options.initialState || contract?.states?.[0]?.stateId || "";
  let currentState = states.has(requestedState) ? requestedState : (options.initialState || contract?.states?.[0]?.stateId || "");
  let selectedChapterNodeId = nodeMap.has(saveState.selectedChapterNodeId) ? saveState.selectedChapterNodeId : "";
  let selectedChapterRoomId = roomMap.has(saveState.selectedChapterRoomId) ? saveState.selectedChapterRoomId : "";
  let selectedChapterNpcId = npcMap.has(saveState.selectedChapterNpcId) ? saveState.selectedChapterNpcId : "";
  let selectedChapterInteractableId = interactableMap.has(saveState.selectedChapterInteractableId) ? saveState.selectedChapterInteractableId : "";
  const events = cloneData(Array.isArray(saveState.events) ? saveState.events : []);
  const player = cloneData(saveState.player || options.initialPlayer || contract?.playerSeed || {});
  player.inventory = cloneData(player.inventory || {});
  player.skillExp = cloneData(player.skillExp || {});
  player.skillLevels = cloneData(player.skillLevels || player.skills || {});
  player.inheritableMarkers = cloneData(player.inheritableMarkers || {});
  player.timeMarkers = cloneData(player.timeMarkers || {});
  player.timedMarkers = cloneData(player.timedMarkers || {});
  player.meritLedger = cloneData(player.meritLedger || []);
  player.chapterClearLedger = cloneData(player.chapterClearLedger || []);
  if (player.officialType === undefined) player.officialType = 0;
  if (player.officialAchievement === undefined) player.officialAchievement = 0;
  if (player.yueli === undefined) player.yueli = 0;
  const taskState = {
    activeTaskId: "",
    completedClicks: 0,
    ...(saveState.taskState || options.initialTaskState || {}),
  };
  const hiddenEntityIds = new Set(saveState.hiddenEntityIds || options.initialHiddenEntityIds || []);
  const addedEntityIdsByRoom = new Map();
  for (const [roomId, entityIds] of Object.entries(saveState.addedEntityIdsByRoom || {})) {
    addedEntityIdsByRoom.set(roomId, new Set(entityIds || []));
  }
  const replacementEntityById = new Map();
  for (const [entityId, replacementId] of Object.entries(saveState.replacementEntityById || {})) {
    replacementEntityById.set(entityId, replacementId);
  }
  const mapMarkers = { ...(saveState.mapMarkers || options.initialMapMarkers || {}) };
  let pendingCombat = cloneData(saveState.pendingCombat || null);

  function clone(value) {
    return cloneData(value);
  }

  function applyNumericDeltas(target, deltas = {}) {
    for (const [key, delta] of Object.entries(deltas)) {
      target[key] = Number(target[key] || 0) + Number(delta || 0);
    }
  }

  function playerAttributeValue(sourceKey = "") {
    const field = rewardAttributeMap[sourceKey]
      || {
        exp: "experience",
        pot: "potential",
        qi: "hp",
        jing: "spirit",
        neili: "mp",
      }[sourceKey]
      || sourceKey;
    return Number(player[field] ?? 0);
  }

  function skillLevel(skillId = "") {
    return Number(player.skillLevels?.[skillId] ?? 0);
  }

  function markerValue(markerStore, marker = "") {
    const value = markerStore?.[marker];
    if (value && typeof value === "object") return value.value;
    return value;
  }

  function compareNumbers(left, operator, right) {
    if (operator === "gt") return Number(left) > Number(right);
    if (operator === "lt") return Number(left) < Number(right);
    return String(left ?? "") === String(right ?? "");
  }

  function addEntityToRoom(entityId, roomId = selectedChapterRoomId) {
    if (!entityId || !roomId) return false;
    const set = addedEntityIdsByRoom.get(roomId) || new Set();
    set.add(entityId);
    addedEntityIdsByRoom.set(roomId, set);
    hiddenEntityIds.delete(entityId);
    return true;
  }

  function hideEntity(entityId) {
    if (!entityId) return false;
    hiddenEntityIds.add(entityId);
    for (const set of addedEntityIdsByRoom.values()) set.delete(entityId);
    if (selectedChapterNpcId === entityId) selectedChapterNpcId = "";
    if (selectedChapterInteractableId === entityId) selectedChapterInteractableId = "";
    return true;
  }

  function dynamicEntityIdsForRoom(roomId) {
    return [...(addedEntityIdsByRoom.get(roomId) || new Set())].filter((entityId) => !hiddenEntityIds.has(entityId));
  }

  function roomEntityIds(room) {
    const seen = new Set();
    const ordered = [];
    for (const entityId of [...(room?.encounterIds || []), ...(room?.interactableIds || [])]) {
      const replacementId = replacementEntityById.get(entityId);
      const resolvedId = replacementId && !hiddenEntityIds.has(replacementId) ? replacementId : entityId;
      if (!resolvedId || hiddenEntityIds.has(resolvedId) || seen.has(resolvedId)) continue;
      ordered.push(resolvedId);
      seen.add(resolvedId);
    }
    for (const entityId of dynamicEntityIdsForRoom(room?.roomId || "")) {
      if (!entityId || seen.has(entityId)) continue;
      ordered.push(entityId);
      seen.add(entityId);
    }
    return ordered;
  }

  function roomEnterConditionToken(roomId = "") {
    const match = String(roomId).match(/_(\d+)$/);
    if (!match) return "";
    return `gorome${Number(match[1])}`;
  }

  function transitionBlockerForRoom(targetRoomId) {
    if (!selectedChapterRoomId || !targetRoomId || selectedChapterRoomId === targetRoomId) return null;
    const currentRoom = roomMap.get(selectedChapterRoomId);
    const conditionToken = roomEnterConditionToken(targetRoomId);
    if (!currentRoom || !conditionToken) return null;
    for (const entityId of roomEntityIds(currentRoom)) {
      const npc = npcMap.get(entityId);
      if (!npc) continue;
      const branch = (npc.branches || []).find((candidate) => (
        (candidate.conditionTokens || []).includes(conditionToken)
        && (candidate.resultTokens || []).includes("stop")
      ));
      if (branch) return { npc, branch, conditionToken };
    }
    return null;
  }

  function applyInventoryDelta(itemId, rawDelta = 1) {
    if (!itemId) return false;
    const delta = Number.isFinite(Number(rawDelta)) ? Number(rawDelta) : 1;
    player.inventory[itemId] = Number(player.inventory[itemId] || 0) + delta;
    return true;
  }

  function parseItemStackList(raw = "") {
    return String(raw || "")
      .replace(/^"+|"+$/g, "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [itemId = "", count = "1"] = part.split(/[,:]/).map((value) => value.trim());
        return { itemId, count: Number.isFinite(Number(count)) ? Number(count) : 1 };
      })
      .filter((entry) => entry.itemId);
  }

  function resultRecord(resultId = "") {
    const key = String(resultId || "").replace(/^rlt_/, "");
    return resultLookup.get(key) || resultLookup.get(`rlt_${key}`) || null;
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

  function matchesOfficialMeritResult(result = {}) {
    return (
      result.action === (officialMeritPolicy.actionName || "改变政绩")
      || matchesAnyPattern(result.resultId, officialMeritPolicy.resultIdPatterns || [])
    );
  }

  function matchesSeasonalActivityResult(result = {}) {
    return (
      (seasonalActivityPolicy.actionNames || []).includes(result.action)
      || matchesAnyPattern(result.resultId, seasonalActivityPolicy.resultIdPatterns || [])
    );
  }

  function chapterClearEntryForResult(resultId = "") {
    return Object.entries(chapterClearChapters).find(([, policy]) => policy?.clearProgressResultId === resultId) || null;
  }

  function applyChapterClearIfNeeded(resultId = "", sourceResult = {}) {
    const entry = chapterClearEntryForResult(resultId);
    if (!entry) return null;
    const [chapterId, policy] = entry;
    if (player.chapterClearLedger.some((ledger) => ledger.chapterId === chapterId && ledger.rewardId === policy.rewardId)) {
      return {
        resultId,
        category: "chapter_clear",
        action: "章节通关",
        status: "skipped_chapter_clear_already_applied",
        chapterId,
        rewardId: policy.rewardId || "",
      };
    }

    const rewardDeltas = policy.rewardDeltas || {};
    applyNumericDeltas(player, rewardDeltas);
    if (policy.clearFlag) flags.add(policy.clearFlag);
    if (policy.clearStateSignal) flags.add(policy.clearStateSignal);
    flags.add(`chapter_complete:${chapterId}`);

    const ledger = {
      chapterId,
      rewardId: policy.rewardId || "",
      clearProgressResultId: resultId,
      clearSourceNodeId: policy.clearSourceNodeId || "",
      clearNodeId: policy.clearNodeId || "",
      rewardDeltas: clone(rewardDeltas),
      sourceResultId: sourceResult.resultId || resultId,
      evidence: clone(policy.evidence || {}),
    };
    player.chapterClearLedger.push(ledger);
    return {
      resultId,
      category: "chapter_clear",
      action: "章节通关",
      status: "applied_chapter_clear_reward",
      chapterId,
      rewardId: policy.rewardId || "",
      rewardDeltas: clone(rewardDeltas),
      ledger,
    };
  }

  function isResultEnabledInFirstSession(result = {}) {
    if (matchesSeasonalActivityResult(result)) return seasonalActivityPolicy.enabledInFirstSession !== false;
    return true;
  }

  function branchEnabledInFirstSession(branch = {}) {
    return (branch.resolvedResults || []).every((result) => isResultEnabledInFirstSession(result));
  }

  function narrativeLinesFromResultRecord(record) {
    if (!record) return [];
    if (Array.isArray(record.narrativeLines) && record.narrativeLines.length) return record.narrativeLines.filter(Boolean);
    return String(record.args?.Arg2 || "")
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function evaluateConditionToken(token, context = {}) {
    if (!token) return { status: "ignored_empty_condition", accepted: true };
    if (context.satisfiedCombatToken && token === context.satisfiedCombatToken) {
      return { status: "satisfied_combat_outcome", accepted: true };
    }
    const condition = conditionLookup.get(token);
    if (!condition) return { status: "unknown_condition_token", accepted: false, token };
    const action = condition.arg1 || "";
    const arg2 = condition.arg2 || "";
    const arg3 = Number(condition.arg3 ?? 0);
    if (action === "玩家进入房间") {
      // This result branch is being evaluated from an entity in the currently
      // selected room, so the map's in-room condition is already satisfied.
      return { status: "checked_player_in_current_room", accepted: true, token };
    }
    if (action === "门派等于" || action === "门派不等于") {
      const actual = String(player.sectId || player.sect || "");
      const expected = String(arg2 || "");
      const accepted = action === "门派等于" ? actual === expected : actual !== expected;
      return { status: action === "门派等于" ? "checked_sect_eq" : "checked_sect_ne", accepted, token, field: "sectId", actual, expected, expectedLabel: String(condition.arg3 || arg2 || "") };
    }
    if (action === "可传承玩家标记等于" || action === "可传承玩家标记大于" || action === "可传承玩家标记小于") {
      const actual = Number(player.inheritableMarkers[arg2] || 0);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return { status: `checked_inheritable_marker_${operator}`, accepted: compareNumbers(actual, operator, arg3), token, marker: arg2, actual, expected: arg3 };
    }
    if (action === "玩家物品大于") {
      return { status: "checked_inventory_gt", accepted: Number(player.inventory[arg2] || 0) > arg3, token, itemId: arg2, threshold: arg3 };
    }
    if (action === "玩家物品小于") {
      return { status: "checked_inventory_lt", accepted: Number(player.inventory[arg2] || 0) < arg3, token, itemId: arg2, threshold: arg3 };
    }
    if (action === "地图标记等于") {
      return { status: "checked_map_marker_eq", accepted: String(mapMarkers[arg2] ?? "") === String(condition.arg3 ?? ""), token, marker: arg2, expected: condition.arg3 };
    }
    if (action === "玩家属性大于" || action === "玩家属性小于" || action === "玩家属性等于") {
      const actual = playerAttributeValue(arg2);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return { status: `checked_player_attribute_${operator}`, accepted: compareNumbers(actual, operator, arg3), token, field: arg2, actual, expected: arg3 };
    }
    if (action === "玩家时间标记等于" || action === "玩家时间标记大于" || action === "玩家时间标记小于") {
      const actual = markerValue(player.timeMarkers, arg2) ?? "";
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return { status: `checked_player_time_marker_${operator}`, accepted: compareNumbers(actual, operator, condition.arg3 ?? ""), token, marker: arg2, actual, expected: condition.arg3 };
    }
    if (action === "玩家定时标记等于" || action === "玩家定时标记大于" || action === "玩家定时标记小于") {
      const actual = markerValue(player.timedMarkers, arg2) ?? "";
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return { status: `checked_player_timed_marker_${operator}`, accepted: compareNumbers(actual, operator, condition.arg3 ?? ""), token, marker: arg2, actual, expected: condition.arg3 };
    }
    if (action === "玩家武功等级大于" || action === "玩家武功等级小于" || action === "玩家武功等级等于") {
      const actual = skillLevel(arg2);
      const operator = action.endsWith("大于") ? "gt" : action.endsWith("小于") ? "lt" : "eq";
      return { status: `checked_skill_level_${operator}`, accepted: compareNumbers(actual, operator, arg3), token, skillId: arg2, actual, expected: arg3 };
    }
    if (action === "玩家武功等级大于玩家等级" || action === "玩家武功等级小于玩家等级" || action === "玩家武功等级等于玩家等级") {
      const actual = skillLevel(arg2);
      const expected = Number(player.level || 0);
      const operator = action.includes("大于") ? "gt" : action.includes("小于") ? "lt" : "eq";
      return { status: `checked_skill_level_vs_player_level_${operator}`, accepted: compareNumbers(actual, operator, expected), token, skillId: arg2, actual, expected };
    }
    return { status: "unsupported_condition_semantics", accepted: false, token, action };
  }

  function branchConditionsMet(branch, context = {}) {
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
      .map((token) => evaluateConditionToken(token, context));
    return {
      accepted: checks.every((check) => check.accepted),
      checks,
    };
  }

  function combatFollowupForResult(sourceId, result) {
    const resultId = result.resultId || "";
    const args = result.args || {};
    const source = npcMap.get(sourceId) || interactableMap.get(sourceId) || null;
    if (resultId === "compare" && source) {
      const winBranch = (source.branches || []).find((candidate) => (candidate.conditionTokens || []).includes("comparewin"));
      if (!winBranch) return { status: "started_compare_without_comparewin_branch" };
      const condition = branchConditionsMet(winBranch, { satisfiedCombatToken: "comparewin" });
      if (!condition.accepted) {
        return {
          status: "started_compare_followup_conditions_not_met",
          conditionChecks: condition.checks,
          followupConditionTokens: [...(winBranch.conditionTokens || [])],
        };
      }
      return {
        status: "resolved_compare_via_comparewin_branch",
        followupBranch: winBranch,
        followupResultTokens: [...(winBranch.resultTokens || [])],
        feedbackLines: [...(winBranch.narrativeLines || [])],
        conditionChecks: condition.checks,
      };
    }
    if (/^inattack/.test(resultId)) {
      const autoTextId = args.Arg3 || "";
      const autoText = resultRecord(autoTextId);
      if (!autoText) return { status: "started_inheritance_combat_missing_autotext", autoTextId };
      const marker = autoText.args?.Arg3 || "";
      if (marker) flags.add(`combat_marker:${marker}=1`);
      return {
        status: "resolved_inheritance_combat_via_autotext",
        autoTextId,
        marker,
        feedbackLines: narrativeLinesFromResultRecord(autoText),
      };
    }
    return { status: "started_combat_without_known_resolution" };
  }

  function applyResultEffects(sourceId, branch = {}) {
    const sideEffects = [];
    for (const result of branch.resolvedResults || []) {
      const args = result.args || {};
      const category = result.category || "";
      const action = result.action || "";
      const arg2 = args.Arg2 || "";
      const arg3 = args.Arg3 || "";
      const effect = {
        resultId: result.resultId || "",
        category,
        action,
        status: "ignored_text_only",
      };

      if (category === "narrative_feedback") {
        sideEffects.push(effect);
        continue;
      }

      if (action === "换人") {
        const fromId = arg2 || sourceId;
        const toId = arg3 || "";
        for (const [anchorId, replacementId] of replacementEntityById.entries()) {
          if (replacementId === fromId) replacementEntityById.set(anchorId, toId);
        }
        if (fromId && toId) replacementEntityById.set(fromId, toId);
        const didHide = hideEntity(fromId);
        const didAdd = addEntityToRoom(toId);
        if (didAdd) {
          if (npcMap.has(toId)) selectedChapterNpcId = toId;
          if (interactableMap.has(toId)) selectedChapterInteractableId = toId;
        }
        sideEffects.push({ ...effect, status: didHide || didAdd ? "applied_entity_swap" : "missing_entity_swap_args", fromId, toId });
        continue;
      }

      if (action === "添加人物") {
        const didAdd = addEntityToRoom(arg2);
        sideEffects.push({ ...effect, status: didAdd ? "applied_entity_add" : "missing_entity_add_arg", entityId: arg2 });
        continue;
      }

      if (action === "删除自身") {
        const didHide = hideEntity(sourceId);
        sideEffects.push({ ...effect, status: didHide ? "applied_hide_self" : "missing_source_for_hide_self", entityId: sourceId });
        continue;
      }

      if (action === "删除人物") {
        const didHide = hideEntity(arg2);
        sideEffects.push({ ...effect, status: didHide ? "applied_entity_delete" : "missing_entity_delete_arg", entityId: arg2 });
        continue;
      }

      if (category === "map_state" || action === "地图标记设置" || action === "地图标记变化") {
        if (arg2) {
          mapMarkers[arg2] = arg3 || "1";
          flags.add(`map_marker:${arg2}=${mapMarkers[arg2]}`);
          sideEffects.push({ ...effect, status: "applied_map_marker", marker: arg2, value: mapMarkers[arg2] });
          const clearEffect = applyChapterClearIfNeeded(result.resultId || "", result);
          if (clearEffect) sideEffects.push(clearEffect);
        } else {
          sideEffects.push({ ...effect, status: "missing_map_marker_arg" });
        }
        continue;
      }

      if (category === "attribute_reward" || action === "玩家属性变化") {
        const field = rewardAttributeMap[arg2] || arg2;
        const value = Number(arg3 || 0);
        if (field && Number.isFinite(value)) {
          applyNumericDeltas(player, { [field]: value });
          sideEffects.push({ ...effect, status: "applied_attribute_delta", field, value });
        } else {
          sideEffects.push({ ...effect, status: "missing_attribute_delta_args", field, value: arg3 });
        }
        continue;
      }

      if (category === "item_reward_or_cost" && action === "物品合成") {
        const ingredients = parseItemStackList(arg2);
        const productId = arg3 || "";
        if (ingredients.length && productId) {
          for (const ingredient of ingredients) applyInventoryDelta(ingredient.itemId, -ingredient.count);
          applyInventoryDelta(productId, 1);
          sideEffects.push({
            ...effect,
            status: "applied_item_crafting_recipe",
            ingredients,
            productId,
            feedbackLines: (args.Arg5 || "").split(";").filter(Boolean),
          });
        } else {
          sideEffects.push({ ...effect, status: "missing_item_crafting_recipe_args", ingredients, productId });
        }
        continue;
      }

      if (category === "item_reward_or_cost" || action === "玩家物品变化") {
        const didApply = applyInventoryDelta(arg2, arg3 || 1);
        sideEffects.push({ ...effect, status: didApply ? "applied_inventory_delta" : "missing_inventory_delta_arg", itemId: arg2, delta: arg3 || "1" });
        continue;
      }

      if (category === "skill_progression" || action === "玩家武功经验变化") {
        const delta = Number(arg3 || 0);
        if (arg2 && Number.isFinite(delta)) {
          player.skillExp[arg2] = Number(player.skillExp[arg2] || 0) + delta;
          flags.add(`skill_exp:${arg2}=${player.skillExp[arg2]}`);
          sideEffects.push({ ...effect, status: "applied_skill_exp_delta", skillId: arg2, delta, total: player.skillExp[arg2] });
        } else {
          sideEffects.push({ ...effect, status: "missing_skill_exp_args", skillId: arg2, delta: arg3 });
        }
        continue;
      }

      if (matchesOfficialMeritResult(result)) {
        const rawDelta = args.Arg2;
        const delta = rawDelta === "" || rawDelta === undefined || rawDelta === null
          ? Number(officialMeritPolicy.defaultDelta ?? 20)
          : Number(rawDelta);
        const gateField = officialMeritPolicy.gateField || "officialType";
        const targetField = officialMeritPolicy.playerField || "officialAchievement";
        const officialType = Number(player[gateField] || 0);
        const entry = {
          resultId: result.resultId || "",
          sourceId,
          action,
          delta,
          rawDelta,
          usedDefaultDelta: rawDelta === "" || rawDelta === undefined || rawDelta === null,
          gateField,
          gateValue: player[gateField] ?? 0,
          playerField: targetField,
          evidenceLevel: officialMeritPolicy.evidenceLevel || "lua_confirmed",
          sourceFile: officialMeritPolicy.dispatcherSource || result.sourceFile || "",
        };
        if (Number.isFinite(delta) && officialType !== 0) {
          player[targetField] = Number(player[targetField] || 0) + delta;
          entry.status = "applied_official_merit_delta";
          entry.total = player[targetField];
          flags.add(`merit:${targetField}=${player[targetField]}`);
        } else if (Number.isFinite(delta)) {
          entry.status = "skipped_official_merit_official_type_gate";
          entry.total = Number(player[targetField] || 0);
        } else {
          entry.status = "missing_official_merit_delta";
          entry.total = Number(player[targetField] || 0);
        }
        player.meritLedger.push(entry);
        sideEffects.push({ ...effect, status: entry.status, merit: clone(entry) });
        continue;
      }

      if (action === "可传承玩家标记设置") {
        if (arg2) {
          const value = arg3 || "1";
          player.inheritableMarkers[arg2] = value;
          flags.add(`inheritable_marker:${arg2}=${value}`);
          sideEffects.push({ ...effect, status: "applied_inheritable_marker", marker: arg2, value });
        } else {
          sideEffects.push({ ...effect, status: "missing_inheritable_marker_arg" });
        }
        continue;
      }

      if (category === "role_state" || action === "玩家标记设置" || action === "玩家标记变化") {
        if (arg2) {
          const value = arg3 || "1";
          flags.add(`player_marker:${arg2}=${value}`);
          sideEffects.push({ ...effect, status: "applied_player_marker", marker: arg2, value });
        } else {
          sideEffects.push({ ...effect, status: "missing_player_marker_arg" });
        }
        continue;
      }

      if (action === "玩家时间标记设置") {
        if (arg2) {
          const value = arg3 || "1";
          player.timeMarkers[arg2] = value;
          flags.add(`time_marker:${arg2}=${value}`);
          sideEffects.push({ ...effect, status: "applied_player_time_marker", marker: arg2, value });
        } else {
          sideEffects.push({ ...effect, status: "missing_player_time_marker_arg" });
        }
        continue;
      }

      if (action === "玩家定时标记设置") {
        if (arg2) {
          const value = arg3 || "1";
          const duration = args.Arg4 ?? "";
          player.timedMarkers[arg2] = { value, duration, setAtEventIndex: events.length };
          flags.add(`timed_marker:${arg2}=${value}`);
          sideEffects.push({ ...effect, status: "applied_player_timed_marker", marker: arg2, value, duration });
        } else {
          sideEffects.push({ ...effect, status: "missing_player_timed_marker_arg" });
        }
        continue;
      }

      if (action === "副本故事") {
        const feedbackLines = String(args.Arg2 || "")
          .split(";")
          .map((line) => line.trim())
          .filter(Boolean);
        sideEffects.push({
          ...effect,
          status: feedbackLines.length ? "applied_story_dialogue_feedback" : "missing_story_dialogue_text",
          feedbackLines,
          lineDurations: String(args.Arg3 || "").split(";").filter(Boolean),
        });
        continue;
      }

      if (action === "阻止玩家移动") {
        sideEffects.push({ ...effect, status: "recorded_navigation_stop" });
        continue;
      }

      if (action === "拜年" || action === "拜年委托" || /^bainian/.test(result.resultId || "")) {
        sideEffects.push({ ...effect, status: "scoped_out_seasonal_activity_module_disabled" });
        continue;
      }

      if (category === "combat") {
        const followup = combatFollowupForResult(sourceId, result);
        const followupSideEffects = followup.followupBranch ? applyResultEffects(sourceId, followup.followupBranch) : [];
        sideEffects.push({
          ...effect,
          status: followup.status,
          targetRoleId: arg2 || sourceId,
          autoTextId: arg3 || "",
          feedbackLines: clone(followup.feedbackLines || []),
          followupResultTokens: clone(followup.followupResultTokens || []),
          followupSideEffects: clone(followupSideEffects),
          conditionChecks: clone(followup.conditionChecks || []),
          marker: followup.marker || "",
        });
        continue;
      }

      sideEffects.push({ ...effect, status: "unimplemented_result_effect" });
    }
    return sideEffects;
  }

  function rewardClassDeltas(rewardClassId) {
    const rewardClass = rewardClasses[rewardClassId];
    if (!rewardClass) return { missing: true, deltas: {}, rows: [] };
    const deltas = {};
    for (const row of rewardClass.rows || []) {
      const targetField = rewardAttributeMap[row.rewardAttrName] || row.rewardAttrName;
      if (!targetField) continue;
      deltas[targetField] = Number(deltas[targetField] || 0) + Number(row.baseAward || 0);
    }
    return { missing: false, deltas, rows: clone(rewardClass.rows || []) };
  }

  function actionConditionsMet(action) {
    const required = action.requestPayload?.requiredState || "";
    if (required && !flags.has(required)) {
      return { accepted: false, reason: `missing flag ${required}` };
    }
    const minimums = action.requestPayload?.minimumPlayerValues || {};
    for (const [key, minimum] of Object.entries(minimums)) {
      if (Number(player[key] || 0) < Number(minimum)) {
        return { accepted: false, reason: `${key} requires ${minimum}` };
      }
    }
    const taskMinimums = action.requestPayload?.minimumTaskValues || {};
    for (const [key, minimum] of Object.entries(taskMinimums)) {
      if (Number(taskState[key] || 0) < Number(minimum)) {
        return { accepted: false, reason: `${key} requires ${minimum}` };
      }
    }
    return { accepted: true, reason: "ok" };
  }

  function snapshot() {
    const selectedRoom = selectedChapterRoomId ? roomMap.get(selectedChapterRoomId) : null;
    const selectedNpc = selectedChapterNpcId ? npcMap.get(selectedChapterNpcId) : null;
    const exitAvailability = (selectedRoom?.connections || []).map((connection) => {
      const blocker = transitionBlockerForRoom(connection.roomId);
      return {
        roomId: connection.roomId || "",
        direction: connection.direction || "",
        available: !blocker,
        blockerRoleId: blocker?.npc?.roleId || "",
        blockerName: blocker?.npc?.name || blocker?.npc?.displayName?.zhCN || "",
        conditionTokens: clone(blocker?.branch?.conditionTokens || []),
        feedbackLines: clone(blocker?.branch?.narrativeLines || []),
        evidence: clone(blocker?.npc?.evidence || {}),
      };
    });
    const chapterSnapshot = {
      chapterId: activeChapter?.chapterId || "",
      nodes: activeChapter?.nodes || [],
      rooms: activeChapter?.rooms || [],
      npcs: activeChapter?.npcs || [],
      interactables: activeChapter?.interactables || [],
      selectedNodeId: selectedChapterNodeId,
      selectedNode: selectedChapterNodeId ? clone(nodeMap.get(selectedChapterNodeId) || null) : null,
      selectedRoomId: selectedChapterRoomId,
      selectedRoom: clone(selectedRoom || null),
      selectedNpcId: selectedChapterNpcId,
      selectedNpc: clone(selectedNpc || null),
      selectedNpcActionAvailability: selectedNpc
        ? selectedNpc.actions.map((action) => npcActionAvailability(selectedNpc, action.actionType))
        : [],
      selectedInteractableId: selectedChapterInteractableId,
      selectedInteractable: selectedChapterInteractableId ? clone(interactableMap.get(selectedChapterInteractableId) || null) : null,
      selectedInteractableActionAvailability: selectedChapterInteractableId
        ? (interactableMap.get(selectedChapterInteractableId)?.actions || []).map((action) => (
          interactableActionAvailability(interactableMap.get(selectedChapterInteractableId), action.actionType)
        ))
        : [],
      hiddenEntityIds: [...hiddenEntityIds].sort(),
      dynamicEntityIdsByRoom: Object.fromEntries([...addedEntityIdsByRoom.entries()].map(([roomId, set]) => [roomId, [...set].sort()])),
      replacementEntityById: Object.fromEntries([...replacementEntityById.entries()].sort(([left], [right]) => left.localeCompare(right))),
      mapMarkers: clone(mapMarkers),
      exitAvailability,
    };
    return {
      schema: contract?.schema || "",
      currentState,
      state: states.get(currentState) || null,
      availableActions: actionsByState.get(currentState) || [],
      flags: [...flags].sort(),
      player: clone(player),
      taskState: clone(taskState),
      chapter: chapterSnapshot,
      chapter1: chapterSnapshot,
      pendingCombat: clone(pendingCombat),
      events: [...events],
    };
  }

  function exportSaveState() {
    return {
      $schema: "idlewuxia.first_session_runtime_save.v1",
      runtimeSchema: contract?.schema || "",
      chapterId: activeChapter?.chapterId || "",
      currentState,
      flags: [...flags].sort(),
      player: clone(player),
      taskState: clone(taskState),
      selectedChapterNodeId,
      selectedChapterRoomId,
      selectedChapterNpcId,
      selectedChapterInteractableId,
      hiddenEntityIds: [...hiddenEntityIds].sort(),
      addedEntityIdsByRoom: Object.fromEntries([...addedEntityIdsByRoom.entries()].map(([roomId, set]) => [roomId, [...set].sort()])),
      replacementEntityById: Object.fromEntries([...replacementEntityById.entries()].sort(([left], [right]) => left.localeCompare(right))),
      mapMarkers: clone(mapMarkers),
      pendingCombat: clone(pendingCombat),
      events: clone(events),
    };
  }

  function dispatch(actionId) {
    const action = actions.get(actionId);
    if (!action) {
      const event = { type: "commandRejected", actionId, reason: "unknown action" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (action.fromState !== currentState) {
      const event = {
        type: "commandRejected",
        actionId,
        reason: `state mismatch: current=${currentState} expected=${action.fromState}`,
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const condition = actionConditionsMet(action);
    if (!condition.accepted) {
      const event = {
        type: "commandRejected",
        actionId,
        reason: condition.reason,
        feedback: action.failureFeedback || condition.reason,
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const combatResolution = action.responseModel?.resolvePendingCombat && pendingCombat
      ? resolvePendingCombat(action.responseModel?.combatOutcome || "success")
      : null;
    if (combatResolution && !combatResolution.accepted) {
      const event = {
        type: "commandRejected",
        actionId,
        reason: combatResolution.reason,
        feedback: combatResolution.reason,
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const grant = action.responseModel?.grantState || "";
    const grants = action.responseModel?.grantStates || [];
    if (grant) flags.add(grant);
    for (const granted of grants) {
      if (granted) flags.add(granted);
    }
    for (const revoked of action.responseModel?.revokeStates || []) flags.delete(revoked);
    Object.assign(player, action.responseModel?.profilePatch || {});
    const rewardClassId = action.responseModel?.rewardClassId || "";
    const rewardResult = rewardClassId ? rewardClassDeltas(rewardClassId) : { missing: false, deltas: {}, rows: [] };
    if (rewardResult.missing) {
      const event = {
        type: "commandRejected",
        actionId,
        reason: `missing reward class ${rewardClassId}`,
        feedback: `missing reward class ${rewardClassId}`,
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const statDeltas = {
      ...(action.responseModel?.statDeltas || {}),
      ...rewardResult.deltas,
    };
    applyNumericDeltas(player, statDeltas);
    Object.assign(taskState, action.responseModel?.taskPatch || {});
    for (const [key, delta] of Object.entries(action.responseModel?.taskCounterDeltas || {})) {
      taskState[key] = Number(taskState[key] || 0) + Number(delta || 0);
    }
    if (action.requestPayload?.nodeId && nodeMap.has(action.requestPayload.nodeId)) {
      selectedChapterNodeId = action.requestPayload.nodeId;
    }
    currentState = action.toState || currentState;
    const event = {
      type: "commandAccepted",
      actionId,
      serverCommand: action.serverCommand,
      grant,
      grants: clone(grants),
      currentState,
      feedback: action.responseModel?.feedback || "",
      visualCueIds: clone(action.responseModel?.visualCueIds || []),
      statDeltas: clone(statDeltas),
      rewardClassId,
      rewardRows: clone(rewardResult.rows),
      combatResolution: clone(combatResolution),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function selectChapterNode(nodeId) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      const event = { type: "nodeRejected", nodeId, reason: "unknown node" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const gates = (node.gates || []).map((gateId) => gateMap.get(gateId) || { gateId, missing: true });
    const rewards = (node.rewards || []).map((rewardId) => rewardMap.get(rewardId) || { rewardId, missing: true });
    const rooms = (node.sourceRooms || []).map((roomId) => roomMap.get(roomId) || { roomId, missing: true });
    selectedChapterNodeId = nodeId;
    selectedChapterRoomId = rooms.find((room) => room && !room.missing)?.roomId || "";
    selectedChapterNpcId = "";
    selectedChapterInteractableId = "";
    const event = {
      type: "nodeSelected",
      nodeId,
      displayText: node.displayText,
      rooms,
      gates,
      encounters: node.encounters || [],
      rewards,
      connections: clone(node.connections || []),
      sourceRooms: clone(node.sourceRooms || []),
      sourceRoomNames: clone(node.sourceRoomNames || []),
      interactables: clone(node.interactables || []),
      interactableNames: clone(node.interactableNames || []),
      progressFlags: clone(node.progressFlags || []),
      evidence: clone(node.evidence || {}),
      primaryAction: node.primaryAction || null,
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function selectChapterRoom(roomId) {
    const room = roomMap.get(roomId);
    if (!room) {
      const event = { type: "roomRejected", roomId, reason: "unknown room" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const blocker = transitionBlockerForRoom(roomId);
    if (blocker) {
      const feedbackLines = blocker.branch?.narrativeLines?.length
        ? blocker.branch.narrativeLines
        : [`${blocker.npc.name || blocker.npc.displayName?.zhCN || "有人"}拦住了你。`];
      const sideEffects = applyResultEffects(blocker.npc.roleId, blocker.branch);
      const event = {
        type: "roomBlocked",
        roomId: selectedChapterRoomId,
        targetRoomId: roomId,
        sourceRoleId: blocker.npc.roleId,
        sourceName: blocker.npc.name || blocker.npc.displayName?.zhCN || "",
        feedback: feedbackLines.join("\n"),
        feedbackLines: clone(feedbackLines),
        conditionTokens: clone(blocker.branch?.conditionTokens || []),
        resultTokens: clone(blocker.branch?.resultTokens || []),
        sideEffects: clone(sideEffects),
        evidence: clone(blocker.npc.evidence || {}),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    selectedChapterRoomId = roomId;
    selectedChapterNpcId = "";
    selectedChapterInteractableId = "";
    if (room.parentNodeId && nodeMap.has(room.parentNodeId)) {
      selectedChapterNodeId = room.parentNodeId;
    }
    const event = {
      type: "roomSelected",
      roomId,
      parentNodeId: room.parentNodeId || "",
      displayText: room.displayName || {},
      connections: clone(room.connections || []),
      gates: clone(room.gates || []),
      encounterIds: clone(room.encounterIds || []),
      encounterNames: clone(room.encounterNames || []),
      interactableIds: clone(room.interactableIds || []),
      interactableNames: clone(room.interactableNames || []),
      rewardIds: clone(room.rewardIds || []),
      fightBackground: room.fightBackground || "",
      roomBgm: room.roomBgm || "",
      evidence: clone(room.evidence || {}),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function currentRoomHasNpc(roleId) {
    if (!selectedChapterRoomId) return true;
    const room = roomMap.get(selectedChapterRoomId);
    return new Set(roomEntityIds(room)).has(roleId) && npcMap.has(roleId);
  }

  function currentRoomHasInteractable(interactableId) {
    if (!selectedChapterRoomId) return true;
    const room = roomMap.get(selectedChapterRoomId);
    return new Set(roomEntityIds(room)).has(interactableId) && interactableMap.has(interactableId);
  }

  function selectChapterNpc(roleId) {
    const npc = npcMap.get(roleId);
    if (!npc) {
      const event = { type: "npcRejected", roleId, reason: "unknown npc" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (!currentRoomHasNpc(roleId)) {
      const event = { type: "npcRejected", roleId, reason: "npc is not in selected room" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    selectedChapterNpcId = roleId;
    selectedChapterInteractableId = "";
    const event = {
      type: "npcSelected",
      roleId,
      name: npc.name || npc.displayName?.zhCN || "",
      actions: clone(npc.actions || []),
      defaultNarrativeLines: clone(npc.defaultNarrativeLines || []),
      evidence: clone(npc.evidence || {}),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function selectChapterInteractable(interactableId) {
    const item = interactableMap.get(interactableId);
    if (!item) {
      const event = { type: "interactableRejected", interactableId, reason: "unknown interactable" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (!currentRoomHasInteractable(interactableId)) {
      const event = { type: "interactableRejected", interactableId, reason: "interactable is not in selected room" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (!item.canSee) {
      const event = { type: "interactableRejected", interactableId, reason: "interactable is hidden by canSee=0" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    selectedChapterNpcId = "";
    selectedChapterInteractableId = interactableId;
    const event = {
      type: "interactableSelected",
      interactableId,
      name: item.name || item.displayName?.zhCN || "",
      description: item.description || "",
      actions: clone(item.actions || []),
      defaultNarrativeLines: clone(item.defaultNarrativeLines || []),
      evidence: clone(item.evidence || {}),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function branchForNpcAction(npc, actionType) {
    const branches = (npc?.branches || []).filter(branchEnabledInFirstSession);
    const exactBranches = branches.filter((branch) => (branch.actionHints || []).includes(actionType));
    const exact = exactBranches.find((branch) => branchConditionsMet(branch, { actionType }).accepted);
    if (exact) return exact;
    // A configured action branch that fails its conditions is not eligible for
    // a narrative/effect fallback. This prevents post-combat dialogue from
    // leaking before its comparewin condition has actually been recorded.
    if (exactBranches.length) return null;
    if (actionType === "talk") {
      return talkBranches(npc).find((branch) => (
        branch.narrativeLines?.length
        && branchConditionsMet(branch, { actionType }).accepted
      ))
        || (npc.defaultNarrativeLines?.length
          ? {
            conditionTokens: ["words"],
            resultTokens: [],
            narrativeLines: npc.defaultNarrativeLines,
            evidenceLevel: "lua_confirmed",
            matchPolicy: "default_words",
          }
          : null)
        || branches[0]
        || null;
    }
    return null;
  }

  function talkBranches(npc) {
    return (npc?.branches || [])
      .filter(branchEnabledInFirstSession)
      .filter((branch) => !(branch.actionHints || []).length)
      // `gorome*` is a movement interception condition, not a dialogue route.
      // Outcome branches must likewise wait for FightResult to supply them.
      .filter((branch) => !(branch.conditionTokens || []).some((token) => (
        String(token || "").startsWith("gorome")
        || ["comparewin", "comparelose", "comparerunaway"].includes(token)
      )));
  }

  function configuredBranchDecision(candidateBranches, context = {}, sourceEvidenceLevel = "unknown") {
    if (!candidateBranches.length) {
      return {
        branch: null,
        available: true,
        reason: "",
        checks: [],
        evidenceLevel: evidenceLevelOrUnknown(sourceEvidenceLevel),
      };
    }
    const evaluations = candidateBranches.map((branch) => ({
      branch,
      evaluation: branchConditionsMet(branch, context),
    }));
    const accepted = evaluations.find(({ evaluation }) => evaluation.accepted);
    if (accepted) {
      return {
        branch: accepted.branch,
        available: true,
        reason: "",
        checks: clone(accepted.evaluation.checks || []),
        conditionTokens: clone(accepted.branch.conditionTokens || []),
        evidenceLevel: evidenceLevelOrUnknown(accepted.branch.evidenceLevel, sourceEvidenceLevel),
      };
    }
    const first = evaluations[0];
    return {
      branch: null,
      available: false,
      reason: "configured action conditions are not met",
      checks: clone(first?.evaluation?.checks || []),
      conditionTokens: clone(first?.branch?.conditionTokens || []),
      evidenceLevel: evidenceLevelOrUnknown(first?.branch?.evidenceLevel, sourceEvidenceLevel),
    };
  }

  function npcActionAvailability(npc, actionType) {
    const action = (npc?.actions || []).find((item) => item.actionType === actionType);
    if (!action) return { actionType, available: false, reason: "npc action unavailable", checks: [] };
    const combatPolicy = combatPolicyForAction(actionType);
    const exactBranches = (npc?.branches || [])
      .filter(branchEnabledInFirstSession)
      .filter((branch) => (branch.actionHints || []).includes(actionType));
    const candidateBranches = exactBranches.length
      ? exactBranches
      : (actionType === "talk" ? talkBranches(npc) : []);
    const combatOutcomeTokens = combatPolicy
      ? [combatPolicy.successConditionToken, combatPolicy.failureConditionToken, combatPolicy.runawayConditionToken].filter(Boolean)
      : [];
    const sourceEvidenceLevel = evidenceLevelOrUnknown(
      action.evidenceLevel,
      action.evidence?.level,
      npc?.evidence?.level,
      combatPolicy?.evidence?.level,
    );
    const { branch: _branch, ...availability } = configuredBranchDecision(
      candidateBranches,
      { actionType, ignoreConditionTokens: combatOutcomeTokens },
      sourceEvidenceLevel,
    );
    return {
      actionType,
      ...availability,
    };
  }

  function combatPolicyForAction(actionType) {
    return combatActionPolicies[actionType] || null;
  }

  function beginPendingCombat(sourceId, actionType, policy) {
    if (!policy?.startActionId) return { accepted: false, reason: "missing combat start action policy" };
    pendingCombat = {
      sourceId,
      sourceKind: "npc",
      actionType,
      // The map action policy owns resolution. The player UI must not invent a
      // separate "continue" command after the configured timeline completes.
      resolveActionId: policy.resolveActionId || "",
      successConditionToken: policy.successConditionToken || "",
      failureConditionToken: policy.failureConditionToken || "",
      runawayConditionToken: policy.runawayConditionToken || "",
      startedFromState: currentState,
      evidence: clone(policy.evidence || {}),
    };
    const transition = dispatch(policy.startActionId);
    if (!transition.accepted) pendingCombat = null;
    return transition;
  }

  function resolvePendingCombat(outcome = "success") {
    if (!pendingCombat) return { accepted: false, reason: "no pending combat", sideEffects: [] };
    const source = npcMap.get(pendingCombat.sourceId) || null;
    const outcomeToken = outcome === "success"
      ? pendingCombat.successConditionToken
      : outcome === "runaway"
        ? pendingCombat.runawayConditionToken
        : pendingCombat.failureConditionToken;
    const branch = outcomeToken && source
      ? (source.branches || []).find((candidate) => (
        (candidate.conditionTokens || []).includes(outcomeToken)
        && branchConditionsMet(candidate, { satisfiedCombatToken: outcomeToken }).accepted
      ))
      : null;
    const sideEffects = branch ? applyResultEffects(pendingCombat.sourceId, branch) : [];
    const resolution = {
      accepted: Boolean(branch),
      outcome,
      outcomeToken,
      sourceId: pendingCombat.sourceId,
      feedbackLines: clone(branch?.narrativeLines || []),
      resultTokens: clone(branch?.resultTokens || []),
      sideEffects: clone(sideEffects),
      reason: branch ? "" : `missing combat outcome branch ${outcomeToken || outcome}`,
    };
    events.push({ type: "combatResolved", ...clone(resolution) });
    pendingCombat = null;
    return resolution;
  }

  function globalNpcActionFeedback(npc, action) {
    const name = npc.name || npc.displayName?.zhCN || "\u5bf9\u65b9";
    const label = action.label || action.actionType || "\u64cd\u4f5c";
    if (action.actionType === "sale" && npc.saleList) {
      return {
        lines: [`${name}\u6253\u5f00\u4e86\u4ea4\u6613\u5217\u8868\u3002`, `\u53ef\u4ea4\u6613\u7269\u54c1\uff1a${npc.saleList}`],
        evidenceLevel: "config_confirmed_global_action",
      };
    }
    if (action.actionType === "present") {
      return {
        lines: npc.receivePresent
          ? [`\u8bf7\u9009\u62e9\u8981\u8d60\u9001\u7ed9${name}\u7684\u7269\u54c1\u3002`, `\u4e13\u5c5e\u6536\u793c\u7269\u54c1\uff1a${npc.receivePresent}`]
          : [`\u8bf7\u9009\u62e9\u8981\u8d60\u9001\u7ed9${name}\u7684\u7269\u54c1\u3002`],
        evidenceLevel: "config_confirmed_global_action",
      };
    }
    if (action.actionType === "compete") {
      return {
        lines: [`\u4f60\u5411${name}\u63d0\u51fa\u5207\u78cb\u3002`],
        evidenceLevel: "config_confirmed_global_action",
      };
    }
    if (action.actionType === "kill") {
      return {
        lines: [`\u4f60\u5411${name}\u53d1\u8d77\u653b\u51fb\u3002`],
        evidenceLevel: "config_confirmed_global_action",
      };
    }
    if (action.actionType === "apprentice") {
      return {
        lines: [`\u4f60\u5411${name}\u63d0\u51fa\u62dc\u5e08\u3002`],
        evidenceLevel: "config_confirmed_global_action",
      };
    }
    return {
      lines: [`${label}\u6ca1\u6709\u914d\u7f6e\u53ef\u64ad\u653e\u53cd\u9988\u3002`],
      evidenceLevel: "unknown_no_branch",
    };
  }

  function interactableBranchesForAction(item, actionType) {
    const branches = (item?.branches || []).filter(branchEnabledInFirstSession);
    const exactBranches = branches.filter((branch) => (branch.actionHints || []).includes(actionType));
    if (exactBranches.length) return exactBranches;
    return branches.filter((branch) => !(branch.actionHints || []).length);
  }

  function interactableActionDecision(item, actionType) {
    const action = (item?.actions || []).find((candidate) => candidate.actionType === actionType);
    if (!action) return { actionType, available: false, reason: "interactable action unavailable", checks: [] };
    const candidateBranches = interactableBranchesForAction(item, actionType);
    const sourceEvidenceLevel = evidenceLevelOrUnknown(
      action.evidenceLevel,
      action.evidence?.level,
      item?.evidence?.level,
    );
    return {
      actionType,
      ...configuredBranchDecision(candidateBranches, { actionType }, sourceEvidenceLevel),
    };
  }

  function interactableActionAvailability(item, actionType) {
    const { branch: _branch, ...availability } = interactableActionDecision(item, actionType);
    return availability;
  }

  function interactWithChapterNpc(roleId, actionType = "talk") {
    const npc = npcMap.get(roleId);
    if (!npc) {
      const event = { type: "npcInteractionRejected", roleId, actionType, reason: "unknown npc" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (!currentRoomHasNpc(roleId)) {
      const event = { type: "npcInteractionRejected", roleId, actionType, reason: "npc is not in selected room" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const action = (npc.actions || []).find((item) => item.actionType === actionType);
    if (!action) {
      const event = { type: "npcInteractionRejected", roleId, actionType, reason: "npc action unavailable" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const availability = npcActionAvailability(npc, actionType);
    if (!availability.available) {
      const event = {
        type: "npcInteractionRejected",
        roleId,
        actionType,
        reason: availability.reason,
        feedback: availability.reason,
        conditionTokens: clone(availability.conditionTokens || []),
        conditionChecks: clone(availability.checks || []),
        evidenceLevel: evidenceLevelOrUnknown(availability.evidenceLevel),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    selectedChapterNpcId = roleId;
    selectedChapterInteractableId = "";
    const branch = branchForNpcAction(npc, actionType);
    const combatPolicy = combatPolicyForAction(actionType);
    if (combatPolicy) {
      const fallback = globalNpcActionFeedback(npc, action);
      const event = {
        type: "npcInteraction",
        roleId,
        actionType,
        actionLabel: action.label || "",
        name: npc.name || npc.displayName?.zhCN || "",
        feedback: fallback.lines.join("\n"),
        feedbackLines: clone(fallback.lines),
        conditionTokens: [],
        resultTokens: [],
        sideEffects: [{ status: "pending_combat", actionType }],
        evidence: clone(npc.evidence || {}),
        evidenceLevel: combatPolicy.evidence?.level || fallback.evidenceLevel,
      };
      events.push(event);
      const transition = beginPendingCombat(roleId, actionType, combatPolicy);
      if (!transition.accepted) {
        event.type = "npcInteractionRejected";
        event.reason = transition.event?.reason || transition.reason || "combat transition rejected";
        return { accepted: false, event, snapshot: snapshot() };
      }
      return { accepted: true, event, snapshot: snapshot() };
    }
    const fallback = branch?.narrativeLines?.length ? null : globalNpcActionFeedback(npc, action);
    const sideEffects = branch ? applyResultEffects(roleId, branch) : [];
    const sideEffectFeedbackLines = sideEffects.flatMap((effect) => [
      ...(effect.feedbackLines || []),
      ...((effect.followupSideEffects || []).flatMap((followup) => followup.feedbackLines || [])),
    ]).filter(Boolean);
    const feedbackLines = branch?.narrativeLines?.length
      ? branch.narrativeLines
      : (sideEffectFeedbackLines.length ? sideEffectFeedbackLines : fallback.lines);
    const event = {
      type: "npcInteraction",
      roleId,
      actionType,
      actionLabel: action.label || "",
      name: npc.name || npc.displayName?.zhCN || "",
      feedback: feedbackLines.join("\n"),
      feedbackLines: clone(feedbackLines),
      conditionTokens: clone(branch?.conditionTokens || []),
      resultTokens: clone(branch?.resultTokens || []),
      sideEffects: clone(sideEffects),
      evidence: clone(npc.evidence || {}),
      evidenceLevel: evidenceLevelOrUnknown(
        branch?.evidenceLevel,
        action.evidenceLevel,
        action.evidence?.level,
        npc?.evidence?.level,
        fallback?.evidenceLevel,
      ),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function interactWithChapterInteractable(interactableId, actionType = "use") {
    const item = interactableMap.get(interactableId);
    if (!item) {
      const event = { type: "interactableInteractionRejected", interactableId, actionType, reason: "unknown interactable" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (!currentRoomHasInteractable(interactableId)) {
      const event = { type: "interactableInteractionRejected", interactableId, actionType, reason: "interactable is not in selected room" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    if (!item.canSee) {
      const event = { type: "interactableInteractionRejected", interactableId, actionType, reason: "interactable is hidden by canSee=0" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const action = (item.actions || []).find((candidate) => candidate.actionType === actionType);
    if (!action) {
      const event = { type: "interactableInteractionRejected", interactableId, actionType, reason: "interactable action unavailable" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const decision = interactableActionDecision(item, actionType);
    if (!decision.available) {
      const event = {
        type: "interactableInteractionRejected",
        interactableId,
        actionType,
        reason: decision.reason,
        feedback: decision.reason,
        conditionTokens: clone(decision.conditionTokens || []),
        conditionChecks: clone(decision.checks || []),
        evidenceLevel: evidenceLevelOrUnknown(decision.evidenceLevel),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    selectedChapterNpcId = "";
    selectedChapterInteractableId = interactableId;
    const branch = decision.branch;
    const interactableName = item.name || item.displayName?.zhCN || "\u7269\u4ef6";
    const fallbackLine = item.description
      ? `${interactableName}\uff1a${item.description}`
      : `${interactableName}\u6ca1\u6709\u66f4\u591a\u53cd\u5e94\u3002`;
    const sideEffects = branch ? applyResultEffects(interactableId, branch) : [];
    const sideEffectFeedbackLines = sideEffects.flatMap((effect) => [
      ...(effect.feedbackLines || []),
      ...((effect.followupSideEffects || []).flatMap((followup) => followup.feedbackLines || [])),
    ]).filter(Boolean);
    const feedbackLines = branch?.narrativeLines?.length
      ? branch.narrativeLines
      : (sideEffectFeedbackLines.length ? sideEffectFeedbackLines : [fallbackLine]);
    const event = {
      type: "interactableInteraction",
      interactableId,
      actionType,
      actionLabel: action.label || "",
      name: item.name || item.displayName?.zhCN || "",
      description: item.description || "",
      feedback: feedbackLines.join("\n"),
      feedbackLines: clone(feedbackLines),
      conditionTokens: clone(branch?.conditionTokens || []),
      resultTokens: clone(branch?.resultTokens || []),
      sideEffects: clone(sideEffects),
      evidence: clone(item.evidence || {}),
      evidenceLevel: evidenceLevelOrUnknown(
        branch?.evidenceLevel,
        action.evidenceLevel,
        action.evidence?.level,
        item?.evidence?.level,
      ),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  return {
    snapshot,
    exportSaveState,
    dispatch,
    selectChapterNode,
    selectChapterRoom,
    selectChapterNpc,
    interactWithChapterNpc,
    selectChapterInteractable,
    interactWithChapterInteractable,
    resolvePendingCombat,
  };
}

export function summarizeFirstSessionContract(contract) {
  const activeChapter = resolveActiveChapter(contract);
  return {
    schema: contract?.schema || "",
    states: contract?.states?.length || 0,
    actions: contract?.actions?.length || 0,
    chapterNodes: activeChapter?.nodes?.length || 0,
    chapterRooms: activeChapter?.rooms?.length || 0,
    chapterNpcs: activeChapter?.npcs?.length || 0,
    chapterInteractables: activeChapter?.interactables?.length || 0,
    gates: activeChapter?.gates?.length || 0,
    rewards: activeChapter?.rewards?.length || 0,
  };
}

