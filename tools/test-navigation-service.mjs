import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNavigationService } from "../src/navigationService.js";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const nodes = new Map([
  ["node_a", {
    nodeId: "node_a",
    sourceRooms: ["room_a", "missing_room"],
    gates: ["gate_a", "missing_gate"],
    rewards: ["reward_a", "missing_reward"],
  }],
  ["node_b", { nodeId: "node_b", sourceRooms: ["room_b"], gates: [], rewards: [] }],
]);
const rooms = new Map([
  ["room_a", {
    roomId: "room_a",
    parentNodeId: "node_a",
    connections: [{ direction: "north", roomId: "room_b" }],
  }],
  ["room_b", { roomId: "room_b", parentNodeId: "node_b", connections: [] }],
  ["room_c", { roomId: "room_c", parentNodeId: "node_b", connections: [] }],
]);
const npcs = new Map([
  ["guard", {
    roleId: "guard",
    name: "Gate Guard",
    branches: [{
      conditionTokens: ["enter_b"],
      resultTokens: ["arbitrary_result_id"],
      resolvedResults: [{ resultId: "arbitrary_result_id", action: "halt_movement" }],
      narrativeLines: ["The way is blocked."],
    }],
  }],
]);
const conditions = new Map([
  ["enter_b", { arg1: "enter_room", arg2: "room_b" }],
]);
const policy = {
  schema: "idlewuxia.navigation_policy.v1",
  roomEntryCondition: {
    actionName: "enter_room",
    targetRoomField: "arg2",
  },
  blockerResult: {
    actionName: "halt_movement",
  },
  projectBridge: {
    mode: "allow_configured_room_selection",
    mutationPolicy: "navigation_only",
  },
  failurePolicy: "reject_unknown_definition_or_unconfigured_route",
};

const service = createNavigationService({
  nodeLookup: nodes,
  roomLookup: rooms,
  npcLookup: npcs,
  gateLookup: new Map([["gate_a", { gateId: "gate_a" }]]),
  rewardLookup: new Map([["reward_a", { rewardId: "reward_a" }]]),
  conditionLookup: conditions,
  navigationPolicy: policy,
});

assert.equal(service.contractVersion, "idlewuxia.navigation_service.v1");

const selectedNode = service.inspectNode("node_a");
assert.equal(selectedNode.accepted, true);
assert.deepEqual(selectedNode.rooms.map((room) => room.roomId), ["room_a", "missing_room"]);
assert.equal(selectedNode.rooms[1].missing, true);
assert.equal(selectedNode.gates[1].missing, true);
assert.equal(selectedNode.rewards[1].missing, true);
selectedNode.node.sourceRooms.push("caller_mutation");
selectedNode.rooms[0].roomId = "caller_mutation";
assert.deepEqual(nodes.get("node_a").sourceRooms, ["room_a", "missing_room"], "node definitions must not leak through service output");
assert.equal(rooms.get("room_a").roomId, "room_a", "room definitions must not leak through service output");
assert.equal(service.inspectNode("unknown").reason, "unknown node");

const blocked = service.inspectRoomSelection({
  currentNodeId: "node_a",
  currentRoomId: "room_a",
  targetRoomId: "room_b",
  roomEntityIds: ["guard"],
});
assert.equal(blocked.accepted, false);
assert.equal(blocked.reason, "movement blocked");
assert.equal(blocked.routeKind, "connected_exit");
assert.equal(blocked.blocker.conditionToken, "enter_b");
assert.equal(blocked.blocker.npc.roleId, "guard");
blocked.blocker.npc.name = "caller_mutation";
blocked.blocker.branch.narrativeLines.push("caller_mutation");
assert.equal(npcs.get("guard").name, "Gate Guard", "NPC definitions must not leak through blocker output");
assert.deepEqual(npcs.get("guard").branches[0].narrativeLines, ["The way is blocked."], "branch definitions must stay immutable");

