import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);
function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const scenario = argValue("--scenario", process.env.WUXIA_FLOW_SCENARIO || "baseline");
const outDir = path.resolve(root, argValue("--out-dir", process.env.WUXIA_FLOW_OUT_DIR || path.join("outputs", "skill_waterfall_acceptance_20260707")));
const crawlRoomId = argValue("--room-id", "");
const crawlEntityId = argValue("--entity-id", "");
const crawlEntityKind = argValue("--entity-kind", "npc");
const crawlActionTypes = argValue("--interaction-actions", "").split(",").map((value) => value.trim()).filter(Boolean);
const crawlExpectedState = argValue("--expected-state", "STATE_FS_008_MAP_EXPLORE");
const crawlRouteRoomIds = argValue("--route-room-ids", "").split(",").map((value) => value.trim()).filter(Boolean);
const crawlExpectedVisibleNpcId = argValue("--expected-visible-npc-id", "");
const routeUnlockPlanPath = argValue("--route-unlock-plan", "");
const routeGateEvidence = argValue("--route-gate-evidence", "");
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = process.env.WUXIA_URL || `http://127.0.0.1:5187/?real-browser-flow=20260707&scenario=${encodeURIComponent(scenario)}`;
const port = Number(process.env.EDGE_DEBUG_PORT || 9227);
const viewportWidth = Number(argValue("--viewport-width", process.env.WUXIA_VIEWPORT_WIDTH || "540"));
const viewportHeight = Number(argValue("--viewport-height", process.env.WUXIA_VIEWPORT_HEIGHT || "960"));

if (!Number.isInteger(viewportWidth) || viewportWidth <= 0 || !Number.isInteger(viewportHeight) || viewportHeight <= 0) {
  throw new Error("Viewport width and height must be positive integers.");
}

