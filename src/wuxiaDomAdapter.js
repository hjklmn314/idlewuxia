const DEFAULT_DOCUMENT = typeof document === "undefined" ? null : document;

function requireDocument(documentRef) {
  if (!documentRef || typeof documentRef.querySelector !== "function") {
    throw new TypeError("Wuxia DOM Adapter requires a document-like object.");
  }
  return documentRef;
}

function bindAll(scope, selector, handler) {
  for (const element of scope?.querySelectorAll?.(selector) || []) {
    handler(element);
  }
}

export function createWuxiaDomAdapter({
  documentRef = DEFAULT_DOCUMENT,
  execute,
  persistence,
}) {
  const documentObject = requireDocument(documentRef);
  if (typeof execute !== "function") throw new TypeError("Wuxia DOM Adapter requires an Intent executor.");

  const query = (selector, scope = documentObject) => scope.querySelector(selector);
  const queryAll = (selector, scope = documentObject) => [...(scope.querySelectorAll(selector) || [])];

  function bindPendingChoiceDialog(stage, choice, onResolveChoice) {
    const screen = query(".wuxia-screen", stage);
    if (screen) {
      screen.inert = true;
      screen.setAttribute("aria-hidden", "true");
    }
    const dialog = query(".wuxia-choice-dialog", stage);
    const buttons = queryAll("[data-wuxia-choice-option]", dialog || stage);
    if (!dialog || !buttons.length) return;
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const currentIndex = buttons.indexOf(documentObject.activeElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1)
        : (currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      buttons[nextIndex].focus();
    });
    buttons.forEach((button) => {
      button.onclick = () => onResolveChoice(button.dataset.wuxiaChoiceOption);
    });
    if (typeof documentObject.defaultView?.requestAnimationFrame === "function") {
      documentObject.defaultView.requestAnimationFrame(() => buttons[0]?.focus());
    } else {
      buttons[0]?.focus();
    }
  }

  function bindRenderedInteractions(stage, {
    onDispatchAction,
    onSelectNode,
    onResolveChoice,
    onSelectRoom,
    onSelectNpc,
    onInteractNpc,
    onSelectInteractable,
    onInteractInteractable,
  }) {
    bindAll(stage, "[data-wuxia-action-id]", (button) => {
      button.addEventListener("click", () => onDispatchAction(button.dataset.wuxiaActionId));
    });
    bindAll(stage, "[data-wuxia-node-id]", (button) => {
      button.addEventListener("click", () => onSelectNode(button.dataset.wuxiaNodeId));
    });
    bindAll(stage, ".wuxia-room-button, .wuxia-room-exit, .wuxia-room-direction", (button) => {
      button.addEventListener("click", () => onSelectRoom(button.dataset.wuxiaRoomId));
    });
    bindAll(stage, ".wuxia-npc-button", (button) => {
      button.addEventListener("click", () => onSelectNpc(button.dataset.wuxiaNpcId));
    });
    bindAll(stage, ".wuxia-npc-action", (button) => {
      button.addEventListener("click", () => onInteractNpc(
        button.dataset.wuxiaNpcId,
        button.dataset.wuxiaNpcAction,
      ));
    });
    bindAll(stage, ".wuxia-item-button", (button) => {
      button.addEventListener("click", () => onSelectInteractable(button.dataset.wuxiaInteractableId));
    });
    bindAll(stage, ".wuxia-item-action", (button) => {
      button.addEventListener("click", () => onInteractInteractable(
        button.dataset.wuxiaInteractableId,
        button.dataset.wuxiaInteractableAction,
      ));
    });
  }

  function bindTopButton(button, label, actionId, onDispatchAction) {
    if (!button) return;
    button.textContent = label || "";
    button.dataset.wuxiaActionId = actionId || "";
    button.disabled = !actionId;
    button.onclick = () => {
      if (actionId) onDispatchAction(actionId);
    };
  }

  function present({ presentation, markup, onDispatchAction, onSelectNode, onResolveChoice, onSelectRoom, onSelectNpc, onInteractNpc, onSelectInteractable, onInteractInteractable }) {
    const title = query("#wuxiaScreenTitle");
    const step = query("#wuxiaFlowStep");
    const stage = query(".wuxia-stage");
    if (!stage) throw new Error("Missing Wuxia stage root.");
    if (title) title.textContent = presentation.title;
    if (step) step.textContent = presentation.step;
    bindTopButton(query("[data-wuxia-action='back']"), presentation.screen.nav?.left, presentation.screen.navActions?.left, onDispatchAction);
    bindTopButton(query("[data-wuxia-action='home']"), presentation.screen.nav?.right, presentation.screen.navActions?.right, onDispatchAction);
    documentObject.body.dataset.runtime = "wuxia";
    documentObject.body.dataset.wuxiaState = presentation.snapshot.currentState || "";
    documentObject.body.dataset.wuxiaScreen = presentation.screenId;
    documentObject.body.dataset.wuxiaMode = presentation.screen.mode || "status";
    stage.dataset.screenMode = presentation.screen.mode || "status";
    stage.innerHTML = markup;
    bindRenderedInteractions(stage, {
      onDispatchAction,
      onSelectNode,
      onResolveChoice,
      onSelectRoom,
      onSelectNpc,
      onInteractNpc,
      onSelectInteractable,
      onInteractInteractable,
    });
    return stage;
  }

  function setBodyClass(className) {
    documentObject.body.classList.add(className);
  }

  function showConfigError(message) {
    setInnerHtml(".wuxia-stage", `
      <section class="wuxia-story-panel" role="alert">
        <p>配置加载失败。</p>
        <p>${String(message || "unknown error")}</p>
      </section>
    `);
  }

  function applyMobileLayout(layout = {}) {
    const root = documentObject.documentElement;
    if (layout.contentMaxWidthPx) root.style.setProperty("--wuxia-content-max-width", `${layout.contentMaxWidthPx}px`);
    for (const [key, value] of Object.entries(layout.safeArea || {})) {
      if (value) root.style.setProperty(`--wuxia-safe-${key}`, value);
    }
    documentObject.body.dataset.wuxiaOrientation = layout.orientation || "portrait";
    documentObject.body.dataset.wuxiaSafeArea = String(Boolean(layout.safeArea?.enabled));
  }

  function replace(selector, markup) {
    const node = query(selector);
    if (!node) return null;
    node.outerHTML = markup;
    return query(selector);
  }

  function setInnerHtml(selector, markup, scope = documentObject) {
    const node = query(selector, scope);
    if (node) node.innerHTML = markup;
    return node;
  }

  function setSelected(selector, predicate, scope = documentObject) {
    for (const node of queryAll(selector, scope)) node.classList.toggle("is-selected", predicate(node));
  }

  function installPersistenceLifecycle(contract, render) {
    if (!persistence || typeof persistence.save !== "function") return;
    for (const eventName of contract.lifecycleEvents || []) {
      documentObject.addEventListener(eventName, () => {
        if (eventName === "visibilitychange" && documentObject.visibilityState !== "hidden") return;
        persistence.save();
        if (typeof render === "function") render();
      });
    }
  }

  return Object.freeze({
    applyMobileLayout,
    bindPendingChoiceDialog,
    bindRenderedInteractions,
    present,
    installPersistenceLifecycle,
    query,
    queryAll,
    replace,
    setBodyClass,
    showConfigError,
    setInnerHtml,
    setSelected,
  });
}
