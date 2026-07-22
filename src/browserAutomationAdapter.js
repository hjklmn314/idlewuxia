function automationText(intent, result) {
  const event = result?.event || {};
  if (event.feedback) return event.feedback;
  if (event.optionLabel) return event.optionLabel;
  if (event.displayText?.zhCN) return event.displayText.zhCN;
  if (event.displayText?.rawCompetitorText) return event.displayText.rawCompetitorText;
  if (event.name) return event.name;
  return intent.actionId
    || intent.nodeId
    || intent.roomId
    || intent.roleId
    || intent.interactableId
    || intent.optionId
    || intent.actionType
    || "";
}

export function createBrowserAutomationAdapter({ uiFlowAdapter, render, persistence }) {
  if (!uiFlowAdapter || typeof uiFlowAdapter.execute !== "function" || typeof uiFlowAdapter.snapshot !== "function") {
    throw new TypeError("Browser Automation Adapter requires a UI Flow Adapter.");
  }
  const renderView = typeof render === "function" ? render : () => {};

  function execute(intent) {
    const result = uiFlowAdapter.execute(intent);
    renderView();
    return {
      clicked: Boolean(result?.accepted),
      reason: result?.event?.reason || result?.reason || "",
      ...Object.fromEntries(Object.entries(intent).filter(([key]) => key !== "type")),
      intentType: intent.type,
      text: automationText(intent, result),
      automation: true,
    };
  }

  return Object.freeze({
    dispatchAction: (actionId) => execute({ type: "dispatchAction", actionId }),
    selectNode: (nodeId) => execute({ type: "selectNode", nodeId }),
    selectRoom: (roomId) => execute({ type: "selectRoom", roomId }),
    selectNpc: (roleId) => execute({ type: "selectNpc", roleId }),
    interactNpc: (roleId, actionType) => execute({ type: "interactNpc", roleId, actionType }),
    selectInteractable: (interactableId) => execute({ type: "selectInteractable", interactableId }),
    interactInteractable: (interactableId, actionType) => execute({ type: "interactInteractable", interactableId, actionType }),
    resolveChoice: (optionId) => execute({ type: "resolveChoice", optionId }),
    snapshot: () => uiFlowAdapter.snapshot(),
    persistenceStatus: () => persistence?.status() || { status: "unavailable" },
    clearSave: () => persistence?.clear() || { status: "unavailable" },
  });
}
