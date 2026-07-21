import assert from "node:assert/strict";

import { createEntityInteractionService } from "../src/entityInteractionService.js";

const policy = {
  schema: "idlewuxia.entity_interaction_policy.v1",
  visibility: {
    interactableField: "canSee",
    visibleValue: true,
  },
  branchRouting: {
    dialogueActionType: "talk",
    defaultNarrativeConditionToken: "words",
    excludedDialogueConditionPrefixes: ["gorome"],
  },
  feedback: {
    fallbackEntityName: "\u5bf9\u65b9",
    fallbackInteractableName: "\u7269\u4ef6",
    fallbackActionLabel: "\u64cd\u4f5c",
    noBranchTemplate: "{actionLabel}\u6ca1\u6709\u914d\u7f6e\u53ef\u64ad\u653e\u53cd\u9988\u3002",
    interactableHiddenTemplate: "\u8be5\u7269\u4ef6\u5f53\u524d\u4e0d\u53ef\u89c1\u3002",
    interactableDescriptionTemplate: "{name}\uff1a{description}",
    interactableNoReactionTemplate: "{name}\u6ca1\u6709\u66f4\u591a\u53cd\u5e94\u3002",
    npcGlobalActions: {
      sale: {
        requiredSourceField: "saleList",
        lineTemplates: ["{name}\u6253\u5f00\u4e86\u4ea4\u6613\u5217\u8868\u3002", "\u53ef\u4ea4\u6613\u7269\u54c1\uff1a{sourceValue}"],
      },
      present: {
        optionalSourceField: "receivePresent",
        lineTemplates: ["\u8bf7\u9009\u62e9\u8981\u8d60\u9001\u7ed9{name}\u7684\u7269\u54c1\u3002"],
        populatedLineTemplates: ["\u8bf7\u9009\u62e9\u8981\u8d60\u9001\u7ed9{name}\u7684\u7269\u54c1\u3002", "\u4e13\u5c5e\u6536\u793c\u7269\u54c1\uff1a{sourceValue}"],
      },
      compete: {
        lineTemplates: ["\u4f60\u5411{name}\u63d0\u51fa\u5207\u78cb\u3002"],
      },
    },
  },
  failurePolicy: "reject_unknown_hidden_out_of_room_or_unrouted_action",
};

const npcs = new Map([
  ["npc_a", {
    roleId: "npc_a",
    name: "\u4f9b\u8bd5\u8005",
    actions: [
      { actionType: "talk", label: "\u4ea4\u8c08", evidenceLevel: "config_confirmed" },
      { actionType: "compete", label: "\u5207\u78cb", evidenceLevel: "config_confirmed" },
      { actionType: "sale", label: "\u4ea4\u6613", evidenceLevel: "config_confirmed" },
      { actionType: "unused", label: "\u672a\u63a5\u5165", evidenceLevel: "config_confirmed" },
    ],
    branches: [
      {
        conditionTokens: ["talk", "marker_ok"],
        actionHints: ["talk"],
        narrativeLines: ["\u6761\u4ef6\u4ea4\u8c08"],
        resultTokens: ["text_1"],
        resolvedResults: [],
        evidenceLevel: "lua_confirmed",
      },
      {
        conditionTokens: ["comparewin"],
        actionHints: [],
        narrativeLines: ["\u6218\u6597\u540e\u6587\u672c"],
        resultTokens: ["text_2"],
        resolvedResults: [],
      },
    ],
    defaultNarrativeLines: ["\u9ed8\u8ba4\u4ea4\u8c08"],
    saleList: "tea;rice",
    receivePresent: "jade",
    evidence: { level: "config_confirmed" },
  }],
  ["npc_default", {
    roleId: "npc_default",
    name: "\u9ed8\u8ba4\u5bf9\u8bdd\u8005",
    actions: [{ actionType: "talk", label: "\u4ea4\u8c08" }],
    branches: [],
    defaultNarrativeLines: ["\u53ea\u6709\u9ed8\u8ba4\u53f0\u8bcd"],
  }],
  ["npc_blocked", {
    roleId: "npc_blocked",
    name: "\u53d7\u963b\u5bf9\u8bdd\u8005",
    actions: [{ actionType: "talk", label: "\u4ea4\u8c08" }],
    branches: [{
      conditionTokens: ["talk", "marker_blocked"],
      actionHints: ["talk"],
      narrativeLines: ["\u4e0d\u5e94\u6cc4\u6f0f"],
      resultTokens: [],
      resolvedResults: [],
    }],
    defaultNarrativeLines: ["\u4e0d\u5e94\u56de\u9000\u7684\u9ed8\u8ba4\u6587\u672c"],
  }],
]);

