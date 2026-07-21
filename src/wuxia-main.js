import { createFirstSessionRuntime, summarizeFirstSessionContract } from "./wuxiaFirstSessionFlow.js";
import { cloneData } from "./dataClone.js";
import { evidenceSummary } from "./evidenceContract.js";
import { createRuntimePersistence } from "./runtimePersistence.js";

const CONFIG_FILES = {
  wuxiaFirstSessionFlow: "./config/wuxia_first_session_flow.json",
  wuxiaScreenContract: "./config/wuxia_first_session_screen_contract.json",
  wuxiaRuntimePersistence: "./config/runtime_persistence_contract.json",
};

const state = {
  config: null,
  runtime: null,
  persistence: null,
  persistenceLifecycleInstalled: false,
  combatPlayback: {
    key: "",
    startedAt: 0,
    timer: null,
    resolvedKey: "",
  },
};

function activeChapterFromFlow(flowContract = {}) {
  return flowContract?.chapter
    || flowContract?.activeChapter
    || flowContract?.chapters?.[flowContract?.chapterSystem?.defaultChapterId]
    || Object.values(flowContract?.chapters || {})[0]
    || flowContract?.chapter1
    || {};
}

function activeChapterFromSnapshot(snapshot = {}) {
  return snapshot?.chapter || snapshot?.chapter1 || {};
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

async function loadConfig() {
  const entries = await Promise.all(
    Object.entries(CONFIG_FILES).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return [key, await response.json()];
    }),
  );
  return Object.fromEntries(entries);
}

function renderConfigError(error) {
  const stage = document.querySelector(".wuxia-stage");
  if (!stage) return;
  stage.innerHTML = `
    <section class="wuxia-story-panel" role="alert">
      <p>配置加载失败。</p>
      <p>${escapeHtml(error?.message || error)}</p>
    </section>
  `;
}

function playerStatValue(item, player) {
  if (!item?.field) return item?.value || "";
  const value = Number(player[item.field] ?? 0);
  if (item.maxField) {
    const max = Number(player[item.maxField] ?? 0);
    if (item.showPercent && max > 0) return `${value}/${max} (${Math.round((value / max) * 100)}%)`;
    return `${value}/${max}`;
  }
  return `${value}`;
}

function renderCombatant(unit, side) {
  return `<div class="wuxia-combatant ${side}"><strong>${escapeHtml(unit?.name || "")}</strong><span class="hp">${escapeHtml(unit?.hp || "")}</span><span class="mp">${escapeHtml(unit?.mp || "")}</span></div>`;
}

function percentValue(current, max) {
  const safeMax = Math.max(1, Number(max || 0));
  const value = Math.max(0, Math.min(safeMax, Number(current || 0)));
  return Math.round((value / safeMax) * 100);
}

function renderCombatBar(label, current, max, className) {
  const percent = percentValue(current, max);
  return `
    <div class="wuxia-combat-bar ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(`${current}/${max}`)}</strong>
      <i style="width:${percent}%"></i>
    </div>
  `;
}

function renderCombatRuntimeUnit(unit, side) {
  const buffs = Array.isArray(unit?.buffs) ? unit.buffs : [];
  return `
    <article class="wuxia-runtime-unit ${side}" data-wuxia-combat-side="${escapeHtml(side)}">
      <header>
        <strong>${escapeHtml(unit?.name || "")}</strong>
        <small>${escapeHtml(unit?.roleLabel || "")}</small>
      </header>
      ${renderCombatBar("HP", unit?.hp ?? 0, unit?.hpMax ?? 1, "hp")}
      ${renderCombatBar("MP", unit?.mp ?? 0, unit?.mpMax ?? 1, "mp")}
      <div class="wuxia-runtime-buffs">
        ${buffs.length ? buffs.map((buff) => `<span title="${escapeHtml(buff.description || buff.name || buff.buffId || "")}">${escapeHtml(buff.iconLabel || buff.name || buff.buffId || "")}</span>`).join("") : `<em>${escapeHtml(unit?.emptyBuffText || "")}</em>`}
      </div>
    </article>
  `;
}

function renderCombatFighter(unit, side) {
  const visual = unit?.visual || {};
  return `
    <div class="wuxia-runtime-fighter ${escapeHtml(side)} ${escapeHtml(visual.pose || "guard")}" data-wuxia-fighter="${escapeHtml(side)}">
      <div class="wuxia-runtime-fighter-shadow" aria-hidden="true"></div>
      <div class="wuxia-runtime-fighter-body" aria-label="${escapeHtml(unit?.name || "")}">
        <span>${escapeHtml(visual.symbol || "")}</span>
      </div>
    </div>
  `;
}

function renderCombatLogEvent(event) {
  const lines = Array.isArray(event?.logLines) && event.logLines.length
    ? event.logLines
    : [event?.text || ""];
  return lines.filter(Boolean).map((line, index) => {
    const tone = Array.isArray(event?.logTones) ? event.logTones[index] : "";
    return `<p class="${escapeHtml(tone || (event?.kind === "damage" ? "damage" : ""))}">${escapeHtml(line)}</p>`;
  }).join("");
}

function combatPreviewForBlock(block, flowContract) {
  const previewId = block.previewId || flowContract?.defaultCombatPreviewId || "";
  return flowContract?.combatPreviews?.[previewId] || null;
}

function combatEventTimeMs(event) {
  const value = Number.parseFloat(String(event?.time || "0").replace("s", ""));
  return Number.isFinite(value) ? Math.max(0, value * 1000) : 0;
}

function combatPreviewForSnapshot(block, flowContract, snapshot) {
  const preview = combatPreviewForBlock(block, flowContract);
  if (!preview) return null;
  const sourceId = snapshot?.pendingCombat?.sourceId || "";
  const source = sourceId
    ? (activeChapterFromFlow(flowContract).npcs || []).find((npc) => npc.roleId === sourceId)
    : null;
  if (!source) return preview;
  const right = preview.units?.right || {};
  return {
    ...preview,
    units: {
      ...(preview.units || {}),
      right: {
        ...right,
        unitId: source.roleId,
        name: source.name || source.displayName?.zhCN || right.name,
        roleLabel: source.baseId || right.roleLabel,
        hp: Number(source.qi || right.hp || 1),
        hpMax: Number(source.qi || right.hpMax || 1),
        mp: Number(source.neili || right.mp || 0),
        mpMax: Number(source.neili || right.mpMax || 1),
      },
    },
  };
}

function currentCombatElapsedMs(snapshot, preview) {
  const key = `${snapshot?.currentState || ""}:${snapshot?.pendingCombat?.sourceId || preview?.previewId || ""}`;
  if (state.combatPlayback.key !== key) {
    state.combatPlayback.key = key;
    state.combatPlayback.startedAt = Date.now();
    state.combatPlayback.resolvedKey = "";
  }
  return Math.max(0, Date.now() - state.combatPlayback.startedAt);
}

