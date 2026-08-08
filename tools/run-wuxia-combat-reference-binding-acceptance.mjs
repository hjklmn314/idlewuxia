import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const outDir = path.resolve(root, process.env.WUXIA_REFERENCE_BINDING_OUT_DIR || "outputs/combat_reference_binding_acceptance_20260809");
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const debugPort = Number(process.env.EDGE_DEBUG_PORT || 9231);
const width = Number(process.env.WUXIA_VIEWPORT_WIDTH || 540);
const height = Number(process.env.WUXIA_VIEWPORT_HEIGHT || 960);
const url = `http://127.0.0.1:5187/?real-browser-flow=20260809&scenario=reference-binding&originalProjectAssets=1`;
const manualVisualAcceptance = process.env.WUXIA_MANUAL_VISUAL_ACCEPTANCE || "PENDING_REVIEW";

fs.mkdirSync(outDir, { recursive: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchJson(target) {
  const response = await fetch(target);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${target}`);
  return response.json();
}
async function waitForTarget() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
      const page = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* Edge is still starting. */ }
    await delay(250);
  }
  throw new Error("Timed out waiting for Edge DevTools target.");
}
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  ws.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const waiter = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) waiter.reject(new Error(JSON.stringify(payload.error)));
      else waiter.resolve(payload.result);
    } else if (payload.method) events.push(payload);
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({
      events,
      close: () => ws.close(),
      send(method, params = {}) {
        const requestId = ++id;
        ws.send(JSON.stringify({ id: requestId, method, params }));
        return new Promise((resolveSend, rejectSend) => {
          pending.set(requestId, { resolve: resolveSend, reject: rejectSend });
          setTimeout(() => {
            if (pending.has(requestId)) {
              pending.delete(requestId);
              rejectSend(new Error(`CDP timeout: ${method}`));
            }
          }, method === "Page.navigate" ? 30000 : 10000);
        });
      },
    }));
    ws.addEventListener("error", reject);
  });
}
async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function waitForState(cdp, state, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, "document.body?.dataset?.wuxiaState || ''") === state) return true;
    await delay(100);
  }
  return false;
}
async function click(cdp, selector) {
  return evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return { clicked: false, reason: "missing selector", selector: ${JSON.stringify(selector)} };
    node.click();
    return { clicked: true, text: node.textContent.trim(), selector: ${JSON.stringify(selector)} };
  })()`);
}
async function dispatch(cdp, actionId) {
  return evaluate(cdp, `window.__idleWuxiaAutomation?.dispatchAction?.(${JSON.stringify(actionId)})`);
}
async function capture(cdp, label) {
  await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await delay(50);
  const summary = await evaluate(cdp, `(() => {
    const runtime = document.querySelector('[data-testid="combat-runtime"]');
    const scene = document.querySelector('.wuxia-runtime-scene-reference');
    const buffs = [...document.querySelectorAll('.wuxia-runtime-buffs img')].map((img) => ({ src: img.src, complete: img.complete, naturalWidth: img.naturalWidth, alt: img.alt }));
    const snapshot = window.__idleWuxiaAutomation?.snapshot?.() || {};
    const events = snapshot.pendingCombat?.combatSnapshot?.events || [];
    return {
      label: ${JSON.stringify(label)},
      state: document.body?.dataset?.wuxiaState || '',
      screen: document.body?.dataset?.wuxiaScreen || '',
      assetMode: runtime?.dataset?.wuxiaAssetMode || '',
      scene: scene ? { src: scene.src, complete: scene.complete, naturalWidth: scene.naturalWidth, naturalHeight: scene.naturalHeight } : null,
      buffImages: buffs,
      buffEvents: events.filter((event) => ["buff", "debuff"].includes(event.kind)).slice(-5).map((event) => ({ seq: event.seq, kind: event.kind, buffId: event.buffId, audioCueId: event.audioCueId, targetUnitId: event.targetUnitId })),
      eventTail: events.slice(-5).map((event) => ({ seq: event.seq, kind: event.kind, audioCueId: event.audioCueId })),
      combatControl: snapshot.pendingCombat?.combatControl || null,
      combatStatus: snapshot.pendingCombat?.combatSnapshot?.status || '',
      audioProbe: window.__idleWuxiaReferenceBindingAudioProbe || [],
      audioResources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\.mp3(?:$|[?#])/i.test(name)),
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    };
  })()`);
  const png = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = path.join(outDir, `${String(capture.count++).padStart(2, "0")}_${label}.png`);
  fs.writeFileSync(file, Buffer.from(png.data, "base64"));
  summary.screenshot = path.relative(root, file).replaceAll("\\", "/");
  return summary;
}
capture.count = 1;

const edgeProfile = path.join(outDir, "edge_cdp_profile");
fs.mkdirSync(edgeProfile, { recursive: true });
const edge = spawn(edgePath, [
  "--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${debugPort}`,
  `--window-size=${width},${height}`, `--user-data-dir=${edgeProfile}`, url,
], { stdio: ["ignore", "pipe", "pipe"] });
const consoleProblems = [];
const results = [];
let cdp;
let runError = null;
try {
  const target = await waitForTarget();
  cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  cdp.events.push({ method: "manualAcceptanceStart", params: { url, viewport: `${width}x${height}` } });
  await cdp.send("Page.navigate", { url });
  while (!(await evaluate(cdp, "document.body?.dataset?.wuxiaState || ''"))) await delay(100);
  // The same evidence directory may be reused between runs. Clear the
  // project save and reload so every acceptance starts from the declared
  // first-session seed rather than stale browser storage.
  await evaluate(cdp, "window.__idleWuxiaAutomation?.clearSave?.(); location.reload(); true");
  while (!(await evaluate(cdp, "document.body?.dataset?.wuxiaState || ''"))) await delay(100);
  await evaluate(cdp, `(() => {
    window.__idleWuxiaReferenceBindingAudioProbe = [];
    // Chromium exposes Audio as a host constructor whose window property is
    // not reliably writable in headless mode. Intercept the media prototype
    // instead so the probe records the exact URL passed to play().
    if (window.HTMLMediaElement?.prototype?.play) {
      const nativePlay = window.HTMLMediaElement.prototype.play;
      window.HTMLMediaElement.prototype.play = function probedPlay(...args) {
        window.__idleWuxiaReferenceBindingAudioProbe.push({ src: String(this.currentSrc || this.src || '') });
        return nativePlay.apply(this, args);
      };
    }
  })()`);
  const bootstrapActions = [
    "ACTION_FS_001_ORIGIN_SCHOLAR", "ACTION_FS_001_ORIGIN_RESULT_CONTINUE", "ACTION_FS_002_TITLE_START",
    "ACTION_FS_003_CHARACTER_STATUS", "ACTION_FS_004_IDLE_CONFIRM", "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
    "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE", "ACTION_FS_007_CHAPTER_CARD_ENTRY",
  ];
  for (const actionId of bootstrapActions) {
    const outcome = await dispatch(cdp, actionId);
    if (!outcome?.clicked) throw new Error(`bootstrap action rejected: ${actionId}`);
    await delay(100);
  }
  if (!(await waitForState(cdp, "STATE_FS_008_MAP_EXPLORE"))) throw new Error("map state did not render");
  for (const selector of [
    '[data-wuxia-room-id="fb01_01"]',
    '[data-wuxia-npc-id="fb01r01_1"]',
    '[data-wuxia-npc-id="fb01r01_1"][data-wuxia-npc-action="talk"]',
    '[data-wuxia-npc-id="fb01r01_1a"]',
    '[data-wuxia-npc-id="fb01r01_1a"][data-wuxia-npc-action="compete"]',
  ]) {
    const outcome = await click(cdp, selector);
    if (!outcome?.clicked) throw new Error(`combat route click failed: ${selector}`);
    await delay(180);
  }
  if (!(await waitForState(cdp, "STATE_FS_009_EARLY_COMBAT"))) throw new Error("early combat state did not render");
  results.push(await capture(cdp, "combat_reference_scene_before_buff"));

  const deadline = Date.now() + 12000;
  let submitted = null;
  while (Date.now() < deadline && !submitted) {
    const control = await evaluate(cdp, "window.__idleWuxiaAutomation?.snapshot?.()?.pendingCombat?.combatControl || null");
    if (control?.requiresPlayerInput) {
      const guard = (control.availableActions?.skills || []).find((skill) => skill.skillId === "skill_guard" && skill.available);
      const skill = guard || (control.availableActions?.skills || []).find((entry) => entry.available);
      if (skill) {
        submitted = await evaluate(cdp, `window.__idleWuxiaAutomation?.submitCombatAction?.(${JSON.stringify(control.actorId)}, ${JSON.stringify(skill.skillId)}, [])`);
        break;
      }
    }
    await delay(100);
  }
  if (!submitted?.clicked) throw new Error(`no usable configured player buff skill: ${JSON.stringify(submitted)}`);
  await delay(180);
  results.push(await capture(cdp, "combat_reference_buff_and_audio_after_skill"));

  const finalProbe = results.at(-1);
  const failures = [];
  if (finalProbe.assetMode !== "original-project-development") failures.push(`asset mode was ${finalProbe.assetMode || "empty"}`);
  if (!finalProbe.scene?.complete || finalProbe.scene.naturalWidth <= 0) failures.push("original-project scene did not load");
  if (!finalProbe.buffImages.length || finalProbe.buffImages.some((entry) => !entry.complete || entry.naturalWidth <= 0)) failures.push("configured Buff icon did not load in runtime");
  if (!finalProbe.buffEvents.length) failures.push("no configured Buff event was observed");
  if (!finalProbe.audioProbe.some((entry) => /\.mp3(?:$|[?#])/i.test(entry.src))) failures.push("no original-project MP3 audio binding was invoked");
  if (finalProbe.viewport.scrollWidth > finalProbe.viewport.width) failures.push("horizontal overflow in manual viewport");
  results.failures = failures;
} catch (error) {
  runError = { message: error.message, stack: error.stack };
} finally {
  for (const entry of cdp?.events || []) {
    if (entry.method === "Runtime.exceptionThrown") consoleProblems.push(entry.params?.exceptionDetails?.text || "runtime exception");
    if (entry.method === "Runtime.consoleAPICalled" && ["warning", "error", "assert"].includes(entry.params?.type)) consoleProblems.push(`console ${entry.params.type}`);
    if (entry.method === "Log.entryAdded" && ["warning", "error"].includes(entry.params?.entry?.level)) consoleProblems.push(`log ${entry.params.entry.level}: ${entry.params.entry.text || ""}`);
  }
  cdp?.close();
  edge.kill();
}

const failures = [
  ...(results.failures || []),
  ...consoleProblems,
  ...(runError ? [runError.message] : []),
];
const report = {
  generatedAt: new Date().toISOString(),
  url,
  viewport: `${width}x${height}`,
  status: failures.length ? "FAIL" : "PASS WITH KNOWN PRODUCTION LIMITATIONS",
  developmentBinding: "original-project-development",
  manualVisualAcceptanceRequired: true,
  manualVisualAcceptance,
  failures,
  runError,
  consoleProblems,
  results: results.filter((entry) => entry && typeof entry === "object"),
};
fs.writeFileSync(path.join(outDir, "reference_binding_acceptance.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "reference_binding_acceptance.md"), [
  "# Original-project combat binding acceptance",
  "",
  `- status: ${report.status}`,
  `- viewport: ${report.viewport}`,
  `- manualVisualAcceptance: ${report.manualVisualAcceptance}`,
  `- failures: ${failures.length}`,
  "- production verdict: BLOCKED (development-only reference overlay; actor/VFX/OGG ownership remains open)",
  "",
  ...report.results.map((entry) => `## ${entry.label}\n\n- state: ${entry.state}\n- assetMode: ${entry.assetMode}\n- scene: ${entry.scene?.naturalWidth || 0}px\n- Buff images: ${entry.buffImages?.length || 0}\n- Buff events: ${entry.buffEvents?.length || 0}\n- reference audio probes: ${entry.audioProbe?.length || 0}\n- screenshot: ${entry.screenshot}\n`),
  "## Required human review",
  "",
  "Open both screenshots with the image viewer. Confirm the original-project clean scene is loaded, the Buff icon is readable and attached to the unit, combat controls remain readable, and no horizontal overflow or clipped status exists. This report cannot be promoted to production PASS by automation alone.",
  "",
].join("\n"), "utf8");
console.log(JSON.stringify({ outDir, status: report.status, failures: failures.length, screenshots: report.results.map((entry) => entry.screenshot) }, null, 2));
if (failures.length) process.exitCode = 1;