fs.mkdirSync(outDir, { recursive: true });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(targetUrl) {
  const response = await fetch(targetUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${targetUrl}`);
  return response.json();
}

async function waitForTarget() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      await delay(250);
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for Edge DevTools target.");
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];

  ws.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(JSON.stringify(payload.error)));
      else resolve(payload.result);
      return;
    }
    if (payload.method) events.push(payload);
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        events,
        close: () => ws.close(),
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveSend, rejectSend) => {
            pending.set(id, { resolve: resolveSend, reject: rejectSend });
            setTimeout(() => {
              if (pending.has(id)) {
                pending.delete(id);
                rejectSend(new Error(`CDP timeout: ${method}`));
              }
            }, 10000);
          });
        },
      });
    });
    ws.addEventListener("error", reject);
  });
}

async function evalValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function waitForWuxia(cdp) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const state = await evalValue(cdp, "document.body?.dataset?.wuxiaState || ''");
    if (state) return state;
    await delay(250);
  }
  throw new Error("Wuxia runtime did not render a state.");
}

async function capture(cdp, label) {
  const summary = await evalValue(cdp, `(() => {
    const text = document.body.innerText || "";
    const badMatches = text.match(/Welcome Back|GALAXY|TURRET|Nova Lite|escapeHtml|锟|undefined|null|\\?\\?/g) || [];
    return {
      label: ${JSON.stringify(label)},
      state: document.body.dataset.wuxiaState || "",
      screen: document.body.dataset.wuxiaScreen || "",
      title: document.querySelector("#wuxiaScreenTitle")?.textContent || "",
      step: document.querySelector("#wuxiaFlowStep")?.textContent || "",
      roomId: document.querySelector('[data-testid="room-explore"]')?.dataset?.wuxiaRoomId || "",
      buttonTexts: [...document.querySelectorAll("button")].map((button) => button.textContent.trim()).filter(Boolean).slice(0, 30),
      logTexts: [...document.querySelectorAll(".wuxia-bottom-log, .wuxia-runtime-feedback, .wuxia-room-log p, .wuxia-npc-dialogue p")].map((node) => node.textContent.trim()).filter(Boolean).slice(-10),
      textSample: text.replace(/\\s+/g, " ").trim().slice(0, 500),
      badMatches
    };
  })()`);
  const png = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const screenshotPath = path.join(outDir, `${String(results.length + 1).padStart(2, "0")}_${label}.png`);
  fs.writeFileSync(screenshotPath, Buffer.from(png.data, "base64"));
  summary.screenshot = path.relative(root, screenshotPath).replaceAll("\\", "/");
  results.push(summary);
  return summary;
}

async function clickAction(cdp, actionId) {
  return evalValue(cdp, `(() => {
    const button = document.querySelector('[data-wuxia-action-id="${actionId}"]');
    if (!button) return { clicked: false, reason: "missing visible action", actionId: "${actionId}" };
    button.click();
    return { clicked: true, actionId: "${actionId}", text: button.textContent.trim() };
  })()`);
}

async function clickSelector(cdp, selector) {
  return evalValue(cdp, `(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) return { clicked: false, reason: "missing selector", selector: ${JSON.stringify(selector)} };
    button.click();
    return { clicked: true, selector: ${JSON.stringify(selector)}, text: button.textContent.trim() };
  })()`);
}

async function clickAndCapture(cdp, label, clicker, expectedState = "", expectedRoomId = "") {
  const click = await clicker();
  await delay(400);
  const summary = await capture(cdp, label);
  summary.click = click;
  if (!click.clicked) summary.error = click.reason || "click failed";
  if (expectedState && summary.state !== expectedState) summary.error = `expected ${expectedState}, got ${summary.state}`;
  if (expectedRoomId && summary.roomId !== expectedRoomId) summary.error = `expected room ${expectedRoomId}, got ${summary.roomId || "none"}`;
  return summary;
}

async function waitForStateAndCapture(cdp, label, expectedState, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const actualState = await evalValue(cdp, "document.body.dataset.wuxiaState || ''");
    if (actualState === expectedState) {
      const summary = await capture(cdp, label);
      summary.waitedForState = expectedState;
      return summary;
    }
    await delay(100);
  }
  const summary = await capture(cdp, label);
  summary.error = `timed out waiting for ${expectedState}; got ${summary.state || "none"}`;
  return summary;
}

async function waitForCombatAutoResolveAndCapture(cdp, label, expectedState) {
  const manualControl = await evalValue(cdp, `(() => [...document.querySelectorAll('button')]
    .map((button) => button.textContent.trim())
    .find((text) => /^(继续|确认|结算)$/.test(text)) || "")()`);
  if (manualControl) {
    const summary = await capture(cdp, `${label}_manual_control_found`);
    summary.error = `player combat exposed forbidden manual control: ${manualControl}`;
    return summary;
  }
  return waitForStateAndCapture(cdp, label, expectedState, 5000);
}

async function clickRoomAndCapture(cdp, roomId, label) {
  return clickAndCapture(cdp, label, () => clickSelector(cdp, `[data-wuxia-room-id="${roomId}"]`), "STATE_FS_008_MAP_EXPLORE");
}

async function clickNpcAndCapture(cdp, roleId, label) {
  return clickAndCapture(cdp, label, () => clickSelector(cdp, `[data-wuxia-npc-id="${roleId}"]`), "STATE_FS_008_MAP_EXPLORE");
}

async function clickNpcActionAndCapture(cdp, roleId, actionType, label) {
  return clickAndCapture(cdp, label, () => clickSelector(cdp, `[data-wuxia-npc-id="${roleId}"][data-wuxia-npc-action="${actionType}"]`), "STATE_FS_008_MAP_EXPLORE");
}

async function clickNpcCombatAndWait(cdp, roleId, label) {
  const started = await clickAndCapture(
    cdp,
    label,
    () => clickSelector(cdp, `[data-wuxia-npc-id="${roleId}"][data-wuxia-npc-action="compete"]`),
    "STATE_FS_009_EARLY_COMBAT",
  );
  if (!started.error) await waitForCombatAutoResolveAndCapture(cdp, `${label}_auto_resolved`, "STATE_FS_008_MAP_EXPLORE");
  return started;
}

async function clickItemAndCapture(cdp, interactableId, label) {
  return clickAndCapture(cdp, label, () => clickSelector(cdp, `[data-wuxia-interactable-id="${interactableId}"]`), "STATE_FS_008_MAP_EXPLORE");
}

async function clickItemActionAndCapture(cdp, interactableId, actionType, label) {
  return clickAndCapture(cdp, label, () => clickSelector(cdp, `[data-wuxia-interactable-id="${interactableId}"][data-wuxia-interactable-action="${actionType}"]`), "STATE_FS_008_MAP_EXPLORE");
}

async function assertVisibleNpcAndCapture(cdp, roleId, label) {
  const summary = await capture(cdp, label);
  const visible = await evalValue(cdp, `Boolean(document.querySelector('button[data-wuxia-npc-id="${roleId}"]'))`);
  summary.expectedVisibleNpcId = roleId;
  summary.visible = visible === true;
  if (!summary.visible) summary.error = `expected visible npc ${roleId}, but no matching DOM button was rendered`;
  return summary;
}

async function captureInteractionContract(cdp, label, expression, failureMessage) {
  const summary = await capture(cdp, label);
  const details = await evalValue(cdp, expression);
  summary.interactionContract = details;
  if (details?.passed !== true) summary.error = failureMessage;
  return summary;
}

const profileDir = path.join(outDir, "edge_cdp_profile");
fs.mkdirSync(profileDir, { recursive: true });

const edge = spawn(edgePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--window-size=${viewportWidth},${viewportHeight}`,
  `--user-data-dir=${profileDir}`,
  url,
], { stdio: ["ignore", "pipe", "pipe"] });