const interactables = new Map([
  ["item_a", {
    interactableId: "item_a",
    name: "\u6728\u5323",
    description: "\u4e00\u53ea\u65e7\u6728\u5323",
    canSee: true,
    actions: [{ actionType: "open", label: "\u6253\u5f00" }],
    branches: [{
      conditionTokens: ["open", "marker_ok"],
      actionHints: ["open"],
      narrativeLines: ["\u6728\u5323\u6253\u5f00\u4e86"],
      resultTokens: ["reward_1"],
      resolvedResults: [],
      evidenceLevel: "lua_confirmed",
    }],
  }],
  ["item_hidden", {
    interactableId: "item_hidden",
    name: "\u9690\u85cf\u673a\u5173",
    canSee: false,
    actions: [],
    branches: [],
  }],
]);

const evaluateBranch = (branch) => ({
  accepted: !(branch.conditionTokens || []).includes("marker_blocked"),
  checks: (branch.conditionTokens || []).map((token) => ({ token, accepted: token !== "marker_blocked" })),
});

const service = createEntityInteractionService({
  npcLookup: npcs,
  interactableLookup: interactables,
  entityInteractionPolicy: policy,
  combatActionPolicies: {
    compete: {
      actionType: "compete",
      startActionId: "combat_start",
      successConditionToken: "comparewin",
      failureConditionToken: "comparelose",
      runawayConditionToken: "comparerunaway",
      evidence: { level: "lua_confirmed" },
    },
  },
  branchEnabled: () => true,
  evaluateBranch,
  branchRequiresChoice: () => false,
  validateBranch: () => ({ accepted: true }),
});

const room = {
  roomId: "room_a",
  encounterIds: ["npc_a", "npc_replaced"],
  interactableIds: ["item_a", "item_hidden"],
};
const lifecycle = {
  hiddenEntityIds: new Set(["item_hidden"]),
  addedEntityIdsByRoom: new Map([["room_a", new Set(["npc_default", "npc_a"])]]),
  replacementEntityById: new Map([["npc_replaced", "npc_default"]]),
};

const activeIds = service.activeEntityIdsForRoom(room, lifecycle);
assert.deepEqual(activeIds, ["npc_a", "npc_default", "item_a"]);

const hiddenReplacementIds = service.activeEntityIdsForRoom({
  roomId: "room_a",
  encounterIds: ["npc_replaced"],
  interactableIds: [],
}, {
  hiddenEntityIds: new Set(["npc_default"]),
  replacementEntityById: new Map([["npc_replaced", "npc_default"]]),
});
assert.deepEqual(hiddenReplacementIds, [], "a hidden replacement must not revive the original entity");

const missingRoomContext = service.inspectNpcSelection({ roleId: "npc_a" });
assert.equal(missingRoomContext.accepted, false);
assert.equal(missingRoomContext.reason, "npc is not in selected room");

const mismatchedRoomContext = service.inspectNpcSelection({
  roleId: "npc_a",
  currentRoomId: "room_b",
  room,
  lifecycle,
});
assert.equal(mismatchedRoomContext.accepted, false);
assert.equal(mismatchedRoomContext.reason, "npc is not in selected room");

const unknownNpc = service.inspectNpcSelection({ roleId: "missing", currentRoomId: "room_a", room, lifecycle });
assert.equal(unknownNpc.accepted, false);
assert.equal(unknownNpc.reason, "unknown npc");