function replayCombatUnits(preview, visibleEvents) {
  const left = cloneData(preview.units?.left || {});
  const right = cloneData(preview.units?.right || {});
  for (const event of visibleEvents) {
    const value = Number(event?.value || 0);
    if (value >= 0) continue;
    const targetSide = event.targetSide || (event.actor === left.name ? "right" : "left");
    const unit = targetSide === "right" ? right : left;
    unit.hp = Math.max(0, Number(unit.hp || 0) + value);
  }
  return { left, right };
}

function renderCombatRuntime(block, flowContract, snapshot) {
  const preview = combatPreviewForSnapshot(block, flowContract, snapshot);
  if (!preview) return `<section class="wuxia-combat-runtime is-missing">Missing combat preview: ${escapeHtml(block.previewId || "")}</section>`;
  const events = Array.isArray(preview.events) ? preview.events : [];
  const elapsedMs = currentCombatElapsedMs(snapshot, preview);
  const visibleEvents = events.filter((event) => combatEventTimeMs(event) <= elapsedMs);
  const { left, right } = replayCombatUnits(preview, visibleEvents);
  const latestFloaters = visibleEvents.slice(-2);
  const scene = preview.scene || {};
  const totalDurationMs = Math.max(0, ...events.map(combatEventTimeMs));
  return `
    <section class="wuxia-combat-runtime" data-testid="combat-runtime" data-wuxia-preview-id="${escapeHtml(preview.previewId || block.previewId || "")}" data-wuxia-combat-playing="${elapsedMs < totalDurationMs}">
      <div class="wuxia-combat-runtime-stage" data-wuxia-scene-theme="${escapeHtml(scene.theme || "courtyard")}">
        <div class="wuxia-runtime-scene-backdrop" aria-hidden="true"><i></i><b></b><em></em></div>
        ${renderCombatRuntimeUnit(left, "left")}
        ${renderCombatFighter(left, "left")}
        <div class="wuxia-runtime-hitline" aria-hidden="true"></div>
        ${renderCombatRuntimeUnit(right, "right")}
        ${renderCombatFighter(right, "right")}
        <div class="wuxia-runtime-floaters">
          ${latestFloaters.map((event) => `<span class="${escapeHtml(event.kind || "event")}">${escapeHtml(event.floatText || event.text || "")}</span>`).join("")}
        </div>
      </div>
      <div class="wuxia-combat-runtime-log">
        ${visibleEvents.length ? visibleEvents.slice(-4).map(renderCombatLogEvent).join("") : `<p>${escapeHtml(block.waitingText || "")}</p>`}
      </div>
    </section>
  `;
}

function chapterNodeTypeLabel(nodeType, block) {
  const configured = block?.nodeTypeLabels?.[nodeType];
  return configured || String(nodeType || "").replace(/_/g, " ");
}

function isPlayerVisibleChapterNode(node) {
  return Boolean(node)
    && !node.isProjectBridge
    && !node.hideFromMap
    && node.nodeType !== "chapter_settlement";
}

function compactList(values, names = []) {
  const list = Array.isArray(values) ? values : [];
  const nameList = Array.isArray(names) ? names : [];
  return list
    .map((value, index) => {
      const label = nameList[index] || "";
      return label && label !== value ? `${label}(${value})` : value;
    })
    .filter(Boolean);
}

function evidenceText(evidence) {
  return evidenceSummary(evidence);
}

function renderNodeFact(label, values, emptyText = "") {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!list.length && !emptyText) return "";
  return `
    <div class="wuxia-node-fact">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(list.length ? list.join(" / ") : emptyText)}</strong>
    </div>
  `;
}

function renderNodeDetail(event, presentation = {}) {
  const labels = presentation.detailLabels || {};
  const rewards = (event.rewards || []).map((reward) => {
    if (!reward || reward.missing) return reward?.rewardId || "";
    const amounts = [
      reward.exp ? `经验 ${reward.exp}` : "",
      reward.pot ? `潜能 ${reward.pot}` : "",
      reward.yueli ? `阅历 ${reward.yueli}` : "",
      reward.money ? `金钱 ${reward.money}` : "",
      reward.items ? `物品 ${reward.items}` : "",
    ].filter(Boolean).join(" ");
    return amounts ? `${reward.rewardId}: ${amounts}` : reward.rewardId;
  });
  return `
    <div class="wuxia-node-detail-grid">
      ${renderNodeFact(labels.sourceRooms || "房间", compactList(event.sourceRooms, event.sourceRoomNames))}
      ${renderNodeFact(labels.interactables || "人物", compactList(event.interactables, event.interactableNames))}
      ${renderNodeFact(labels.gates || "门槛", (event.gates || []).map((gate) => gate.gateId || ""))}
      ${renderNodeFact(labels.encounters || "战斗", event.encounters || [], labels.noEncounters || "无")}
      ${renderNodeFact(labels.rewards || "奖励", rewards, labels.noRewards || "无")}
      ${renderNodeFact(labels.connections || "出口", event.connections || [], labels.noConnections || "无")}
      ${presentation.showEvidence ? renderNodeFact(labels.evidence || "证据", [evidenceText(event.evidence)].filter(Boolean)) : ""}
    </div>
  `;
}

function roomTitle(room) {
  return room?.displayName?.zhCN || room?.displayText?.zhCN || room?.roomId || "";
}

function readablePairs(ids = [], names = []) {
  return (ids || [])
    .map((id, index) => names?.[index] || id)
    .filter(Boolean);
}

function connectionText(connection, roomById) {
  const target = roomById.get(connection?.roomId);
  const targetName = roomTitle(target) || connection?.roomId || "";
  return [connection?.direction, targetName].filter(Boolean).join(" -> ");
}

function roomByIdForFlow() {
  return new Map((activeChapterFromFlow(state.config?.wuxiaFirstSessionFlow || {}).rooms || []).map((room) => [room.roomId, room]));
}

function npcByIdForFlow() {
  return new Map((activeChapterFromFlow(state.config?.wuxiaFirstSessionFlow || {}).npcs || []).map((npc) => [npc.roleId, npc]));
}

function interactableByIdForFlow() {
  return new Map((activeChapterFromFlow(state.config?.wuxiaFirstSessionFlow || {}).interactables || []).map((item) => [item.interactableId, item]));
}

function mapExploreBlockForSnapshot(snapshot) {
  const screen = state.config?.wuxiaScreenContract?.screens?.[snapshot?.state?.screenId];
  return screen?.body?.find((block) => block.type === "roomExplore") || null;
}

function directionLabel(direction, block = {}) {
  const labels = block.directionLabels || {};
  return labels[direction] || direction || "";
}

