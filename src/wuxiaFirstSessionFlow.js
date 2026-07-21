import { cloneData } from "./dataClone.js";
import { createConditionEvaluator } from "./conditionEvaluator.js";
import { createEntityInteractionService } from "./entityInteractionService.js";
import { createNavigationService } from "./navigationService.js";
import { createResultEffectExecutor } from "./resultEffectExecutor.js";
import { createResultPreparation } from "./resultPreparation.js";
import { isValidPendingChoice } from "./resultExecutionModules.js";

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
  const conditionEvaluator = createConditionEvaluator({ conditionLookup, rewardAttributeMap });
  const navigationService = createNavigationService({
    nodeLookup: nodeMap,
    roomLookup: roomMap,
    npcLookup: npcMap,
    gateLookup: gateMap,
    rewardLookup: rewardMap,
    conditionLookup,
    resultLookup,
    navigationPolicy: contract?.chapterSystem?.navigationPolicy || {},
  });
  const resultEffectPolicies = contract?.chapterSystem?.resultEffectPolicies || {};
  const combatActionPolicies = contract?.chapterSystem?.combatActionPolicies || {};
  const seasonalActivityPolicy = resultEffectPolicies.seasonalActivity || {};
  const inventoryMutationPolicy = resultEffectPolicies.inventoryMutation || {};
  const choiceResultPolicy = resultEffectPolicies.choiceResult || {};
  const resultSetPolicy = resultEffectPolicies.resultSet || {};
  const skillConversionPolicy = resultEffectPolicies.skillConversion || {};
  const resultPreparation = createResultPreparation({
    resultLookup,
    resultSetPolicy,
    skillConversionPolicy,
    choiceResultPolicy,
    seasonalActivityPolicy,
    inventoryMutationPolicy,
  });
  const entityInteractionService = createEntityInteractionService({
    npcLookup: npcMap,
    interactableLookup: interactableMap,
    entityInteractionPolicy: contract?.chapterSystem?.entityInteractionPolicy || {},
    combatActionPolicies,
    branchEnabled: (branch) => resultPreparation.isBranchEnabled(branch),
    evaluateBranch: (branch, context) => conditionEvaluator.evaluateBranch(branch, {
      ...context,
      player,
      mapMarkers,
    }),
    branchRequiresChoice: (branch) => resultPreparation.requiresChoiceUi(branch),
    validateBranch: (branch) => resultPreparation.prepare(branch, player),
  });
  const chapterClearPolicy = contract?.chapterSystem?.chapterClearPolicy || {};
  const resultEffectExecutor = createResultEffectExecutor({
    resultLookup,
    npcLookup: npcMap,
    interactableLookup: interactableMap,
    rewardAttributeMap,
    resultEffectPolicies,
    chapterClearPolicy,
    evaluateBranch: (branch, context) => conditionEvaluator.evaluateBranch(branch, context),
  });
  const candidateSaveState = options.initialSaveState || null;
  const saveState = candidateSaveState
    && candidateSaveState.runtimeSchema === (contract?.schema || "")
    && (!candidateSaveState.chapterId || candidateSaveState.chapterId === (activeChapter?.chapterId || ""))
    ? candidateSaveState
    : {};
  const initialFlags = Array.isArray(saveState.flags)
    ? saveState.flags
    : (options.initialFlags || ["new_install_or_new_save"]);
  let flags = new Set(initialFlags);
  const requestedState = saveState.currentState || options.initialState || contract?.states?.[0]?.stateId || "";
  let currentState = states.has(requestedState) ? requestedState : (options.initialState || contract?.states?.[0]?.stateId || "");
  let selectedChapterNodeId = nodeMap.has(saveState.selectedChapterNodeId) ? saveState.selectedChapterNodeId : "";
  let selectedChapterRoomId = roomMap.has(saveState.selectedChapterRoomId) ? saveState.selectedChapterRoomId : "";
  let selectedChapterNpcId = npcMap.has(saveState.selectedChapterNpcId) ? saveState.selectedChapterNpcId : "";
  let selectedChapterInteractableId = interactableMap.has(saveState.selectedChapterInteractableId) ? saveState.selectedChapterInteractableId : "";
  const events = cloneData(Array.isArray(saveState.events) ? saveState.events : []);
  let player = cloneData(saveState.player || options.initialPlayer || contract?.playerSeed || {});
  player.inventory = cloneData(player.inventory || {});
  player.skillExp = cloneData(player.skillExp || {});
  player.skillMoveExp = cloneData(player.skillMoveExp || {});
  player.skillLevels = cloneData(player.skillLevels || player.skills || {});
  player.markers = cloneData(player.markers || {});
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
  let hiddenEntityIds = new Set(saveState.hiddenEntityIds || options.initialHiddenEntityIds || []);
  let addedEntityIdsByRoom = new Map();
  for (const [roomId, entityIds] of Object.entries(saveState.addedEntityIdsByRoom || {})) {
    addedEntityIdsByRoom.set(roomId, new Set(entityIds || []));
  }
  let replacementEntityById = new Map();
  for (const [entityId, replacementId] of Object.entries(saveState.replacementEntityById || {})) {
    replacementEntityById.set(entityId, replacementId);
  }
  let mapMarkers = { ...(saveState.mapMarkers || options.initialMapMarkers || {}) };
  let pendingCombat = cloneData(saveState.pendingCombat || null);
  let pendingChoice = isValidPendingChoice(saveState.pendingChoice)
    ? cloneData(saveState.pendingChoice)
    : null;

  function captureEffectState() {
    return {
      player,
      flags,
      hiddenEntityIds,
      addedEntityIdsByRoom,
      replacementEntityById,
      mapMarkers,
      pendingChoice,
      selectedChapterNpcId,
      selectedChapterInteractableId,
    };
  }

  function adoptEffectState(nextState) {
    player = nextState.player;
    flags = nextState.flags;
    hiddenEntityIds = nextState.hiddenEntityIds;
    addedEntityIdsByRoom = nextState.addedEntityIdsByRoom;
    replacementEntityById = nextState.replacementEntityById;
    mapMarkers = nextState.mapMarkers;
    pendingChoice = nextState.pendingChoice;
    selectedChapterNpcId = nextState.selectedChapterNpcId;
    selectedChapterInteractableId = nextState.selectedChapterInteractableId;
  }

  function commitResultEffects(sourceId, branch = {}, stateOverrides = {}) {
    const transaction = resultEffectExecutor.commit({
      sourceId,
      currentRoomId: selectedChapterRoomId,
      preparedBranch: branch,
      state: { ...captureEffectState(), ...stateOverrides },
      eventIndex: events.length,
    });
    if (transaction.accepted) adoptEffectState(transaction.state);
    return transaction;
  }

  function clone(value) {
    return cloneData(value);
  }

  function applyNumericDeltas(target, deltas = {}) {
    for (const [key, delta] of Object.entries(deltas)) {
      target[key] = Number(target[key] || 0) + Number(delta || 0);
    }
  }

  function roomEntityIds(room) {
    return entityInteractionService.activeEntityIdsForRoom(room, {
      hiddenEntityIds,
      addedEntityIdsByRoom,
      replacementEntityById,
    });
  }

  function validateResultEffects(branch = {}) {
    return resultPreparation.prepare(branch, player);
  }

  function resultRecord(resultId = "") {
    return resultPreparation.resolveRecord(resultId);
  }

  function narrativeLinesFromResultRecord(record) {
    return resultPreparation.narrativeLines(record);
  }

  function branchConditionsMet(branch, context = {}) {
    return conditionEvaluator.evaluateBranch(branch, {
      ...context,
      player,
      mapMarkers,
    });
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
      const actual = Number(player[key] || 0);
      const expected = Number(minimum);
      if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
        return { accepted: false, reason: `invalid numeric condition for ${key}` };
      }
      if (actual < expected) {
        return { accepted: false, reason: `${key} requires ${minimum}` };
      }
    }
    const taskMinimums = action.requestPayload?.minimumTaskValues || {};
    for (const [key, minimum] of Object.entries(taskMinimums)) {
      const actual = Number(taskState[key] || 0);
      const expected = Number(minimum);
      if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
        return { accepted: false, reason: `invalid numeric condition for ${key}` };
      }
      if (actual < expected) {
        return { accepted: false, reason: `${key} requires ${minimum}` };
      }
    }
    return { accepted: true, reason: "ok" };
  }

  function snapshot() {
    const selectedRoom = selectedChapterRoomId ? roomMap.get(selectedChapterRoomId) : null;
    const selectedNpc = selectedChapterNpcId ? npcMap.get(selectedChapterNpcId) : null;
    const exitAvailability = navigationService.exitAvailability({
      currentRoomId: selectedChapterRoomId,
      roomEntityIds: roomEntityIds(selectedRoom),
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
      state: clone(states.get(currentState) || null),
      availableActions: clone(actionsByState.get(currentState) || []),
      flags: [...flags].sort(),
      player: clone(player),
      taskState: clone(taskState),
      chapter: chapterSnapshot,
      chapter1: chapterSnapshot,
      pendingCombat: clone(pendingCombat),
      pendingChoice: clone(pendingChoice),
      events: clone(events),
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
      pendingChoice: clone(pendingChoice),
      events: clone(events),
    };
  }

  function rejectCommandWhileChoicePending(commandType, detail = {}) {
    if (!pendingChoice) return null;
    const event = {
      type: `${commandType}Rejected`,
      ...detail,
      reason: "pending choice must be resolved first",
      choiceId: pendingChoice.choiceId,
    };
    events.push(event);
    return { accepted: false, event, snapshot: snapshot() };
  }

  function dispatch(actionId) {
    const choiceBlock = rejectCommandWhileChoicePending("dispatch", { actionId });
    if (choiceBlock) return choiceBlock;
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
    const choiceBlock = rejectCommandWhileChoicePending("nodeSelection", { nodeId });
    if (choiceBlock) return choiceBlock;
    const decision = navigationService.inspectNode(nodeId);
    if (!decision.accepted) {
      const event = { type: "nodeRejected", nodeId, reason: decision.reason };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const { node, gates, rewards, rooms } = decision;
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
    const choiceBlock = rejectCommandWhileChoicePending("roomSelection", { roomId });
    if (choiceBlock) return choiceBlock;
    const currentRoom = roomMap.get(selectedChapterRoomId);
    const decision = navigationService.inspectRoomSelection({
      currentNodeId: selectedChapterNodeId,
      currentRoomId: selectedChapterRoomId,
      targetRoomId: roomId,
      roomEntityIds: roomEntityIds(currentRoom),
    });
    if (!decision.accepted && !decision.blocker) {
      const event = { type: "roomRejected", roomId, reason: decision.reason };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const room = decision.room;
    const blocker = decision.blocker;
    if (blocker) {
      const feedbackLines = blocker.branch?.narrativeLines?.length
        ? blocker.branch.narrativeLines
        : [`${blocker.npc.name || blocker.npc.displayName?.zhCN || "有人"}拦住了你。`];
      const transaction = commitResultEffects(blocker.npc.roleId, blocker.branch);
      if (!transaction.accepted) {
        const event = {
          type: "roomBlockEffectRejected",
          roomId: selectedChapterRoomId,
          targetRoomId: roomId,
          sourceRoleId: blocker.npc.roleId,
          sourceName: blocker.npc.name || blocker.npc.displayName?.zhCN || "",
          reason: transaction.reason,
          resultId: transaction.resultId || "",
          category: transaction.category || "",
          action: transaction.action || "",
          conditionTokens: clone(blocker.branch?.conditionTokens || []),
          resultTokens: clone(blocker.branch?.resultTokens || []),
          sideEffects: [],
          transaction: clone(transaction),
          routeKind: decision.routeKind || "",
          evidence: clone(blocker.npc.evidence || {}),
        };
        events.push(event);
        return { accepted: false, event, snapshot: snapshot() };
      }
      const sideEffects = transaction.sideEffects;
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
        routeKind: decision.routeKind || "",
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
      routeKind: decision.routeKind || "",
      navigationOnly: Boolean(decision.navigationOnly),
      evidence: clone(room.evidence || {}),
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function entityLifecycleState() {
    return { hiddenEntityIds, addedEntityIdsByRoom, replacementEntityById };
  }

  function npcSelectionDecision(roleId) {
    return entityInteractionService.inspectNpcSelection({
      roleId,
      currentRoomId: selectedChapterRoomId,
      room: roomMap.get(selectedChapterRoomId) || null,
      lifecycle: entityLifecycleState(),
    });
  }

  function interactableSelectionDecision(interactableId) {
    return entityInteractionService.inspectInteractableSelection({
      interactableId,
      currentRoomId: selectedChapterRoomId,
      room: roomMap.get(selectedChapterRoomId) || null,
      lifecycle: entityLifecycleState(),
    });
  }

  function selectChapterNpc(roleId) {
    const choiceBlock = rejectCommandWhileChoicePending("npcSelection", { roleId });
    if (choiceBlock) return choiceBlock;
    const decision = npcSelectionDecision(roleId);
    if (!decision.accepted) {
      const event = { type: "npcRejected", roleId, reasonCode: decision.reasonCode || "", reason: decision.reason };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const npc = npcMap.get(roleId);
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
    const choiceBlock = rejectCommandWhileChoicePending("interactableSelection", { interactableId });
    if (choiceBlock) return choiceBlock;
    const decision = interactableSelectionDecision(interactableId);
    if (!decision.accepted) {
      const event = { type: "interactableRejected", interactableId, reasonCode: decision.reasonCode || "", reason: decision.reason };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const item = interactableMap.get(interactableId);
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

  function npcActionAvailability(npc, actionType) {
    const { branch: _branch, action: _action, combatPolicy: _combatPolicy, feedbackLines: _feedbackLines, ...availability } = (
      entityInteractionService.inspectNpcAction({ npc, actionType })
    );
    return {
      actionType,
      ...availability,
    };
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
    const validation = branch ? validateResultEffects(branch) : { accepted: true, reason: "ok" };
    if (branch && !validation.accepted) {
      const resolution = {
        accepted: false,
        outcome,
        outcomeToken,
        sourceId: pendingCombat.sourceId,
        feedbackLines: [],
        resultTokens: clone(branch.resultTokens || []),
        sideEffects: [],
        reason: validation.reason,
        validation: clone(validation),
      };
      events.push({ type: "combatResolutionRejected", ...clone(resolution) });
      return resolution;
    }
    const executionBranch = validation.preparedBranch || branch;
    const transaction = executionBranch
      ? commitResultEffects(pendingCombat.sourceId, executionBranch)
      : { accepted: true, sideEffects: [] };
    if (!transaction.accepted) {
      const resolution = {
        accepted: false,
        outcome,
        outcomeToken,
        sourceId: pendingCombat.sourceId,
        feedbackLines: [],
        resultTokens: clone(branch?.resultTokens || []),
        sideEffects: clone(transaction.sideEffects || []),
        reason: transaction.reason,
        transaction: clone(transaction),
      };
      events.push({ type: "combatResolutionRejected", ...clone(resolution) });
      return resolution;
    }
    const sideEffects = transaction.sideEffects;
    const resolution = {
      accepted: true,
      outcome,
      outcomeToken,
      sourceId: pendingCombat.sourceId,
      matchedOutcomeBranch: Boolean(branch),
      feedbackLines: clone(branch?.narrativeLines || []),
      resultTokens: clone(branch?.resultTokens || []),
      sideEffects: clone(sideEffects),
      reason: "",
    };
    events.push({ type: "combatResolved", ...clone(resolution) });
    pendingCombat = null;
    return resolution;
  }

  function feedbackLinesFromSideEffects(sideEffects = []) {
    return sideEffects.flatMap((effect) => [
      ...(effect.feedbackLines || []),
      ...feedbackLinesFromSideEffects(effect.followupSideEffects || []),
    ]).filter(Boolean);
  }

  function resolvePendingChoice(optionId = "") {
    if (!pendingChoice) {
      const event = { type: "choiceResolutionRejected", optionId, reason: "no pending choice" };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const choice = clone(pendingChoice);
    const option = choice.options.find((candidate) => candidate.optionId === optionId);
    if (!option) {
      const event = {
        type: "choiceResolutionRejected",
        choiceId: choice.choiceId,
        optionId,
        reason: "unknown choice option",
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const resolvedResults = [];
    for (const token of option.resultTokens) {
      const result = resultRecord(token);
      if (!result) {
        const event = {
          type: "choiceResolutionRejected",
          choiceId: choice.choiceId,
          optionId,
          reason: "unknown result token",
          resultToken: token,
        };
        events.push(event);
        return { accepted: false, event, snapshot: snapshot() };
      }
      resolvedResults.push(result);
    }
    const branch = {
      conditionTokens: [],
      resultTokens: clone(option.resultTokens),
      resolvedResults,
      evidenceLevel: choice.evidence?.level || "unknown",
    };
    const validation = validateResultEffects(branch);
    if (!validation.accepted) {
      const event = {
        type: "choiceResolutionRejected",
        choiceId: choice.choiceId,
        optionId,
        reason: validation.reason,
        validation: clone(validation),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }

    const transaction = commitResultEffects(choice.sourceId, validation.preparedBranch || branch);
    if (!transaction.accepted) {
      const event = {
        type: "choiceResolutionRejected",
        choiceId: choice.choiceId,
        optionId,
        reason: transaction.reason,
        transaction: clone(transaction),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const sideEffects = transaction.sideEffects;
    const feedbackLines = feedbackLinesFromSideEffects(sideEffects);
    pendingChoice = null;
    const event = {
      type: "choiceResolved",
      choiceId: choice.choiceId,
      sourceId: choice.sourceId,
      optionId,
      optionLabel: option.label,
      resultTokens: clone(option.resultTokens),
      feedbackLines,
      feedback: feedbackLines.join("\n"),
      sideEffects: clone(sideEffects),
      evidenceLevel: choice.evidence?.level || "unknown",
    };
    events.push(event);
    return { accepted: true, event, snapshot: snapshot() };
  }

  function globalNpcActionFeedback(npc, action) {
    return entityInteractionService.feedbackForNpcAction(npc, action);
  }

  function interactableActionDecision(item, actionType) {
    return entityInteractionService.inspectInteractableAction({ item, actionType });
  }

  function interactableActionAvailability(item, actionType) {
    const { branch: _branch, action: _action, ...availability } = interactableActionDecision(item, actionType);
    return availability;
  }

  function interactWithChapterNpc(roleId, actionType = "talk") {
    const choiceBlock = rejectCommandWhileChoicePending("npcInteraction", { roleId, actionType });
    if (choiceBlock) return choiceBlock;
    const selection = npcSelectionDecision(roleId);
    if (!selection.accepted) {
      const event = { type: "npcInteractionRejected", roleId, actionType, reasonCode: selection.reasonCode || "", reason: selection.reason };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const npc = npcMap.get(roleId);
    const decision = entityInteractionService.inspectNpcAction({ npc, actionType });
    const action = decision.action || (npc.actions || []).find((item) => item.actionType === actionType);
    if (!decision.available) {
      const event = {
        type: "npcInteractionRejected",
        roleId,
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
    const branch = decision.branch;
    const combatPolicy = decision.combatPolicy;
    if (decision.executionKind === "combat" && combatPolicy) {
      selectedChapterNpcId = roleId;
      selectedChapterInteractableId = "";
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
    const resultValidation = branch ? validateResultEffects(branch) : { accepted: true, reason: "ok" };
    if (!resultValidation.accepted) {
      const event = {
        type: "npcInteractionRejected",
        roleId,
        actionType,
        reason: resultValidation.reason,
        feedback: resultValidation.reason,
        resultTokens: clone(branch?.resultTokens || []),
        validation: clone(resultValidation),
        evidenceLevel: evidenceLevelOrUnknown(branch?.evidenceLevel, npc?.evidence?.level),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const fallback = branch?.narrativeLines?.length ? null : globalNpcActionFeedback(npc, action);
    const executionBranch = resultValidation.preparedBranch || branch;
    const transaction = executionBranch
      ? commitResultEffects(roleId, executionBranch, {
        selectedChapterNpcId: roleId,
        selectedChapterInteractableId: "",
      })
      : { accepted: true, sideEffects: [] };
    if (!transaction.accepted) {
      const event = {
        type: "npcInteractionRejected",
        roleId,
        actionType,
        reason: transaction.reason,
        feedback: transaction.reason,
        resultTokens: clone(branch?.resultTokens || []),
        transaction: clone(transaction),
        evidenceLevel: evidenceLevelOrUnknown(branch?.evidenceLevel, npc?.evidence?.level),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const sideEffects = transaction.sideEffects;
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
    const choiceBlock = rejectCommandWhileChoicePending("interactableInteraction", { interactableId, actionType });
    if (choiceBlock) return choiceBlock;
    const selection = interactableSelectionDecision(interactableId);
    if (!selection.accepted) {
      const event = { type: "interactableInteractionRejected", interactableId, actionType, reasonCode: selection.reasonCode || "", reason: selection.reason };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const item = interactableMap.get(interactableId);
    const decision = entityInteractionService.inspectInteractableAction({ item, actionType });
    const action = decision.action || (item.actions || []).find((candidate) => candidate.actionType === actionType);
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
    const branch = decision.branch;
    const fallbackLine = entityInteractionService.feedbackForInteractable(item)[0] || "";
    const resultValidation = branch ? validateResultEffects(branch) : { accepted: true, reason: "ok" };
    if (!resultValidation.accepted) {
      const event = {
        type: "interactableInteractionRejected",
        interactableId,
        actionType,
        reason: resultValidation.reason,
        feedback: resultValidation.reason,
        resultTokens: clone(branch?.resultTokens || []),
        validation: clone(resultValidation),
        evidenceLevel: evidenceLevelOrUnknown(branch?.evidenceLevel, item?.evidence?.level),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const executionBranch = resultValidation.preparedBranch || branch;
    const transaction = executionBranch
      ? commitResultEffects(interactableId, executionBranch, {
        selectedChapterNpcId: "",
        selectedChapterInteractableId: interactableId,
      })
      : { accepted: true, sideEffects: [] };
    if (!transaction.accepted) {
      const event = {
        type: "interactableInteractionRejected",
        interactableId,
        actionType,
        reason: transaction.reason,
        feedback: transaction.reason,
        resultTokens: clone(branch?.resultTokens || []),
        transaction: clone(transaction),
        evidenceLevel: evidenceLevelOrUnknown(branch?.evidenceLevel, item?.evidence?.level),
      };
      events.push(event);
      return { accepted: false, event, snapshot: snapshot() };
    }
    const sideEffects = transaction.sideEffects;
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
    resolvePendingChoice,
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

