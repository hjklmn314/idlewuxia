import { cloneData } from "./dataClone.js";

function asLookup(value) {
  return value instanceof Map ? value : new Map(Object.entries(value || {}));
}

function asSet(value) {
  if (value instanceof Set) return value;
  return new Set(value || []);
}

function asMapOfSets(value) {
  if (value instanceof Map) return value;
  return new Map(Object.entries(value || {}).map(([key, entries]) => [key, asSet(entries)]));
}

function asMap(value) {
  return value instanceof Map ? value : new Map(Object.entries(value || {}));
}

function evidenceLevel(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "unknown";
}

function renderTemplate(template = "", values = {}) {
  return String(template || "").replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_match, key) => String(values[key] ?? ""));
}

/**
 * Stateless entity availability and interaction decision service.
 *
 * The caller owns session state, events, persistence and ResultEffect commit.
 * This service only interprets immutable entity/action definitions and returns
 * detached decisions that can be audited before any mutation occurs.
 */
export function createEntityInteractionService({
  npcLookup,
  interactableLookup,
  entityInteractionPolicy = {},
  combatActionPolicies = {},
  branchEnabled = () => true,
  evaluateBranch = () => ({ accepted: false, checks: [] }),
  branchRequiresChoice = () => false,
  validateBranch = () => ({ accepted: true }),
} = {}) {
  const npcs = asLookup(npcLookup);
  const interactables = asLookup(interactableLookup);
  const policy = cloneData(entityInteractionPolicy || {});
  const combatPolicies = cloneData(combatActionPolicies || {});
  const visibilityField = String(policy.visibility?.interactableField || "");
  const dialogueActionType = String(policy.branchRouting?.dialogueActionType || "");
  const defaultNarrativeConditionToken = String(policy.branchRouting?.defaultNarrativeConditionToken || "");
  const excludedDialogueConditionPrefixes = policy.branchRouting?.excludedDialogueConditionPrefixes || [];
  const feedbackPolicy = policy.feedback || {};
  const configured = Boolean(
    policy.schema === "idlewuxia.entity_interaction_policy.v1"
    && visibilityField
    && Object.hasOwn(policy.visibility || {}, "visibleValue")
    && dialogueActionType
    && defaultNarrativeConditionToken
    && Array.isArray(excludedDialogueConditionPrefixes)
    && feedbackPolicy.noBranchTemplate
    && feedbackPolicy.interactableHiddenTemplate
    && feedbackPolicy.interactableDescriptionTemplate
    && feedbackPolicy.interactableNoReactionTemplate
    && policy.failurePolicy === "reject_unknown_hidden_out_of_room_or_unrouted_action"
  );

  const allCombatOutcomeTokens = new Set(Object.values(combatPolicies).flatMap((combatPolicy) => [
    combatPolicy?.successConditionToken,
    combatPolicy?.failureConditionToken,
    combatPolicy?.runawayConditionToken,
  ]).filter(Boolean));

  function activeEntityIdsForRoom(room, lifecycle = {}) {
    const hidden = asSet(lifecycle.hiddenEntityIds);
    const addedByRoom = asMapOfSets(lifecycle.addedEntityIdsByRoom);
    const replacements = asMap(lifecycle.replacementEntityById);
    const seen = new Set();
    const ordered = [];
    const append = (entityId) => {
      const replacementId = replacements.get(entityId);
      const resolvedId = replacementId || entityId;
      if (!resolvedId || hidden.has(resolvedId) || seen.has(resolvedId)) return;
      seen.add(resolvedId);
      ordered.push(resolvedId);
    };
    for (const entityId of [...(room?.encounterIds || []), ...(room?.interactableIds || [])]) append(entityId);
    for (const entityId of addedByRoom.get(room?.roomId || "") || []) append(entityId);
    return ordered;
  }

  function entityIsInRoom(entityId, currentRoomId, room, lifecycle) {
    if (!currentRoomId || !room || room.roomId !== currentRoomId) return false;
    return activeEntityIdsForRoom(room, lifecycle).includes(entityId);
  }

  function inspectNpcSelection({ roleId = "", currentRoomId = "", room = null, lifecycle = {} } = {}) {
    if (!configured) return { accepted: false, reason: "entity interaction policy is not configured", roleId };
    const npc = npcs.get(roleId);
    if (!npc) return { accepted: false, reason: "unknown npc", roleId };
    if (!entityIsInRoom(roleId, currentRoomId, room, lifecycle)) {
      return { accepted: false, reason: "npc is not in selected room", roleId };
    }
    return { accepted: true, reason: "", roleId, entity: cloneData(npc) };
  }

  function interactableVisible(item) {
    return item?.[visibilityField] === policy.visibility.visibleValue;
  }

  function inspectInteractableSelection({ interactableId = "", currentRoomId = "", room = null, lifecycle = {} } = {}) {
    if (!configured) return { accepted: false, reason: "entity interaction policy is not configured", interactableId };
    const item = interactables.get(interactableId);
    if (!item) return { accepted: false, reason: "unknown interactable", interactableId };
    if (!entityIsInRoom(interactableId, currentRoomId, room, lifecycle)) {
      return { accepted: false, reason: "interactable is not in selected room", interactableId };
    }
    if (!interactableVisible(item)) {
      return {
        accepted: false,
        reasonCode: "interactable_hidden",
        reason: renderTemplate(feedbackPolicy.interactableHiddenTemplate, {
          field: visibilityField,
          expectedValue: policy.visibility.visibleValue,
        }),
        interactableId,
      };
    }
    return { accepted: true, reason: "", interactableId, entity: cloneData(item) };
  }

  function enabledBranches(entity) {
    return (entity?.branches || []).filter(branchEnabled);
  }

  function dialogueBranches(npc) {
    return enabledBranches(npc)
      .filter((branch) => !(branch.actionHints || []).length)
      .filter((branch) => !(branch.conditionTokens || []).some((token) => (
        allCombatOutcomeTokens.has(token)
        || excludedDialogueConditionPrefixes.some((prefix) => String(token || "").startsWith(prefix))
      )));
  }

  function branchDecision(candidateBranches, context = {}, sourceEvidenceLevel = "unknown") {
    const evaluations = candidateBranches.map((branch) => ({ branch, evaluation: evaluateBranch(branch, context) }));
    const accepted = evaluations.find(({ evaluation }) => evaluation.accepted);
    if (accepted) {
      return {
        branch: cloneData(accepted.branch),
        available: true,
        reason: "",
        checks: cloneData(accepted.evaluation.checks || []),
        conditionTokens: cloneData(accepted.branch.conditionTokens || []),
        evidenceLevel: evidenceLevel(accepted.branch.evidenceLevel, sourceEvidenceLevel),
      };
    }
    const first = evaluations[0];
    return {
      branch: null,
      available: false,
      reason: "configured action conditions are not met",
      checks: cloneData(first?.evaluation?.checks || []),
      conditionTokens: cloneData(first?.branch?.conditionTokens || []),
      evidenceLevel: evidenceLevel(first?.branch?.evidenceLevel, sourceEvidenceLevel),
    };
  }

  function validateChoiceBranch(decision, actionType) {
    if (!decision.branch || !branchRequiresChoice(decision.branch)) return decision;
    const validation = validateBranch(decision.branch);
    if (validation.accepted) return decision;
    return {
      actionType,
      branch: null,
      visible: true,
      available: false,
      reason: validation.reason,
      checks: cloneData(decision.checks || []),
      conditionTokens: cloneData(decision.conditionTokens || []),
      evidenceLevel: decision.evidenceLevel,
    };
  }

  function feedbackForNpcAction(npc = {}, action = {}) {
    const name = npc.name || npc.displayName?.zhCN || feedbackPolicy.fallbackEntityName || "";
    const actionLabel = action.label || action.actionType || feedbackPolicy.fallbackActionLabel || "";
    const rule = feedbackPolicy.npcGlobalActions?.[action.actionType] || null;
    if (!rule) {
      return {
        lines: [renderTemplate(feedbackPolicy.noBranchTemplate, { name, actionLabel, sourceValue: "" })],
        evidenceLevel: "unknown_no_branch",
      };
    }
    const sourceField = rule.requiredSourceField || rule.optionalSourceField || "";
    const sourceValue = sourceField ? npc[sourceField] : "";
    if (rule.requiredSourceField && !sourceValue) {
      return {
        lines: [renderTemplate(feedbackPolicy.noBranchTemplate, { name, actionLabel, sourceValue: "" })],
        evidenceLevel: "unknown_no_branch",
      };
    }
    const templates = sourceValue && (rule.populatedLineTemplates || []).length
      ? rule.populatedLineTemplates
      : rule.lineTemplates || [];
    return {
      lines: templates.map((template) => renderTemplate(template, { name, actionLabel, sourceValue })),
      evidenceLevel: "config_confirmed_global_action",
    };
  }

  function inspectNpcAction({ npc = null, actionType = "", context = {} } = {}) {
    if (!configured) return { actionType, branch: null, visible: false, available: false, reason: "entity interaction policy is not configured", checks: [] };
    const action = (npc?.actions || []).find((candidate) => candidate.actionType === actionType);
    if (!action) return { actionType, branch: null, available: false, reason: "npc action unavailable", checks: [] };
    const combatPolicy = combatPolicies[actionType] || null;
    const branches = enabledBranches(npc);
    const exactBranches = branches.filter((branch) => (branch.actionHints || []).includes(actionType));
    const candidates = exactBranches.length
      ? exactBranches
      : (actionType === dialogueActionType ? dialogueBranches(npc) : []);
    const sourceEvidenceLevel = evidenceLevel(
      action.evidenceLevel,
      action.evidence?.level,
      npc?.evidence?.level,
      combatPolicy?.evidence?.level,
    );
    const hasUnroutedCombatResult = !combatPolicy && candidates.some((branch) => (
      (branch.resolvedResults || []).some((result) => result.category === "combat")
    ));
    if (hasUnroutedCombatResult) {
      return { actionType, branch: null, visible: false, available: false, reason: "combat runtime module is postponed", checks: [], evidenceLevel: sourceEvidenceLevel };
    }
    if (!candidates.length && actionType === dialogueActionType && (npc?.defaultNarrativeLines || []).length) {
      return {
        actionType,
        branch: {
          conditionTokens: [defaultNarrativeConditionToken],
          resultTokens: [],
          resolvedResults: [],
          narrativeLines: cloneData(npc.defaultNarrativeLines),
          evidenceLevel: sourceEvidenceLevel,
          matchPolicy: "default_narrative",
        },
        visible: true,
        available: true,
        reason: "",
        checks: [],
        conditionTokens: [defaultNarrativeConditionToken],
        evidenceLevel: sourceEvidenceLevel,
        executionKind: "result",
        feedbackLines: cloneData(npc.defaultNarrativeLines),
        action: cloneData(action),
      };
    }
    if (!candidates.length && !combatPolicy) {
      return { actionType, branch: null, visible: false, available: false, reason: "no configured runtime execution branch", checks: [], evidenceLevel: sourceEvidenceLevel };
    }
    const ignored = combatPolicy
      ? [combatPolicy.successConditionToken, combatPolicy.failureConditionToken, combatPolicy.runawayConditionToken].filter(Boolean)
      : [];
    const decision = candidates.length
      ? branchDecision(candidates, { ...context, actionType, ignoreConditionTokens: ignored }, sourceEvidenceLevel)
      : { branch: null, available: true, reason: "", checks: [], conditionTokens: [], evidenceLevel: sourceEvidenceLevel };
    const validated = validateChoiceBranch(decision, actionType);
    return {
      actionType,
      visible: validated.visible ?? true,
      ...validated,
      executionKind: combatPolicy ? "combat" : "result",
      combatPolicy: cloneData(combatPolicy),
      feedbackLines: feedbackForNpcAction(npc, action).lines,
      action: cloneData(action),
    };
  }

  function interactableBranches(item, actionType) {
    const branches = enabledBranches(item);
    const exact = branches.filter((branch) => (branch.actionHints || []).includes(actionType));
    return exact.length ? exact : branches.filter((branch) => !(branch.actionHints || []).length);
  }

  function inspectInteractableAction({ item = null, actionType = "", context = {} } = {}) {
    if (!configured) return { actionType, branch: null, visible: false, available: false, reason: "entity interaction policy is not configured", checks: [] };
    const action = (item?.actions || []).find((candidate) => candidate.actionType === actionType);
    if (!action) return { actionType, branch: null, available: false, reason: "interactable action unavailable", checks: [] };
    const candidates = interactableBranches(item, actionType);
    const sourceEvidenceLevel = evidenceLevel(action.evidenceLevel, action.evidence?.level, item?.evidence?.level);
    if (!candidates.length) {
      return { actionType, branch: null, visible: false, available: false, reason: "no configured runtime execution branch", checks: [], evidenceLevel: sourceEvidenceLevel };
    }
    const decision = branchDecision(candidates, { ...context, actionType }, sourceEvidenceLevel);
    const validated = validateChoiceBranch(decision, actionType);
    return { actionType, visible: validated.visible ?? true, ...validated, executionKind: "result", action: cloneData(action) };
  }

  function feedbackForInteractable(item = {}) {
    const name = item.name || item.displayName?.zhCN || feedbackPolicy.fallbackInteractableName || "";
    const template = item.description
      ? feedbackPolicy.interactableDescriptionTemplate
      : feedbackPolicy.interactableNoReactionTemplate;
    return [renderTemplate(template, { name, description: item.description || "" })];
  }

  return Object.freeze({
    contractVersion: "idlewuxia.entity_interaction_service.v1",
    activeEntityIdsForRoom,
    inspectNpcSelection,
    inspectInteractableSelection,
    inspectNpcAction,
    inspectInteractableAction,
    feedbackForNpcAction,
    feedbackForInteractable,
  });
}