function runtimeRoomEntityIds(room, snapshot) {
  const chapter = activeChapterFromSnapshot(snapshot);
  const hidden = new Set(chapter?.hiddenEntityIds || []);
  const dynamicByRoom = chapter?.dynamicEntityIdsByRoom || {};
  const replacements = chapter?.replacementEntityById || {};
  const seen = new Set();
  const ordered = [];
  const append = (entityId) => {
    const replacementId = replacements[entityId];
    const resolvedId = replacementId || entityId;
    if (!resolvedId || hidden.has(resolvedId) || seen.has(resolvedId)) return;
    ordered.push(resolvedId);
    seen.add(resolvedId);
  };
  for (const entityId of [...(room?.encounterIds || []), ...(room?.interactableIds || [])]) append(entityId);
  for (const entityId of dynamicByRoom[room?.roomId || ""] || []) {
    append(entityId);
  }
  return ordered;
}

function roomPeople(room, flowContract, snapshot) {
  const npcById = new Map((activeChapterFromFlow(flowContract).npcs || []).map((npc) => [npc.roleId, npc]));
  const ids = runtimeRoomEntityIds(room, snapshot);
  const seen = new Set();
  return ids
    .map((roleId) => {
      if (!roleId || seen.has(roleId) || !npcById.has(roleId)) return null;
      seen.add(roleId);
      return npcById.get(roleId);
    })
    .filter(Boolean);
}

function roomObjects(room, flowContract, snapshot) {
  const chapter = activeChapterFromFlow(flowContract);
  const itemById = new Map((chapter.interactables || []).map((item) => [item.interactableId, item]));
  const npcById = new Map((chapter.npcs || []).map((npc) => [npc.roleId, npc]));
  const seen = new Set();
  return runtimeRoomEntityIds(room, snapshot)
    .map((interactableId) => {
      if (!interactableId || seen.has(interactableId) || npcById.has(interactableId)) return null;
      seen.add(interactableId);
      const item = itemById.get(interactableId);
      if (!item || !item.canSee) return null;
      return item;
    })
    .filter(Boolean);
}

export function lastNpcLog(snapshot, room, block = {}) {
  const lastEvent = [...(snapshot?.events || [])].reverse().find((event) => (
    event.type === "combatResolved"
    || event.type === "combatResolutionRejected"
    || event.type === "npcInteraction"
    || event.type === "npcInteractionRejected"
    || event.type === "npcSelected"
    || event.type === "interactableInteraction"
    || event.type === "interactableInteractionRejected"
    || event.type === "interactableSelected"
    || event.type === "roomBlocked"
    || event.type === "roomSelected"
  ));
  if (lastEvent?.type === "combatResolved") return lastEvent.feedbackLines || [lastEvent.feedback].filter(Boolean);
  if (lastEvent?.type === "combatResolutionRejected") return lastEvent.feedbackLines || [lastEvent.reason].filter(Boolean);
  if (lastEvent?.type === "npcInteraction" || lastEvent?.type === "npcInteractionRejected") return lastEvent.feedbackLines || [lastEvent.feedback].filter(Boolean);
  if (lastEvent?.type === "roomBlocked") return lastEvent.feedbackLines || [lastEvent.feedback].filter(Boolean);
  if (lastEvent?.type === "npcSelected") {
    return [`你选择了${lastEvent.name || "对方"}。`];
  }
  if (lastEvent?.type === "interactableInteraction" || lastEvent?.type === "interactableInteractionRejected") {
    return lastEvent.feedbackLines || [lastEvent.feedback || lastEvent.reason].filter(Boolean);
  }
  if (lastEvent?.type === "interactableSelected") {
    return lastEvent.description
      ? [lastEvent.description]
      : [`你查看了${lastEvent.name || "物件"}。`];
  }
  if (lastEvent?.type === "roomSelected") {
    return [`你进入了${roomTitle(room)}。`];
  }
  const templateLines = block.logLines || ["你进入了{roomName}。"];
  return templateLines.map((line) => line.replace("{roomName}", roomTitle(room)));
}

function conditionRequirementText(availability = {}) {
  if (availability.available) return "";
  const checks = (availability.checks || []).filter((check) => check.accepted === false);
  const first = checks[0];
  if (first?.status === "checked_sect_eq") return `需加入 ${first.expectedLabel || first.expected || ""}`;
  if (first?.status === "checked_sect_ne") return `需非 ${first.expectedLabel || first.expected || ""}`;
  if (String(first?.status || "").startsWith("checked_inheritable_marker_")) {
    const operator = first.status.endsWith("gt") ? ">" : first.status.endsWith("lt") ? "<" : "=";
    return `${first.marker || "标记"} ${operator} ${first.expected}`;
  }
  if (first?.field && first?.expected != null) return `${first.field} ${first.status?.endsWith("gt") ? ">" : first.status?.endsWith("lt") ? "<" : "="} ${first.expected}`;
  if (first?.marker && first?.expected != null) return `${first.marker} = ${first.expected}`;
  return "当前条件不足";
}