const stderr = [];
edge.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

const results = [];
let runError = null;
let cdp = null;

try {
  const target = await waitForTarget();
  cdp = await createCdpClient(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send("Page.navigate", { url });

  await waitForWuxia(cdp);
  await capture(cdp, "opening_story");
  await clickAndCapture(cdp, "origin_result", () => clickAction(cdp, "ACTION_FS_001_ORIGIN_SCHOLAR"), "STATE_FS_001_ORIGIN_RESULT");
  await clickAndCapture(cdp, "title_start", () => clickAction(cdp, "ACTION_FS_001_ORIGIN_RESULT_CONTINUE"), "STATE_FS_002_TITLE_START");
  await clickAndCapture(cdp, "character_status", () => clickAction(cdp, "ACTION_FS_002_TITLE_START"), "STATE_FS_003_CHARACTER_STATUS");
  await clickAndCapture(cdp, "idle_confirm", () => clickAction(cdp, "ACTION_FS_003_CHARACTER_STATUS"), "STATE_FS_004_IDLE_CONFIRM");
  await clickAndCapture(cdp, "idle_task_list", () => clickAction(cdp, "ACTION_FS_004_IDLE_CONFIRM"), "STATE_FS_005_IDLE_TASK_LIST");
  await clickAndCapture(cdp, "pool_fishing_claim", () => clickAction(cdp, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH"), "STATE_FS_005_IDLE_TASK_LIST");
  if (scenario === "interaction-contract") {
    await clickAndCapture(cdp, "pool_fishing_repeat_claim", () => clickAction(cdp, "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH"), "STATE_FS_005_IDLE_TASK_LIST");
    await captureInteractionContract(cdp, "idle_repeat_progress_contract", `(() => {
      const snapshot = window.__idleWuxiaAutomation?.snapshot?.() || {};
      const progress = document.querySelector('.wuxia-task-progress strong')?.textContent?.trim() || '';
      const repeatText = document.querySelector('.wuxia-task-row em')?.textContent?.trim() || '';
      const completedClicks = Number(snapshot.taskState?.completedClicks || 0);
      const experience = Number(snapshot.player?.experience || 0);
      return { passed: completedClicks === 2 && experience === 401 && /2/.test(repeatText) && /401/.test(progress), completedClicks, experience, repeatText, progress };
    })()`, "repeatable idle task did not accumulate count, experience, and visible progress");
  }
  await clickAndCapture(cdp, "chapter_entry", () => clickAction(cdp, "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE"), "STATE_FS_007_CHAPTER_CARD_ENTRY");
  await clickAndCapture(cdp, "map_explore", () => clickAction(cdp, "ACTION_FS_007_CHAPTER_CARD_ENTRY"), "STATE_FS_008_MAP_EXPLORE");

  if (scenario === "interaction-contract") {
    await captureInteractionContract(cdp, "map_direction_layout_contract", `(() => {
      const buttons = [...document.querySelectorAll('.wuxia-room-direction')].map((node) => ({ id: node.dataset.wuxiaRoomId || '', rect: node.getBoundingClientRect() }));
      const overlaps = [];
      for (let i = 0; i < buttons.length; i += 1) for (let j = i + 1; j < buttons.length; j += 1) {
        const a = buttons[i].rect, b = buttons[j].rect;
        const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (overlap > 4) overlaps.push([buttons[i].id, buttons[j].id, overlap]);
      }
      return { passed: buttons.length > 0 && overlaps.length === 0, buttonCount: buttons.length, overlaps };
    })()`, "map direction controls overlap in the rendered viewport");
    await clickAndCapture(cdp, "contract_gate_room", () => clickSelector(cdp, '[data-wuxia-room-id="fb01_01"]'), "STATE_FS_008_MAP_EXPLORE");
    await captureInteractionContract(cdp, "gate_direction_stack_contract", `(() => {
      const buttons = [...document.querySelectorAll('.wuxia-room-direction')].map((node) => ({ id: node.dataset.wuxiaRoomId || '', rect: node.getBoundingClientRect() }));
      const overlaps = [];
      for (let i = 0; i < buttons.length; i += 1) for (let j = i + 1; j < buttons.length; j += 1) {
        const a = buttons[i].rect, b = buttons[j].rect;
        const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (overlap > 4) overlaps.push([buttons[i].id, buttons[j].id, overlap]);
      }
      return { passed: buttons.length >= 2 && overlaps.length === 0, buttonCount: buttons.length, overlaps };
    })()`, "same-direction gate exits overlap in the rendered viewport");
    await clickAndCapture(cdp, "contract_steward_selected", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "contract_steward_intro", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1"][data-wuxia-npc-action="talk"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "contract_fightable_selected", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1a"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "contract_combat_enter", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1a"][data-wuxia-npc-action="compete"]'), "STATE_FS_009_EARLY_COMBAT");
    const earlyCombat = await evalValue(cdp, `(() => ({
      playing: document.querySelector('[data-testid="combat-runtime"]')?.dataset.wuxiaCombatPlaying || '',
      leftHp: document.querySelector('[data-wuxia-combat-side="left"] .wuxia-combat-bar.hp strong')?.textContent || '',
      rightHp: document.querySelector('[data-wuxia-combat-side="right"] .wuxia-combat-bar.hp strong')?.textContent || '',
      eventCount: document.querySelectorAll('.wuxia-combat-runtime-log p').length,
    }))()`);
    await delay(650);
    await captureInteractionContract(cdp, "combat_timeline_contract", `(() => {
      const now = {
        playing: document.querySelector('[data-testid="combat-runtime"]')?.dataset.wuxiaCombatPlaying || '',
        leftHp: document.querySelector('[data-wuxia-combat-side="left"] .wuxia-combat-bar.hp strong')?.textContent || '',
        rightHp: document.querySelector('[data-wuxia-combat-side="right"] .wuxia-combat-bar.hp strong')?.textContent || '',
        eventCount: document.querySelectorAll('.wuxia-combat-runtime-log p').length,
      };
      const earlier = ${JSON.stringify(earlyCombat)};
      const snapshot = window.__idleWuxiaAutomation?.snapshot?.() || {};
      const resolved = [...(snapshot.events || [])].reverse().find((event) => event.type === 'combatResolved') || null;
      const currentState = document.body.dataset.wuxiaState || '';
      const stillAnimating = now.eventCount > earlier.eventCount && now.playing === 'true';
      const resolvedToMap = currentState === 'STATE_FS_008_MAP_EXPLORE' && resolved?.accepted === true && resolved?.outcomeToken === 'comparewin';
      return { passed: stillAnimating || resolvedToMap, earlier, now, currentState, resolved, stillAnimating, resolvedToMap };
    })()`, "combat must either still advance its timeline or have a configured comparewin result that returned to map");
    await waitForCombatAutoResolveAndCapture(cdp, "combat_auto_resolved_to_map", "STATE_FS_008_MAP_EXPLORE");
  }

  if (scenario === "all-key-screens") {
    await clickAndCapture(cdp, "gate_room_for_combat", () => clickSelector(cdp, '[data-wuxia-room-id="fb01_01"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "old_steward_selected", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "old_steward_intro", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1"][data-wuxia-npc-action="talk"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "fightable_steward_selected", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1a"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "early_combat_screen", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1a"][data-wuxia-npc-action="compete"]'), "STATE_FS_009_EARLY_COMBAT");
    await waitForCombatAutoResolveAndCapture(cdp, "combat_returned_to_map", "STATE_FS_008_MAP_EXPLORE");
  } else if (scenario !== "entity-actions" && scenario !== "route-unlock-plan" && scenario !== "interaction-contract") {
    await clickAndCapture(cdp, "gate_room", () => clickSelector(cdp, '[data-wuxia-room-id="fb01_01"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "old_steward_selected", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1"]'), "STATE_FS_008_MAP_EXPLORE");
    await clickAndCapture(cdp, "old_steward_talk", () => clickSelector(cdp, '[data-wuxia-npc-id="fb01r01_1"][data-wuxia-npc-action="talk"]'), "STATE_FS_008_MAP_EXPLORE");
    if (scenario === "chapter1-deep") {
      await clickNpcAndCapture(cdp, "fb01r01_1a", "old_steward_fightable_selected");
      await clickNpcCombatAndWait(cdp, "fb01r01_1a", "old_steward_compete_win");
    }
  }

  if (scenario === "entity-actions") {
    if (!crawlRoomId || !crawlEntityId || !crawlActionTypes.length) {
      throw new Error("entity-actions requires --room-id, --entity-id, and --interaction-actions.");
    }
    const entitySelectorAttribute = crawlEntityKind === "interactable" ? "data-wuxia-interactable-id" : "data-wuxia-npc-id";
    const actionSelectorAttribute = crawlEntityKind === "interactable" ? "data-wuxia-interactable-action" : "data-wuxia-npc-action";
    const route = crawlRouteRoomIds.length ? crawlRouteRoomIds : [crawlRoomId];
    for (const [index, roomId] of route.entries()) {
      await clickAndCapture(
        cdp,
        `crawl_route_${String(index + 1).padStart(2, "0")}_${roomId}`.replace(/[^a-zA-Z0-9_]+/g, "_"),
        () => clickSelector(cdp, `button[data-wuxia-room-id="${roomId}"]`),
        "STATE_FS_008_MAP_EXPLORE",
        roomId,
      );
    }
    await clickAndCapture(cdp, "crawl_entity_selected", () => clickSelector(cdp, `button[${entitySelectorAttribute}="${crawlEntityId}"]`), "STATE_FS_008_MAP_EXPLORE");
    for (const actionType of crawlActionTypes) {
      await clickAndCapture(
        cdp,
        `crawl_${crawlEntityKind}_${crawlEntityId}_${actionType}`.replace(/[^a-zA-Z0-9_]+/g, "_"),
        () => clickSelector(cdp, `button[${entitySelectorAttribute}="${crawlEntityId}"][${actionSelectorAttribute}="${actionType}"]`),
        crawlExpectedState,
      );
    }
    if (crawlExpectedVisibleNpcId) {
      await assertVisibleNpcAndCapture(
        cdp,
        crawlExpectedVisibleNpcId,
        `crawl_expected_visible_npc_${crawlExpectedVisibleNpcId}`.replace(/[^a-zA-Z0-9_]+/g, "_"),
      );
    }
  }

  if (scenario === "route-unlock-plan") {
    if (!routeUnlockPlanPath || !routeGateEvidence || !crawlRouteRoomIds.length) {
      throw new Error("route-unlock-plan requires --route-unlock-plan, --route-gate-evidence, and --route-room-ids.");
    }
    const planDocument = JSON.parse(fs.readFileSync(path.resolve(root, routeUnlockPlanPath), "utf8"));
    const plan = (planDocument.plans || []).find((candidate) => candidate.routeGateEvidence === routeGateEvidence);
    if (!plan) throw new Error(`No route-unlock plan found for ${routeGateEvidence}.`);
    const flowDocument = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_first_session_flow.json"), "utf8"));
    const mapState = (flowDocument.states || []).find((state) => state.screenId === "UI_MapExplore")?.stateId;
    const combatPolicy = flowDocument.chapterSystem?.combatActionPolicies?.compete;
    const actionMap = new Map((flowDocument.actions || []).map((action) => [action.actionId, action]));
    const resolveAction = actionMap.get(combatPolicy?.resolveActionId || "");
    if (!mapState || !combatPolicy || !resolveAction || resolveAction.toState !== mapState) {
      throw new Error("Route-unlock plan requires an auto-resolving combat action that returns directly to map state.");
    }
    for (const [index, roomId] of crawlRouteRoomIds.entries()) {
      await clickAndCapture(
        cdp,
        `route_unlock_entry_${String(index + 1).padStart(2, "0")}_${roomId}`.replace(/[^a-zA-Z0-9_]+/g, "_"),
        () => clickSelector(cdp, `button[data-wuxia-room-id="${roomId}"]`),
        mapState,
        roomId,
      );
    }
    for (const step of plan.unlockSteps || []) {
      if (!step.actionType) throw new Error(`Route-unlock step ${step.order} has no evidence-bound actionType.`);
      const prefix = `route_unlock_${String(step.order).padStart(2, "0")}_${step.roleId}_${step.actionType}`.replace(/[^a-zA-Z0-9_]+/g, "_");
      await clickAndCapture(cdp, `${prefix}_select`, () => clickSelector(cdp, `button[data-wuxia-npc-id="${step.roleId}"]`), mapState);
      const isCombat = step.actionType === combatPolicy.actionType;
      const expectedAfterAction = isCombat
        ? (actionMap.get(combatPolicy.startActionId)?.toState || "")
        : mapState;
      await clickAndCapture(
        cdp,
        `${prefix}_action`,
        () => clickSelector(cdp, `button[data-wuxia-npc-id="${step.roleId}"][data-wuxia-npc-action="${step.actionType}"]`),
        expectedAfterAction,
      );
      if (isCombat) {
        await waitForCombatAutoResolveAndCapture(cdp, `${prefix}_auto_resolve`, mapState);
      }
    }
    if (!plan.targetRoomId) throw new Error(`Route-unlock plan ${routeGateEvidence} has no targetRoomId from its condition record.`);
    await clickAndCapture(
      cdp,
      `route_unlock_target_${plan.targetRoomId}`.replace(/[^a-zA-Z0-9_]+/g, "_"),
      () => clickSelector(cdp, `button[data-wuxia-room-id="${plan.targetRoomId}"]`),
      mapState,
      plan.targetRoomId,
    );
  }

  if (scenario === "chapter1-deep") {
    await clickRoomAndCapture(cdp, "fb01_01b", "road_01b");
    await clickRoomAndCapture(cdp, "fb01_01c", "road_01c");
    await clickRoomAndCapture(cdp, "fb01_02", "front_yard");
    await clickNpcAndCapture(cdp, "fb01r02_1b", "coach_zhao_selected");
    await clickNpcActionAndCapture(cdp, "fb01r02_1b", "talk", "coach_zhao_gate_intro");
    await clickNpcAndCapture(cdp, "fb01r02_1", "coach_zhao_fightable_selected");
    await clickNpcCombatAndWait(cdp, "fb01r02_1", "coach_zhao_compete_win");
    await clickRoomAndCapture(cdp, "fb01_03", "blocked_by_zhou_before_compete");
    await clickNpcAndCapture(cdp, "fb01r02_2", "coach_zhou_selected");
    await clickNpcCombatAndWait(cdp, "fb01r02_2", "coach_zhou_compete_win");
    await clickRoomAndCapture(cdp, "fb01_03", "yard_inner");
    await clickRoomAndCapture(cdp, "fb01_04", "main_hall");
    await clickNpcAndCapture(cdp, "fb01r04_1", "zhang_feng_selected");
    await clickNpcActionAndCapture(cdp, "fb01r04_1", "talk", "zhang_feng_talk");
    await clickNpcAndCapture(cdp, "fb01r04_1a", "zhang_feng_fightable_selected");
    await clickNpcCombatAndWait(cdp, "fb01r04_1a", "chapter_clear_fb01");
    await clickRoomAndCapture(cdp, "fb01_05", "owner_corridor");
    await clickNpcAndCapture(cdp, "fb01r05_1", "zhu_yu_selected");
    await clickNpcActionAndCapture(cdp, "fb01r05_1", "talk", "zhu_yu_talk");
    await clickRoomAndCapture(cdp, "fb01_06", "study_room");
    await clickItemAndCapture(cdp, "fb01item_20", "study_bookcase_20_selected");
    await clickItemActionAndCapture(cdp, "fb01item_20", "use", "study_bookcase_20_use");
    await clickItemAndCapture(cdp, "fb01item_16", "study_bookcase_16_selected");
    await clickItemActionAndCapture(cdp, "fb01item_16", "use", "study_bookcase_16_use");
    await clickRoomAndCapture(cdp, "fb01_05", "owner_corridor_return");
    await clickRoomAndCapture(cdp, "fb01_07", "owner_bedroom");
    await clickNpcAndCapture(cdp, "fb01r07_1", "zhu_madam_selected");
    await clickNpcActionAndCapture(cdp, "fb01r07_1", "talk", "zhu_madam_talk");
    await clickItemAndCapture(cdp, "fb01item_5", "bedroom_box_selected");
    await clickItemActionAndCapture(cdp, "fb01item_5", "open", "bedroom_box_open");
    await clickRoomAndCapture(cdp, "fb01_05", "owner_corridor_after_bedroom");
    await clickRoomAndCapture(cdp, "fb01_04", "main_hall_return");
    await clickRoomAndCapture(cdp, "fb01_20", "west_corridor_servant_room");
    await clickNpcAndCapture(cdp, "fb01r20_1", "servant_selected");
    await clickNpcActionAndCapture(cdp, "fb01r20_1", "talk", "servant_talk");
  }

  cdp.close();
} catch (error) {
  runError = {
    message: error?.message || String(error),
    stack: error?.stack || "",
  };
  try {
    if (cdp) {
      const failureSummary = await capture(cdp, "failure_runtime_not_ready");
      failureSummary.error = runError.message;
    }
  } catch (captureError) {
    runError.captureError = captureError?.message || String(captureError);
  }
} finally {
  try {
    cdp?.close?.();
  } catch {
    // best-effort cleanup only
  }
  edge.kill();
}

const failures = [
  ...results.filter((row) => row.error || row.badMatches?.length),
  ...(runError ? [{ label: "run_error", error: runError.message, stack: runError.stack, captureError: runError.captureError || "" }] : []),
];
const report = {
  generatedAt: new Date().toISOString(),
  url,
  scenario,
  viewport: `${viewportWidth}x${viewportHeight}`,
  steps: results.length,
  failures,
  runError,
  results,
  edgeWarnings: stderr.join("").split(/\r?\n/).filter(Boolean).slice(-20),
};

fs.writeFileSync(path.join(outDir, "real_browser_flow_summary.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "real_browser_flow_summary.md"), [
  "# Real Browser Flow Acceptance",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- url: ${url}`,
  `- scenario: ${scenario}`,
  `- viewport: ${report.viewport}`,
  `- steps: ${report.steps}`,
  `- failures: ${failures.length}`,
  "",
  "| Step | State | Screen | Title | Click | Bad | Screenshot |",
  "|---|---|---|---|---|---|---|",
  ...results.map((row) => `| ${row.label} | ${row.state} | ${row.screen} | ${row.title} | ${row.click?.text || ""} | ${(row.badMatches || []).join(" ")}${row.error ? ` ${row.error}` : ""} | ${row.screenshot} |`),
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({
  outDir,
  scenario,
  steps: results.length,
  failures: failures.length,
  finalState: results.at(-1)?.state || "",
}, null, 2));

if (failures.length) process.exitCode = 1;