const projectBridge = service.inspectRoomSelection({
  currentNodeId: "node_a",
  currentRoomId: "room_a",
  targetRoomId: "room_c",
  roomEntityIds: [],
});
assert.equal(projectBridge.accepted, true);
assert.equal(projectBridge.routeKind, "project_navigation_bridge");
assert.equal(projectBridge.navigationOnly, true);

const incompletePolicyService = createNavigationService({
  nodeLookup: nodes,
  roomLookup: rooms,
  npcLookup: npcs,
  conditionLookup: conditions,
  navigationPolicy: {
    ...policy,
    projectBridge: { mode: "allow_configured_room_selection" },
    failurePolicy: "",
  },
});
const incompletePolicyDecision = incompletePolicyService.inspectRoomSelection({
  currentNodeId: "node_a",
  currentRoomId: "room_a",
  targetRoomId: "room_c",
  roomEntityIds: [],
});
assert.equal(incompletePolicyDecision.accepted, false);
assert.equal(incompletePolicyDecision.reason, "navigation policy is not configured");
assert.equal(incompletePolicyService.inspectNode("node_a").accepted, false);
assert.equal(incompletePolicyService.inspectNode("node_a").reason, "navigation policy is not configured");

const initial = service.inspectRoomSelection({ targetRoomId: "room_a", roomEntityIds: [] });
assert.equal(initial.accepted, true);
assert.equal(initial.routeKind, "initial_room_selection");
assert.equal(service.inspectRoomSelection({ targetRoomId: "missing" }).reason, "unknown room");

const exits = service.exitAvailability({ currentRoomId: "room_a", roomEntityIds: ["guard"] });
assert.equal(exits.length, 1);
assert.equal(exits[0].roomId, "room_b");
assert.equal(exits[0].available, false);
assert.equal(exits[0].blockerRoleId, "guard");
assert.deepEqual(exits[0].feedbackLines, ["The way is blocked."]);

const source = readFileSync(new URL("../src/navigationService.js", import.meta.url), "utf8");
for (const forbidden of ["gorome", "fb01", "NODE_", "ACTION_FS_", 'includes("stop")']) {
  assert.equal(source.includes(forbidden), false, `generic navigation service must not contain ${forbidden}`);
}

const flow = JSON.parse(
  readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"),
);
const flowWithoutNavigationPolicy = structuredClone(flow);
delete flowWithoutNavigationPolicy.chapterSystem.navigationPolicy;
const failClosedRuntime = createFirstSessionRuntime(flowWithoutNavigationPolicy);
const failClosedBefore = failClosedRuntime.snapshot();
const knownNodeId = failClosedBefore.chapter.nodes[0]?.nodeId || "";
const failClosedNodeDecision = failClosedRuntime.selectChapterNode(knownNodeId);
assert.equal(failClosedNodeDecision.accepted, false);
assert.equal(failClosedNodeDecision.event.type, "nodeRejected");
assert.equal(failClosedNodeDecision.event.reason, "navigation policy is not configured");
assert.equal(failClosedNodeDecision.snapshot.chapter.selectedNodeId, failClosedBefore.chapter.selectedNodeId);
assert.equal(failClosedNodeDecision.snapshot.chapter.selectedRoomId, failClosedBefore.chapter.selectedRoomId);
assert.equal(failClosedNodeDecision.snapshot.events.some((event) => event.type === "nodeSelected"), false);

const runtime = createFirstSessionRuntime(flow);
assert.equal(runtime.selectChapterRoom("fb01_02").accepted, true);
const runtimeBlocked = runtime.selectChapterRoom("fb01_03");
assert.equal(runtimeBlocked.accepted, false);
assert.equal(runtimeBlocked.event.type, "roomBlocked");
assert.match(runtimeBlocked.event.feedback, /拦住了你/);
assert.equal(runtimeBlocked.snapshot.chapter.exitAvailability.find((exit) => exit.roomId === "fb01_03")?.available, false);

console.log("navigation service contract tests: PASS");