function renderNpcPanel(npc, snapshot) {
  if (!npc) return "";
  const availabilityByAction = new Map((snapshot?.chapter?.selectedNpcActionAvailability || []).map((entry) => [entry.actionType, entry]));
  const visibleActions = (npc.actions || []).filter((action) => availabilityByAction.get(action.actionType)?.visible !== false);
  return `
    <section class="wuxia-npc-panel" data-testid="room-npc-panel" aria-live="polite">
      <header>
        <strong>${escapeHtml(npc.name || npc.displayName?.zhCN || "")}</strong>
        <span>${escapeHtml(visibleActions.map((action) => action.label).filter(Boolean).join(" / "))}</span>
      </header>
      <div class="wuxia-npc-actions">
        ${visibleActions.map((action) => {
          const availability = availabilityByAction.get(action.actionType) || { available: true };
          const requirement = conditionRequirementText(availability);
          return `
            <button type="button" class="wuxia-npc-action ${availability.available ? "" : "is-locked"}" data-testid="room-npc-action" data-wuxia-npc-id="${escapeHtml(npc.roleId)}" data-wuxia-npc-action="${escapeHtml(action.actionType)}" aria-disabled="${!availability.available}" title="${escapeHtml(requirement)}">
              <span>${escapeHtml(action.label)}</span>${requirement ? `<small>${escapeHtml(requirement)}</small>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderItemPanel(item, snapshot) {
  if (!item) return "";
  const availabilityByAction = new Map(
    (snapshot?.chapter?.selectedInteractableActionAvailability || []).map((entry) => [entry.actionType, entry]),
  );
  const visibleActions = (item.actions || []).filter((action) => availabilityByAction.get(action.actionType)?.visible !== false);
  return `
    <section class="wuxia-npc-panel wuxia-item-panel" data-testid="room-item-panel" aria-live="polite">
      <header>
        <strong>${escapeHtml(item.name || item.interactableId || "")}</strong>
        <span>${escapeHtml(visibleActions.map((action) => action.label).filter(Boolean).join(" / "))}</span>
      </header>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      <div class="wuxia-npc-actions">
        ${visibleActions.map((action) => {
          const availability = availabilityByAction.get(action.actionType) || { available: true };
          const requirement = conditionRequirementText(availability);
          const locked = !availability.available;
          return `
            <button type="button" class="wuxia-item-action ${locked ? "is-locked" : ""}" data-testid="room-item-action" data-wuxia-interactable-id="${escapeHtml(item.interactableId)}" data-wuxia-interactable-action="${escapeHtml(action.actionType)}" aria-disabled="${locked}" title="${escapeHtml(requirement)}"${locked ? " disabled" : ""}>
              <span>${escapeHtml(action.label)}</span>${requirement ? `<small>${escapeHtml(requirement)}</small>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderRoomExplore(block, flowContract, snapshot) {
  const chapter = activeChapterFromFlow(flowContract);
  const snapshotChapter = activeChapterFromSnapshot(snapshot);
  const roomById = new Map((chapter.rooms || []).map((room) => [room.roomId, room]));
  const selectedRoomId = snapshotChapter?.selectedRoomId || block.defaultRoomId || chapter.rooms?.[0]?.roomId || "";
  const room = roomById.get(selectedRoomId) || chapter.rooms?.[0] || null;
  if (!room) return `<section class="wuxia-room-explore">${escapeHtml(block.missingRoomText || "房间配置缺失")}</section>`;
  const people = roomPeople(room, flowContract, snapshot);
  const objects = roomObjects(room, flowContract, snapshot);
  const selectedNpcId = snapshotChapter?.selectedNpcId || "";
  const selectedNpc = selectedNpcId && people.some((npc) => npc.roleId === selectedNpcId) ? npcByIdForFlow().get(selectedNpcId) : null;
  const selectedInteractableId = snapshotChapter?.selectedInteractableId || "";
  const selectedItem = selectedInteractableId && objects.some((item) => item.interactableId === selectedInteractableId)
    ? interactableByIdForFlow().get(selectedInteractableId)
    : null;
  const logLines = lastNpcLog(snapshot, room, block);
  const hasPresence = people.length || objects.length;
  const exitAvailability = new Map((snapshotChapter?.exitAvailability || []).map((entry) => [entry.roomId, entry]));
  const groupedConnections = new Map();
  for (const connection of room.connections || []) {
    const direction = connection.direction || "none";
    const items = groupedConnections.get(direction) || [];
    items.push(connection);
    groupedConnections.set(direction, items);
  }
  return `
    <section class="wuxia-room-explore" data-testid="room-explore" data-wuxia-room-id="${escapeHtml(room.roomId || "")}">
      <div class="wuxia-room-viewport">
        <div class="wuxia-room-title">
          <strong>${escapeHtml(roomTitle(room))}</strong>
          <span>${escapeHtml(block.roomHint || "选择出口移动，选择人物或物件交互。")}</span>
        </div>
        <div class="wuxia-room-grid">
          ${[...groupedConnections.entries()].map(([direction, connections]) => `
            <div class="wuxia-room-direction-stack dir-${escapeHtml(direction)}" data-wuxia-direction="${escapeHtml(direction)}">
              ${connections.map((connection) => {
                const target = roomById.get(connection.roomId);
                const availability = exitAvailability.get(connection.roomId) || { available: true };
                const blockedText = availability.available ? "" : (availability.feedbackLines || [])[0] || availability.blockerName || "";
                return `
                  <button type="button" class="wuxia-room-direction ${availability.available ? "" : "is-locked"}" data-wuxia-room-id="${escapeHtml(connection.roomId || "")}" aria-disabled="${!availability.available}" title="${escapeHtml(blockedText)}"${availability.available ? "" : " disabled"}>
                    <small>${escapeHtml(directionLabel(connection.direction, block))}</small>
                    <strong>${escapeHtml(roomTitle(target) || connection.roomId || "")}</strong>
                    ${blockedText ? `<em>${escapeHtml(blockedText)}</em>` : ""}
                  </button>
                `;
              }).join("")}
            </div>
          `).join("")}
          <div class="wuxia-room-current" data-testid="room-current">${escapeHtml(roomTitle(room))}</div>
        </div>
      </div>
      <section class="wuxia-room-presence" data-testid="room-presence">
        <span>${escapeHtml(block.presenceLabel || "这里有：")}</span>
        <div>
          ${hasPresence
            ? `
              ${people.map((npc) => `
              <button type="button" class="wuxia-npc-button ${npc.roleId === selectedNpcId ? "is-selected" : ""}" data-testid="room-npc-button" data-wuxia-npc-id="${escapeHtml(npc.roleId)}">
                ${escapeHtml(npc.name || npc.displayName?.zhCN || "")}
              </button>
              `).join("")}
              ${objects.map((item) => `
                <button type="button" class="wuxia-npc-button wuxia-item-button ${item.interactableId === selectedInteractableId ? "is-selected" : ""}" data-testid="room-item-button" data-wuxia-interactable-id="${escapeHtml(item.interactableId)}">
                  ${escapeHtml(item.name || item.interactableId || "")}
                </button>
              `).join("")}
            `
            : `<em>${escapeHtml(block.emptyPresenceText || "啥也没有")}</em>`}
        </div>
      </section>
      ${renderNpcPanel(selectedNpc, snapshot)}
      ${renderItemPanel(selectedItem, snapshot)}
      <section class="wuxia-room-log" data-testid="room-log">
        ${logLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </section>
    </section>
  `;
}

function renderRoomExitButtons(room, roomById, labels = {}) {
  const connections = (room?.connections || []).filter((connection) => connection?.roomId);
  if (!connections.length) return renderNodeFact(labels.connections || "出口", [], labels.noConnections || "无");
  return `
    <div class="wuxia-room-exit-grid" aria-label="${escapeHtml(labels.connections || "出口")}">
      <span>${escapeHtml(labels.connections || "出口")}</span>
      <div>
        ${connections.map((connection) => {
          const target = roomById.get(connection.roomId);
          const label = connectionText(connection, roomById);
          return `
            <button type="button" class="wuxia-room-exit" data-wuxia-room-id="${escapeHtml(connection.roomId)}">
              <small>${escapeHtml(connection.direction || "")}</small>
              <strong>${escapeHtml(roomTitle(target) || connection.roomId)}</strong>
              <em>${escapeHtml(label)}</em>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderRoomDetail(room, roomById, presentation = {}) {
  if (!room || room.missing) {
    return `<div class="wuxia-room-detail">${escapeHtml(presentation.missingRoomText || "房间配置缺失")}</div>`;
  }
  const labels = presentation.roomLabels || {};
  const gateTexts = (room.gates || []).map((gate) => [gate.key, gate.value].filter(Boolean).join("="));
  const encounters = readablePairs(room.encounterIds, room.encounterNames);
  const interactables = readablePairs(room.interactableIds, room.interactableNames);
  const stageTags = [room.fightBackground, room.roomBgm ? `BGM ${room.roomBgm}` : ""].filter(Boolean);
  return `
    <div class="wuxia-room-detail" data-wuxia-room-detail="${escapeHtml(room.roomId || "")}">
      <strong>${escapeHtml(roomTitle(room))}</strong>
      <div class="wuxia-room-facts">
        ${renderRoomExitButtons(room, roomById, labels)}
        ${renderNodeFact(labels.encounters || "人物", encounters, labels.noEncounters || "无")}
        ${renderNodeFact(labels.interactables || "物件", interactables, labels.noInteractables || "无")}
        ${renderNodeFact(labels.gates || "门槛", gateTexts, labels.noGates || "无")}
        ${renderNodeFact(labels.stage || "场景", stageTags, labels.noStage || "未配置")}
        ${presentation.showEvidence ? renderNodeFact(labels.evidence || "证据", [evidenceText(room.evidence)].filter(Boolean)) : ""}
      </div>
    </div>
  `;
}

function renderRoomBrowser(rooms, flowContract, presentation = {}) {
  const roomList = (rooms || []).filter((room) => room && !room.missing);
  if (!roomList.length) return "";
  const roomById = new Map((activeChapterFromFlow(flowContract).rooms || []).map((room) => [room.roomId, room]));
  const firstRoom = roomList[0];
  return `
    <section class="wuxia-room-browser" aria-label="${escapeHtml(presentation.roomBrowserTitle || "房间链路")}">
      <header>${escapeHtml(presentation.roomBrowserTitle || "房间链路")}</header>
      <div class="wuxia-room-list">
        ${roomList.map((room, index) => `
          <button class="wuxia-room-button ${index === 0 ? "is-selected" : ""}" type="button" data-wuxia-room-id="${escapeHtml(room.roomId || "")}">
            <span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
            <strong>${escapeHtml(roomTitle(room))}</strong>
          </button>
        `).join("")}
      </div>
      ${renderRoomDetail(firstRoom, roomById, presentation)}
    </section>
  `;
}

function renderChapterNodeRoute(block, flowContract) {
  const chapter = activeChapterFromFlow(flowContract);
  const nodes = (chapter.nodes || []).filter(isPlayerVisibleChapterNode);
  const title = block.title || chapter.displayText?.zhCN || "";
  const summaryPrompt = block.summaryPrompt || "";
  return `
    <section class="wuxia-chapter-route" aria-label="${escapeHtml(title)}">
      <header>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(block.countFormat?.replace("{count}", nodes.length) || nodes.length)}</small>
      </header>
      <div class="wuxia-route-list">
        ${nodes.map((node) => `
          <button type="button" data-wuxia-node-id="${escapeHtml(node.nodeId)}" aria-pressed="false">
            <span>${escapeHtml(node.order || "")}</span>
            <strong>${escapeHtml(node.displayText?.zhCN || "")}</strong>
            <small>${escapeHtml(chapterNodeTypeLabel(node.nodeType, block))}</small>
          </button>
        `).join("")}
      </div>
      <div class="wuxia-node-summary" aria-live="polite">${escapeHtml(summaryPrompt)}</div>
    </section>
  `;
}

function taskProgressForRows(rows, flowContract, snapshot) {
  const actions = new Map((flowContract?.actions || []).map((action) => [action.actionId, action]));
  const nextLocked = (rows || []).find((row) => actions.get(row.actionId || "")?.requestPayload?.minimumPlayerValues?.experience != null);
  const target = Number(actions.get(nextLocked?.actionId || "")?.requestPayload?.minimumPlayerValues?.experience || 0);
  const current = Number(snapshot?.player?.experience || 0);
  return {
    current,
    target,
    percent: target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0,
  };
}

function formatPresentation(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? "");
}

function renderTaskRows(block, flowContract, snapshot) {
  const progress = taskProgressForRows(block.rows, flowContract, snapshot);
  const completedClicks = Number(snapshot?.taskState?.completedClicks || 0);
  const actions = new Map((flowContract?.actions || []).map((action) => [action.actionId, action]));
  return `<section class="wuxia-task-list" data-testid="idle-task-list">
    ${(block.rows || []).map((row) => {
      const isWork = actions.get(row.actionId || "")?.responseModel?.rewardMode === "click_work";
      const repeatText = formatPresentation(block.presentation?.repeatCountFormat, { count: completedClicks });
      const progressText = formatPresentation(block.presentation?.progressFormat, {
        current: progress.current,
        target: progress.target,
        count: completedClicks,
      });
      const progressAriaText = formatPresentation(block.presentation?.progressAriaFormat, {
        current: progress.current,
        target: progress.target,
        count: completedClicks,
      });
      const details = isWork
        ? `<small>${escapeHtml(row.reward || row.status || "")}</small><em>${escapeHtml(repeatText)}</em>
           <div class="wuxia-task-progress" aria-label="${escapeHtml(progressAriaText)}"><span style="width:${progress.percent}%"></span><strong>${escapeHtml(progress.target ? progressText : repeatText)}</strong></div>`
        : `<small>${escapeHtml(row.reward || row.status || "")}</small>`;
      return `<button class="wuxia-task-row ${row.state === "locked" ? "is-locked" : ""}" ${row.actionId ? `data-wuxia-action-id="${escapeHtml(row.actionId)}"` : ""} type="button"><span>${escapeHtml(row.name)}</span><div>${details}</div></button>`;
    }).join("")}
  </section>`;
}

function renderBlock(block, screen, player, flowContract, snapshot) {
  if (block.type === "story") {
    const lines = block.lines || [block.text || ""];
    return `<section class="wuxia-story-panel">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>`;
  }
  if (block.type === "storyDynamic") {
    const value = player[block.field] || block.fallback || "";
    const lines = Array.isArray(value) ? value : String(value).split("\n").filter(Boolean);
    return `<section class="wuxia-story-panel">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>`;
  }
  if (block.type === "choiceList") {
    return `<section class="wuxia-choice-list">${(block.choices || []).map((choice) => `<button type="button" data-wuxia-action-id="${escapeHtml(choice.actionId || "")}">${escapeHtml(choice.label)}</button>`).join("")}</section>`;
  }
  if (block.type === "titleStart") {
    return `<section class="wuxia-title-panel"><h2>${escapeHtml(block.title || "")}</h2><p>${escapeHtml(block.subtitle || "")}</p></section>`;
  }
  if (block.type === "characterStatus") {
    const stats = (player.stats || [])
      .map((item) => `<div class="wuxia-stat-row"><span>『${escapeHtml(item.label)}』</span><strong>${escapeHtml(playerStatValue(item, player))}</strong></div>`)
      .join("");
    return `
      <section class="wuxia-status-page">
        <div class="wuxia-status-main">
          <div class="wuxia-identity">【${escapeHtml(player.identity)}】<strong>${escapeHtml(player.name)}</strong></div>
          <div class="wuxia-stat-list">${stats}</div>
        </div>
        <div class="wuxia-portrait-box">
          <div class="wuxia-avatar">${escapeHtml(player.portraitLabel)}</div>
          <button type="button">${escapeHtml(block.attributeButtonText || "")}</button>
        </div>
      </section>
    `;
  }
  if (block.type === "taskBanner") {
    const actionId = block.actionId || screen.primaryActionId || snapshot?.availableActions?.[0]?.actionId || "";
    return `<button class="wuxia-task-strip" ${actionId ? `data-wuxia-action-id="${escapeHtml(actionId)}"` : ""} type="button"><span>${escapeHtml(block.left)}</span><strong>${escapeHtml(block.right)}</strong></button><p class="wuxia-bottom-log">${escapeHtml(player.bottomHint)}</p>`;
  }
  if (block.type === "idleConfirm") {
    const rows = (block.rows || []).map(([key, value]) => `<div><span>${escapeHtml(key)}：</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    return `<section class="wuxia-modal-card">${rows}</section>`;
  }
  if (block.type === "taskRows") {
    return renderTaskRows(block, flowContract, snapshot);
  }
  if (block.type === "resourceGrid") {
    return `<section class="wuxia-resource-grid">${(block.rows || []).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</section>`;
  }
  if (block.type === "entryButtons") {
    return `<section class="wuxia-entry-grid">${(block.buttons || []).map((entry) => {
      const button = typeof entry === "string" ? { label: entry } : entry;
      return `<button type="button" ${button.actionId ? `data-wuxia-action-id="${escapeHtml(button.actionId)}"` : ""}>${escapeHtml(button.label)}</button>`;
    }).join("")}</section>`;
  }
  if (block.type === "chapterCards") {
    return `<section class="wuxia-chapter-cards">${(block.cards || []).map((card) => `<button type="button" ${card.actionId ? `data-wuxia-action-id="${escapeHtml(card.actionId)}"` : ""}><strong>${escapeHtml(card.title)}</strong><small>${escapeHtml(card.subtitle)}</small></button>`).join("")}</section>`;
  }
  if (block.type === "roomExplore") return renderRoomExplore(block, flowContract, snapshot);
  if (block.type === "chapterNodeRoute") return renderChapterNodeRoute(block, flowContract);
  if (block.type === "mapText") return `<p class="wuxia-map-copy">${escapeHtml(block.text)}</p>`;
  if (block.type === "exits") {
    const nodes = activeChapterFromFlow(flowContract).nodes || [];
    return `<section class="wuxia-exits">${(block.items || []).map((item, index) => `<button type="button" data-wuxia-node-id="${escapeHtml(nodes[index]?.nodeId || "")}">${escapeHtml(item)}</button>`).join("")}</section>`;
  }
  if (block.type === "presence") {
    return `<section class="wuxia-presence"><span>${escapeHtml(block.label)}</span>${(block.items || []).map((item) => `<button type="button">${escapeHtml(item)}</button>`).join("")}</section>`;
  }
  if (block.type === "log") {
    return `<section class="wuxia-log">${(block.lines || []).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>`;
  }
  if (block.type === "combatRuntime") return renderCombatRuntime(block, flowContract, snapshot);
  if (block.type === "combatStage") {
    return `<section class="wuxia-combat-stage">${renderCombatant(block.left, "left")}${renderCombatant(block.right, "right")}<div class="wuxia-fighter left">${escapeHtml(block.left?.fighterLabel || "")}</div><div class="wuxia-fighter right">${escapeHtml(block.right?.fighterLabel || "")}</div></section>`;
  }
  if (block.type === "combatLog") {
    return `<section class="wuxia-combat-log">${(block.lines || []).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>`;
  }
  return "";
}

function renderScreenBody(screen, screenContract, flowContract, snapshot) {
  const player = { ...(screenContract.player || {}), ...(snapshot?.player || {}) };
  const body = (screen.body || []).map((block) => renderBlock(block, screen, player, flowContract, snapshot)).join("");
  const available = snapshot?.availableActions || [];
  const primaryActionId = screen.primaryActionId || available[0]?.actionId || "";
  const secondaryActionId = screen.secondaryActionId || available[1]?.actionId || "";
  const runtimeEvents = snapshot?.events || [];
  const lastEvent = runtimeEvents[runtimeEvents.length - 1];
  const feedback = lastEvent?.feedback || "";
  const feedbackInScreenLog = (screen.body || []).some((block) => block.type === "roomExplore");
  const primary = screen.primaryText
    ? `<button class="wuxia-primary-button" ${primaryActionId ? `data-wuxia-action-id="${escapeHtml(primaryActionId)}"` : ""} type="button">${escapeHtml(screen.primaryText)}</button>`
    : "";
  const secondary = screen.secondaryText
    ? `<button class="wuxia-secondary-button" ${secondaryActionId ? `data-wuxia-action-id="${escapeHtml(secondaryActionId)}"` : ""} type="button">${escapeHtml(screen.secondaryText)}</button>`
    : "";
  return `
    <div class="wuxia-screen wuxia-screen-${escapeHtml(screen.mode || "default")}">
      ${body}
      ${feedback && !feedbackInScreenLog ? `<div class="wuxia-runtime-feedback" aria-live="polite">${escapeHtml(feedback)}</div>` : ""}
      ${(primary || secondary) ? `<div class="wuxia-bottom-actions">${primary}${secondary}</div>` : ""}
    </div>
  `;
}

function renderPendingChoice(choice) {
  if (!choice) return "";
  return `
    <div class="wuxia-choice-backdrop" data-wuxia-choice-id="${escapeHtml(choice.choiceId)}">
      <section class="wuxia-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="wuxiaChoiceTitle">
        <p id="wuxiaChoiceTitle">${escapeHtml(choice.title)}</p>
        <div class="wuxia-choice-options">
          ${(choice.options || []).map((option) => `
            <button type="button" data-wuxia-choice-option="${escapeHtml(option.optionId)}">
              ${escapeHtml(option.label)}
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function bindPendingChoiceDialog(stage, choice) {
  if (!choice) return;
  const screen = stage.querySelector(".wuxia-screen");
  if (screen) {
    screen.inert = true;
    screen.setAttribute("aria-hidden", "true");
  }
  const dialog = stage.querySelector(".wuxia-choice-dialog");
  const buttons = [...(dialog?.querySelectorAll("[data-wuxia-choice-option]") || [])];
  if (!dialog || !buttons.length) return;
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const currentIndex = buttons.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1)
      : (currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    buttons[nextIndex].focus();
  });
  window.requestAnimationFrame(() => buttons[0]?.focus());
}

function renderMapSelection(event) {
  if (!event || event.type !== "nodeSelected") return;
  document.body.dataset.wuxiaSelectedNode = event.nodeId || "";
  document.querySelectorAll(".wuxia-route-list [data-wuxia-node-id]").forEach((button) => {
    const selected = button.dataset.wuxiaNodeId === event.nodeId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const snapshot = state.runtime.snapshot();
  const screen = state.config?.wuxiaScreenContract?.screens?.[snapshot.state?.screenId];
  const presentation = screen?.body?.find((block) => block.type === "chapterNodeRoute")?.selectionPresentation || {};
  const name = event.displayText?.zhCN || "";
  const values = {
    gates: (event.gates || []).filter((gate) => gate && !gate.missing).length,
    encounters: event.encounters?.length || 0,
    rewards: event.rewards?.length || 0,
  };
  const summaryText = (presentation.summaryFormat || "")
    .replace("{gates}", values.gates)
    .replace("{encounters}", values.encounters)
    .replace("{rewards}", values.rewards);
  const action = event.primaryAction || null;
  const actionId = action?.actionId || "";
  const actionLabel = action?.label?.zhCN || action?.label || "";
  const summary = document.querySelector(".wuxia-node-summary");
  if (summary) {
    summary.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(summaryText)}</span>
      ${renderNodeDetail(event, presentation)}
      ${renderRoomBrowser(event.rooms || [], state.config?.wuxiaFirstSessionFlow || {}, presentation)}
      ${actionId ? `<button class="wuxia-node-action" type="button" data-wuxia-action-id="${escapeHtml(actionId)}">${escapeHtml(actionLabel)}</button>` : ""}
    `;
  }
  bindRoomNavigation(summary, presentation);
  const actionButton = summary?.querySelector(".wuxia-node-action");
  actionButton?.addEventListener("click", () => {
    state.runtime.dispatch(actionButton.dataset.wuxiaActionId);
    render();
  });
  const log = document.querySelector(".wuxia-log");
  if (log && presentation.logLines?.length) {
    log.innerHTML = presentation.logLines
      .map((line) => `<p>${escapeHtml(line.replace("{name}", name))}</p>`)
      .join("");
  }
}

function syncSelectedRoomUi(roomId, presentation = {}) {
  const snapshot = state.runtime.snapshot();
  const block = mapExploreBlockForSnapshot(snapshot);
  const explore = document.querySelector(".wuxia-room-explore");
  if (explore && block) {
    explore.outerHTML = renderRoomExplore(block, state.config?.wuxiaFirstSessionFlow || {}, snapshot);
    bindRoomNavigation(document.querySelector(".wuxia-stage"), block);
    bindNpcNavigation(document.querySelector(".wuxia-stage"));
    return;
  }
  const summary = document.querySelector(".wuxia-node-summary");
  if (!summary) return;
  const roomById = roomByIdForFlow();
  const room = roomById.get(roomId);
  summary.querySelectorAll(".wuxia-room-button").forEach((item) => {
    item.classList.toggle("is-selected", item.dataset.wuxiaRoomId === roomId);
  });
  const detail = summary.querySelector(".wuxia-room-detail");
  if (detail) detail.outerHTML = renderRoomDetail(room, roomById, presentation);
  bindRoomNavigation(summary, presentation);
}

function selectRoomFromUi(roomId, presentation = {}) {
  if (!roomId) return;
  const result = state.runtime.selectChapterRoom(roomId);
  if (!result.accepted) {
    render();
    return;
  }
  if (document.querySelector(".wuxia-room-explore")) {
    render();
    return;
  }
  const beforeNodeId = document.body.dataset.wuxiaSelectedNode || "";
  const nextNodeId = result.event.parentNodeId || beforeNodeId;
  if (nextNodeId && nextNodeId !== beforeNodeId) {
    const nodeResult = state.runtime.selectChapterNode(nextNodeId);
    if (nodeResult.accepted) {
      renderMapSelection(nodeResult.event);
      state.runtime.selectChapterRoom(roomId);
      syncSelectedRoomUi(roomId, presentation);
    }
    return;
  }
  syncSelectedRoomUi(result.event.roomId, presentation);
}

function bindRoomNavigation(summary, presentation = {}) {
  summary?.querySelectorAll(".wuxia-room-button, .wuxia-room-exit, .wuxia-room-direction").forEach((button) => {
    button.onclick = () => selectRoomFromUi(button.dataset.wuxiaRoomId, presentation);
  });
}

function selectNpcFromUi(roleId) {
  if (!roleId) return;
  const result = state.runtime.selectChapterNpc(roleId);
  if (!result.accepted) return;
  render();
}

function interactNpcFromUi(roleId, actionType) {
  if (!roleId || !actionType) return;
  state.runtime.interactWithChapterNpc(roleId, actionType);
  render();
}

function selectItemFromUi(interactableId) {
  if (!interactableId) return;
  const result = state.runtime.selectChapterInteractable(interactableId);
  if (!result.accepted) return;
  render();
}

function interactItemFromUi(interactableId, actionType) {
  if (!interactableId || !actionType) return;
  state.runtime.interactWithChapterInteractable(interactableId, actionType);
  render();
}

function bindNpcNavigation(scope) {
  scope?.querySelectorAll(".wuxia-npc-button").forEach((button) => {
    button.onclick = () => selectNpcFromUi(button.dataset.wuxiaNpcId);
  });
  scope?.querySelectorAll(".wuxia-npc-action").forEach((button) => {
    button.onclick = () => interactNpcFromUi(button.dataset.wuxiaNpcId, button.dataset.wuxiaNpcAction);
  });
  scope?.querySelectorAll(".wuxia-item-button").forEach((button) => {
    button.onclick = () => selectItemFromUi(button.dataset.wuxiaInteractableId);
  });
  scope?.querySelectorAll(".wuxia-item-action").forEach((button) => {
    button.onclick = () => interactItemFromUi(button.dataset.wuxiaInteractableId, button.dataset.wuxiaInteractableAction);
  });
}

function bindNavButton(button, label, actionId) {
  if (!button) return;
  button.textContent = label || "";
  button.hidden = !label;
  button.disabled = !actionId;
  button.dataset.wuxiaActionId = actionId || "";
  button.onclick = actionId
    ? () => {
        state.runtime.dispatch(actionId);
        render();
      }
    : null;
}

function applyMobileLayout(layout = {}) {
  const root = document.documentElement;
  if (layout.contentMaxWidthPx) root.style.setProperty("--wuxia-content-max-width", `${layout.contentMaxWidthPx}px`);
  for (const [key, value] of Object.entries(layout.safeArea || {})) {
    if (value) root.style.setProperty(`--wuxia-safe-${key}`, value);
  }
  document.body.dataset.wuxiaOrientation = layout.orientation || "portrait";
  document.body.dataset.wuxiaSafeArea = String(Boolean(layout.safeArea?.enabled));
}

function installPersistenceLifecycle(contract = {}) {
  if (state.persistenceLifecycleInstalled) return;
  state.persistenceLifecycleInstalled = true;
  for (const eventName of contract.autosave?.lifecycleEvents || []) {
    window.addEventListener(eventName, () => {
      if (eventName === "visibilitychange" && document.visibilityState !== "hidden") return;
      state.persistence?.flush();
    });
  }
}

function syncCombatPlayback(snapshot, screen, flowContract) {
  const block = (screen.body || []).find((entry) => entry.type === "combatRuntime");
  if (!block) {
    if (state.combatPlayback.timer) clearTimeout(state.combatPlayback.timer);
    state.combatPlayback.timer = null;
    return;
  }
  const preview = combatPreviewForSnapshot(block, flowContract, snapshot);
  const duration = Math.max(0, ...(preview?.events || []).map(combatEventTimeMs));
  const elapsed = currentCombatElapsedMs(snapshot, preview);
  if (elapsed >= duration) {
    const resolutionActionId = block.resolveActionId || snapshot?.pendingCombat?.resolveActionId || "";
    // Player combat is continuous. Resolution is a config-selected transition
    // after its timeline finishes; developer stepping belongs in tooling only.
    if (block.autoResolve === true && resolutionActionId && state.combatPlayback.resolvedKey !== state.combatPlayback.key) {
      state.combatPlayback.resolvedKey = state.combatPlayback.key;
      const result = state.runtime.dispatch(resolutionActionId);
      if (!result.accepted) console.error("Configured combat auto-resolution failed", result.event);
      render();
    }
    return;
  }
  if (state.combatPlayback.timer) return;
  state.combatPlayback.timer = setTimeout(() => {
    state.combatPlayback.timer = null;
    render();
  }, 110);
}

function installAutomationApi() {
  window.__idleWuxiaAutomation = {
    dispatchAction(actionId) {
      const result = state.runtime?.dispatch(actionId);
      render();
      return {
        clicked: Boolean(result?.accepted),
        reason: result?.event?.reason || "",
        actionId,
        text: result?.event?.feedback || actionId,
        automation: true,
      };
    },
    selectNode(nodeId) {
      const result = state.runtime?.selectChapterNode(nodeId);
      render();
      return {
        clicked: Boolean(result?.accepted),
        reason: result?.event?.reason || "",
        nodeId,
        text: result?.event?.displayText?.zhCN || result?.event?.displayText?.rawCompetitorText || nodeId,
        automation: true,
      };
    },
    selectRoom(roomId) {
      const result = state.runtime?.selectChapterRoom(roomId);
      render();
      return {
        clicked: Boolean(result?.accepted),
        reason: result?.event?.reason || "",
        roomId,
        text: result?.event?.name || roomId,
        automation: true,
      };
    },
    selectNpc(roleId) {
      const result = state.runtime?.selectChapterNpc(roleId);
      render();
      return {
        clicked: Boolean(result?.accepted),
        reason: result?.event?.reason || "",
        roleId,
        text: result?.event?.name || roleId,
        automation: true,
      };
    },
    interactNpc(roleId, actionType) {
      const result = state.runtime?.interactWithChapterNpc(roleId, actionType);
      render();
      return {
        clicked: Boolean(result?.accepted),
        reason: result?.event?.reason || "",
        roleId,
        actionType,
        text: result?.event?.feedback || actionType,
        automation: true,
      };
    },
    resolveChoice(optionId) {
      const result = state.runtime?.resolvePendingChoice(optionId);
      render();
      return {
        clicked: Boolean(result?.accepted),
        reason: result?.event?.reason || "",
        optionId,
        text: result?.event?.feedback || result?.event?.optionLabel || optionId,
        automation: true,
      };
    },
    snapshot() {
      return state.runtime?.snapshot();
    },
    persistenceStatus() {
      return state.persistence?.status() || { status: "unavailable" };
    },
    clearSave() {
      return state.persistence?.clear() || { status: "unavailable" };
    },
  };
}

function render() {
  const runtime = state.runtime;
  const flowContract = state.config?.wuxiaFirstSessionFlow;
  const screenContract = state.config?.wuxiaScreenContract;
  if (!runtime || !flowContract || !screenContract) return;

  const snapshot = runtime.snapshot();
  const screenId = snapshot.state?.screenId || screenContract.defaultStartScreen;
  const screen = screenContract.screens?.[screenId];
  if (!screen) throw new Error(`Missing screen contract: ${screenId}`);

  const title = document.querySelector("#wuxiaScreenTitle");
  const step = document.querySelector("#wuxiaFlowStep");
  const stage = document.querySelector(".wuxia-stage");
  if (!stage) return;
  const dynamicRoomTitle = screen.body?.some((block) => block.type === "roomExplore")
    ? roomTitle(activeChapterFromSnapshot(snapshot)?.selectedRoom) || ""
    : "";
  if (title) title.textContent = dynamicRoomTitle || screen.nav?.center || screen.title || "";
  if (step) step.textContent = dynamicRoomTitle || screen.title || "";
  bindNavButton(document.querySelector("[data-wuxia-action='back']"), screen.nav?.left || "", screen.navActions?.left || "");
  bindNavButton(document.querySelector("[data-wuxia-action='home']"), screen.nav?.right || "", screen.navActions?.right || "");

  document.body.dataset.runtime = "wuxia";
  document.body.dataset.wuxiaState = snapshot.currentState || "";
  document.body.dataset.wuxiaScreen = screenId;
  document.body.dataset.wuxiaMode = screen.mode || "status";
  stage.dataset.screenMode = screen.mode || "status";
  stage.innerHTML = `${renderScreenBody(screen, screenContract, flowContract, snapshot)}${renderPendingChoice(snapshot.pendingChoice)}`;
  syncCombatPlayback(snapshot, screen, flowContract);

  stage.querySelectorAll("[data-wuxia-action-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const actionId = button.dataset.wuxiaActionId;
      if (!actionId) return;
      state.runtime.dispatch(actionId);
      render();
    });
  });
  stage.querySelectorAll("[data-wuxia-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = state.runtime.selectChapterNode(button.dataset.wuxiaNodeId);
      renderMapSelection(result.event);
    });
  });
  bindRoomNavigation(stage, mapExploreBlockForSnapshot(snapshot) || {});
  bindNpcNavigation(stage);
  stage.querySelectorAll("[data-wuxia-choice-option]").forEach((button) => {
    button.addEventListener("click", () => {
      state.runtime.resolvePendingChoice(button.dataset.wuxiaChoiceOption);
      render();
    });
  });
  bindPendingChoiceDialog(stage, snapshot.pendingChoice);
}

async function init() {
  try {
    document.body.classList.add("wuxia-mode");
    state.config = await loadConfig();
    applyMobileLayout(state.config.wuxiaScreenContract?.mobileLayout || {});
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const persistenceController = createRuntimePersistence({
      storage,
      contract: state.config.wuxiaRuntimePersistence,
    });
    const restored = persistenceController.restore(state.config.wuxiaFirstSessionFlow?.schema || "");
    const attached = persistenceController.attach(createFirstSessionRuntime(state.config.wuxiaFirstSessionFlow, {
      initialState: state.config.wuxiaScreenContract?.defaultStartState,
      initialFlags: state.config.wuxiaScreenContract?.defaultStartFlags,
      initialSaveState: restored.state,
    }));
    state.persistence = attached;
    state.runtime = attached.runtime;
    installPersistenceLifecycle(state.config.wuxiaRuntimePersistence);
    installAutomationApi();
    console.info("Wuxia first-session contract", summarizeFirstSessionContract(state.config.wuxiaFirstSessionFlow));
    render();
  } catch (error) {
    console.error(error);
    renderConfigError(error);
  }
}

if (typeof document !== "undefined") init();

