import { cloneData } from "./dataClone.js";

function asLookup(value) {
  return value instanceof Map ? value : new Map(Object.entries(value || {}));
}

function missingDefinition(idField, id) {
  return { [idField]: id, missing: true };
}

/**
 * Creates a stateless interpreter for chapter nodes, room routes and configured
 * movement blockers. Runtime state and dynamic room entities are supplied per
 * call; the service never writes session state, events, persistence or DOM.
 */
export function createNavigationService({
  nodeLookup,
  roomLookup,
  npcLookup,
  gateLookup,
  rewardLookup,
  conditionLookup,
  resultLookup,
  navigationPolicy = {},
} = {}) {
  const nodes = asLookup(nodeLookup);
  const rooms = asLookup(roomLookup);
  const npcs = asLookup(npcLookup);
  const gates = asLookup(gateLookup);
  const rewards = asLookup(rewardLookup);
  const conditions = asLookup(conditionLookup);
  const results = asLookup(resultLookup);

  const conditionActionName = String(navigationPolicy.roomEntryCondition?.actionName || "");
  const conditionTargetField = String(navigationPolicy.roomEntryCondition?.targetRoomField || "");
  const blockerActionName = String(navigationPolicy.blockerResult?.actionName || "");
  const bridgeMode = String(navigationPolicy.projectBridge?.mode || "");
  const bridgeMutationPolicy = String(navigationPolicy.projectBridge?.mutationPolicy || "");
  const failurePolicy = String(navigationPolicy.failurePolicy || "");
  const configured = Boolean(
    navigationPolicy.schema === "idlewuxia.navigation_policy.v1"
    && conditionActionName
    && conditionTargetField
    && blockerActionName
    && ["allow_configured_room_selection", "connected_rooms_only"].includes(bridgeMode)
    && bridgeMutationPolicy === "navigation_only"
    && failurePolicy === "reject_unknown_definition_or_unconfigured_route"
  );

  const entryTokensByRoom = new Map();
  if (configured) {
    for (const [token, definition] of conditions.entries()) {
      if (definition?.arg1 !== conditionActionName) continue;
      const targetRoomId = String(definition?.[conditionTargetField] || "");
      if (!targetRoomId) continue;
      const tokens = entryTokensByRoom.get(targetRoomId) || [];
      tokens.push(token);
      entryTokensByRoom.set(targetRoomId, tokens);
    }
  }

  function resolveResult(resultId = "") {
    const key = String(resultId || "").replace(/^rlt_/, "");
    return results.get(key) || results.get(`rlt_${key}`) || null;
  }

  function branchBlocksMovement(branch = {}) {
    if ((branch.resolvedResults || []).some((result) => result?.action === blockerActionName)) return true;
    return (branch.resultTokens || []).some((resultId) => resolveResult(resultId)?.action === blockerActionName);
  }

  function blockerForRoom({ currentRoomId = "", targetRoomId = "", roomEntityIds = [] } = {}) {
    if (!configured || !currentRoomId || !targetRoomId || currentRoomId === targetRoomId) return null;
    const conditionTokens = new Set(entryTokensByRoom.get(targetRoomId) || []);
    if (!conditionTokens.size) return null;
    for (const entityId of roomEntityIds || []) {
      const npc = npcs.get(entityId);
      if (!npc) continue;
      const branch = (npc.branches || []).find((candidate) => (
        (candidate.conditionTokens || []).some((token) => conditionTokens.has(token))
        && branchBlocksMovement(candidate)
      ));
      if (!branch) continue;
      const conditionToken = (branch.conditionTokens || []).find((token) => conditionTokens.has(token)) || "";
      return { npc, branch, conditionToken };
    }
    return null;
  }

  function routeKind({ currentNodeId = "", currentRoomId = "", targetRoomId = "" } = {}) {
    if (!currentRoomId) return "initial_room_selection";
    if (currentRoomId === targetRoomId) return "current_room_selection";
    const currentRoom = rooms.get(currentRoomId);
    if ((currentRoom?.connections || []).some((connection) => connection?.roomId === targetRoomId)) {
      return "connected_exit";
    }
    const currentNode = nodes.get(currentNodeId);
    if ((currentNode?.sourceRooms || []).includes(targetRoomId)) return "node_room_browser";
    return "project_navigation_bridge";
  }

  function inspectNode(nodeId = "") {
    if (!configured) return { accepted: false, reason: "navigation policy is not configured", nodeId };
    const node = nodes.get(nodeId);
    if (!node) return { accepted: false, reason: "unknown node", nodeId };
    return {
      accepted: true,
      reason: "",
      node: cloneData(node),
      rooms: (node.sourceRooms || []).map((roomId) => cloneData(rooms.get(roomId) || missingDefinition("roomId", roomId))),
      gates: (node.gates || []).map((gateId) => cloneData(gates.get(gateId) || missingDefinition("gateId", gateId))),
      rewards: (node.rewards || []).map((rewardId) => cloneData(rewards.get(rewardId) || missingDefinition("rewardId", rewardId))),
    };
  }

  function inspectRoomSelection(context = {}) {
    const targetRoomId = String(context.targetRoomId || "");
    const room = rooms.get(targetRoomId);
    if (!room) return { accepted: false, reason: "unknown room", targetRoomId };
    if (!configured) return { accepted: false, reason: "navigation policy is not configured", targetRoomId };
    const kind = routeKind(context);
    if (kind === "project_navigation_bridge" && bridgeMode !== "allow_configured_room_selection") {
      return { accepted: false, reason: "route is not configured", routeKind: kind, targetRoomId };
    }
    const blocker = blockerForRoom(context);
    if (blocker) {
      return {
        accepted: false,
        reason: "movement blocked",
        routeKind: kind,
        navigationOnly: bridgeMutationPolicy === "navigation_only",
        room: cloneData(room),
        blocker: cloneData(blocker),
      };
    }
    return {
      accepted: true,
      reason: "",
      routeKind: kind,
      navigationOnly: kind === "project_navigation_bridge" && bridgeMutationPolicy === "navigation_only",
      room: cloneData(room),
      blocker: null,
    };
  }

  function exitAvailability({ currentRoomId = "", roomEntityIds = [] } = {}) {
    const room = rooms.get(currentRoomId);
    if (!room) return [];
    return (room.connections || []).map((connection) => {
      const decision = inspectRoomSelection({
        currentNodeId: room.parentNodeId || "",
        currentRoomId,
        targetRoomId: connection.roomId || "",
        roomEntityIds,
      });
      const blocker = decision.blocker;
      return {
        roomId: connection.roomId || "",
        direction: connection.direction || "",
        available: decision.accepted,
        reason: decision.reason || "",
        routeKind: decision.routeKind || "",
        blockerRoleId: blocker?.npc?.roleId || "",
        blockerName: blocker?.npc?.name || blocker?.npc?.displayName?.zhCN || "",
        conditionTokens: cloneData(blocker?.branch?.conditionTokens || []),
        feedbackLines: cloneData(blocker?.branch?.narrativeLines || []),
        evidence: cloneData(blocker?.npc?.evidence || {}),
      };
    });
  }

  return {
    contractVersion: "idlewuxia.navigation_service.v1",
    inspectNode,
    inspectRoomSelection,
    exitAvailability,
  };
}