const validNpc = service.inspectNpcSelection({ roleId: "npc_a", currentRoomId: "room_a", room, lifecycle });
assert.equal(validNpc.accepted, true);
validNpc.entity.name = "mutated";
assert.equal(npcs.get("npc_a").name, "\u4f9b\u8bd5\u8005");

const hiddenItem = service.inspectInteractableSelection({
  interactableId: "item_hidden",
  currentRoomId: "room_a",
  room: { ...room, interactableIds: [...room.interactableIds] },
  lifecycle: { ...lifecycle, hiddenEntityIds: new Set() },
});
assert.equal(hiddenItem.accepted, false);
assert.equal(hiddenItem.reasonCode, "interactable_hidden");
assert.equal(hiddenItem.reason, "\u8be5\u7269\u4ef6\u5f53\u524d\u4e0d\u53ef\u89c1\u3002");

const talk = service.inspectNpcAction({ npc: npcs.get("npc_a"), actionType: "talk" });
assert.equal(talk.available, true);
assert.equal(talk.branch.narrativeLines[0], "\u6761\u4ef6\u4ea4\u8c08");

const defaultTalk = service.inspectNpcAction({ npc: npcs.get("npc_default"), actionType: "talk" });
assert.equal(defaultTalk.available, true);
assert.deepEqual(defaultTalk.branch.conditionTokens, ["words"]);
assert.deepEqual(defaultTalk.branch.narrativeLines, ["\u53ea\u6709\u9ed8\u8ba4\u53f0\u8bcd"]);

const blockedTalk = service.inspectNpcAction({ npc: npcs.get("npc_blocked"), actionType: "talk" });
assert.equal(blockedTalk.available, false);
assert.equal(blockedTalk.reason, "configured action conditions are not met");
assert.equal(blockedTalk.branch, null);

const combat = service.inspectNpcAction({ npc: npcs.get("npc_a"), actionType: "compete" });
assert.equal(combat.available, true);
assert.equal(combat.executionKind, "combat");
assert.equal(combat.combatPolicy.startActionId, "combat_start");
assert.deepEqual(combat.feedbackLines, ["\u4f60\u5411\u4f9b\u8bd5\u8005\u63d0\u51fa\u5207\u78cb\u3002"]);

const unrouted = service.inspectNpcAction({ npc: npcs.get("npc_a"), actionType: "unused" });
assert.equal(unrouted.visible, false);
assert.equal(unrouted.available, false);
assert.equal(unrouted.reason, "no configured runtime execution branch");

const saleFeedback = service.feedbackForNpcAction(npcs.get("npc_a"), { actionType: "sale", label: "\u4ea4\u6613" });
assert.deepEqual(saleFeedback.lines, ["\u4f9b\u8bd5\u8005\u6253\u5f00\u4e86\u4ea4\u6613\u5217\u8868\u3002", "\u53ef\u4ea4\u6613\u7269\u54c1\uff1atea;rice"]);

const itemDecision = service.inspectInteractableAction({ item: interactables.get("item_a"), actionType: "open" });
assert.equal(itemDecision.available, true);
assert.equal(itemDecision.branch.resultTokens[0], "reward_1");
assert.deepEqual(service.feedbackForInteractable(interactables.get("item_a")), ["\u6728\u5323\uff1a\u4e00\u53ea\u65e7\u6728\u5323"]);

const inputBranch = npcs.get("npc_a").branches[0];
talk.branch.narrativeLines[0] = "mutated";
assert.equal(inputBranch.narrativeLines[0], "\u6761\u4ef6\u4ea4\u8c08");

policy.branchRouting.dialogueActionType = "mutated_after_construction";
assert.equal(service.inspectNpcAction({ npc: npcs.get("npc_default"), actionType: "talk" }).available, true);

const missingPolicyService = createEntityInteractionService({ npcLookup: npcs, interactableLookup: interactables });
assert.equal(missingPolicyService.inspectNpcSelection({ roleId: "npc_a", currentRoomId: "", room: null }).accepted, false);
assert.equal(missingPolicyService.inspectNpcSelection({ roleId: "npc_a", currentRoomId: "", room: null }).reason, "entity interaction policy is not configured");

console.log("entity interaction service contract tests: PASS");
