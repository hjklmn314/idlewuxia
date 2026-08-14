function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function sideFor(unitId, playerUnitIds, enemyUnitIds) {
  if (playerUnitIds.includes(unitId)) return "player";
  if (enemyUnitIds.includes(unitId)) return "enemy";
  return "enemy";
}

function stateForToken({ unit, index, turnIndex, status }) {
  const alive = unit?.alive !== false && safeNumber(unit?.hp, 1) > 0;
  if (!alive) return "defeated";
  if (status === "finished") return "finished";
  if (status === "active" && index === turnIndex) return "current";
  return "future";
}

export function buildCombatTopHudModel({ contract = {}, encounterId = "", encounterLabel = "", round = 0, status = "preview", paused = false, turnOrder = [], turnIndex = 0, units = [], playerUnitIds = [], enemyUnitIds = [] } = {}) {
  const unitList = asArray(units).filter((unit) => unit?.unitId);
  const unitById = new Map(unitList.map((unit) => [unit.unitId, unit]));
  const players = asArray(playerUnitIds);
  const enemies = asArray(enemyUnitIds);
  const configuredOrder = asArray(turnOrder).filter((unitId) => unitById.has(unitId));
  const fallbackOrder = [...players, ...enemies].filter((unitId, index, all) => unitById.has(unitId) && all.indexOf(unitId) === index);
  const orderedIds = (configuredOrder.length ? configuredOrder : fallbackOrder).slice(0, Math.max(3, Number(contract.turnOrder?.maxVisibleTokens || 7)));
  const currentIndex = status === "active"
    ? Math.max(0, Math.min(orderedIds.length - 1, Number(turnIndex || 0)))
    : -1;
  const labels = contract.stateLabels || {};
  const sideSemantics = contract.sideSemantics || {};
  const tokens = orderedIds.map((unitId, index) => {
    const unit = unitById.get(unitId) || {};
    const side = sideFor(unitId, players, enemies);
    const tokenState = stateForToken({ unit, index, turnIndex: currentIndex, status });
    const sideDefinition = sideSemantics[side] || {};
    const displayName = unit.name || unit.displayName || contract.fallbackPolicy?.missingDisplayName || unitId;
    const actorMount = unit.actorMount || unit.visual?.actorMount || `${side}-stage-${unitId}`;
    const symbol = unit.visual?.symbol || unit.symbol || contract.fallbackPolicy?.missingUnitSymbol || "·";
    return {
      unitId,
      side,
      displayName,
      alive: tokenState !== "defeated",
      actorMount,
      turnIndex: index,
      state: tokenState,
      stateLabel: labels[tokenState] || tokenState,
      sideLabel: sideDefinition.label || side,
      sideLabelKey: sideDefinition.labelKey || `combat.side.${side}`,
      shape: sideDefinition.shape || side,
      symbol,
    };
  });
  const current = tokens.find((token) => token.state === "current") || null;
  const next = current ? tokens.slice(current.turnIndex + 1).find((token) => token.state === "future") || null : null;
  return {
    screenId: contract.screenId || "UI_EarlyCombat",
    encounterId,
    encounterLabel: encounterLabel || contract.contextLabels?.defaultEncounter || "战斗",
    round: Math.max(0, safeNumber(round, 0)),
    status,
    paused: Boolean(paused),
    currentActorId: current?.unitId || "",
    nextActorId: next?.unitId || "",
    tokens,
    labels: contract.contextLabels || {},
  };
}

export function renderCombatTopHud(model, { escape = escapeHtml } = {}) {
  const labels = model.labels || {};
  const contextState = model.paused
    ? (labels.paused || "已暂停")
    : model.status === "finished"
      ? (labels.finished || "战斗结束")
      : "";
  const pauseLabel = model.paused ? (labels.resume || "继续") : (labels.pause || "暂停");
  const tokenMarkup = model.tokens.map((token) => {
    const tokenLabel = `${token.sideLabel} ${token.displayName}·${token.stateLabel}`;
    return `<li class="wuxia-combat-top-token ${escape(token.side)} ${escape(token.state)} ${escape(token.shape)}" data-wuxia-combat-top-token="${escape(token.unitId)}" data-wuxia-combat-unit-id="${escape(token.unitId)}" data-wuxia-combat-side="${escape(token.side)}" data-wuxia-combat-alive="${token.alive ? "true" : "false"}" data-wuxia-combat-actor-mount="${escape(token.actorMount)}" data-wuxia-combat-turn-index="${escape(token.turnIndex)}" aria-label="${escape(tokenLabel)}"><span class="wuxia-combat-top-token-symbol" aria-hidden="true">${escape(token.symbol)}</span><span class="wuxia-combat-top-token-name">${escape(token.displayName)}</span><span class="wuxia-combat-top-token-state">${escape(token.stateLabel)}</span></li>`;
  }).join('<li class="wuxia-combat-top-arrow" aria-hidden="true">›</li>');
  return `
    <header class="wuxia-combat-top-hud" data-testid="combat-top-hud" data-wuxia-combat-top-status="${escape(model.status)}" data-wuxia-combat-top-paused="${model.paused ? "true" : "false"}" data-wuxia-combat-top-current-actor="${escape(model.currentActorId)}" data-wuxia-combat-top-next-actor="${escape(model.nextActorId)}" aria-label="${escape(labels.encounter || "遭遇")}">
      <div class="wuxia-combat-top-context" data-wuxia-combat-top-zone="context">
        <div class="wuxia-combat-top-context-copy"><span>${escape(labels.encounter || "遭遇")}</span><strong>${escape(model.encounterLabel || "战斗")}</strong><small>${escape(labels.round || "回合")} ${escape(model.round)}</small>${contextState ? `<em>${escape(contextState)}</em>` : ""}</div>
        <button type="button" class="wuxia-combat-top-pause" data-wuxia-combat-top-pause="true" aria-label="${escape(pauseLabel)}">${escape(model.paused ? "▶" : "Ⅱ")}</button>
      </div>
      <ol class="wuxia-combat-top-turn-order" data-wuxia-combat-top-zone="turn-order" aria-label="${escape(labels.next || "回合顺序")}">${tokenMarkup}</ol>
      <div class="wuxia-combat-top-legend" data-wuxia-combat-top-zone="state-legend" aria-label="${escape(labels.legend || "状态图例")}"><span class="player">${escape(model.tokens.find((token) => token.side === "player")?.sideLabel || "我方")}</span><span class="enemy">${escape(model.tokens.find((token) => token.side === "enemy")?.sideLabel || "敌方")}</span><span class="current">${escape(labels.current || "当前行动")}</span><span class="defeated">${escape(labels.defeated || "已倒地")}</span></div>
    </header>
  `;
}
