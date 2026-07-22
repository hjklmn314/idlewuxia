import { cloneData } from "./dataClone.js";

export const UI_INTENT_TYPES = Object.freeze([
  "dispatchAction",
  "selectNode",
  "selectRoom",
  "selectNpc",
  "interactNpc",
  "selectInteractable",
  "interactInteractable",
  "resolveChoice",
]);

const INTENT_CONTRACTS = Object.freeze({
  dispatchAction: { method: "dispatch", fields: ["actionId"] },
  selectNode: { method: "selectChapterNode", fields: ["nodeId"] },
  selectRoom: { method: "selectChapterRoom", fields: ["roomId"] },
  selectNpc: { method: "selectChapterNpc", fields: ["roleId"] },
  interactNpc: { method: "interactWithChapterNpc", fields: ["roleId", "actionType"] },
  selectInteractable: { method: "selectChapterInteractable", fields: ["interactableId"] },
  interactInteractable: { method: "interactWithChapterInteractable", fields: ["interactableId", "actionType"] },
  resolveChoice: { method: "resolvePendingChoice", fields: ["optionId"] },
});

function rejectedIntent(reason, intentType = "") {
  return { accepted: false, status: "rejected", reason, intentType };
}

function roomTitle(room) {
  return room?.displayName?.zhCN || room?.displayText?.zhCN || room?.roomId || "";
}

export function createUiFlowAdapter({ session, flowContract, screenContract }) {
  if (!session || typeof session.snapshot !== "function") {
    throw new TypeError("UI Flow Adapter requires a ChapterSession-compatible session.");
  }

  const detachedScreenContract = cloneData(screenContract || {});
  const screens = detachedScreenContract.screens || {};
  const states = cloneData(flowContract?.states || []);

  function snapshot() {
    return session.snapshot();
  }

  function present() {
    const runtimeSnapshot = snapshot();
    const stateId = runtimeSnapshot.currentState;
    const stateDefinition = states.find((entry) => entry.stateId === stateId);
    const screenId = runtimeSnapshot.state?.screenId
      || stateDefinition?.screenId
      || detachedScreenContract.defaultStartScreen
      || stateId;
    const screenDefinition = screens[screenId];
    if (!screenDefinition) throw new Error(`Missing screen contract: ${screenId}`);
    const screen = cloneData(screenDefinition);
    const dynamicRoomTitle = screen.body?.some((block) => block.type === "roomExplore")
      ? roomTitle(runtimeSnapshot.chapter?.selectedRoom)
      : "";
    return {
      stateId,
      screenId,
      screen,
      title: dynamicRoomTitle || screen.nav?.center || screen.title || "",
      step: dynamicRoomTitle || screen.title || screen.step || "",
      mode: screen.mode || "",
      snapshot: runtimeSnapshot,
    };
  }

  function execute(intent) {
    const intentType = typeof intent?.type === "string" ? intent.type : "";
    const contract = INTENT_CONTRACTS[intentType];
    if (!contract) return rejectedIntent("unsupported_ui_intent", intentType);
    const allowedKeys = new Set(["type", ...contract.fields]);
    if (
      !intent
      || Object.keys(intent).some((key) => !allowedKeys.has(key))
      || contract.fields.some((field) => typeof intent[field] !== "string" || !intent[field].trim())
    ) {
      return rejectedIntent("invalid_ui_intent", intentType);
    }
    const method = session[contract.method];
    if (typeof method !== "function") return rejectedIntent("unsupported_session_command", intentType);
    return cloneData(method(...contract.fields.map((field) => intent[field])));
  }

  return Object.freeze({ execute, present, snapshot });
}
