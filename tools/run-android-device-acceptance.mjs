import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(".");

function option(name, fallback = "") {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const contractPath = option("--contract", "config/android_device_acceptance_contract.json");
const contract = readJson(contractPath);
const identity = readJson(contract.identityContract);
const adb = option("--adb", process.env.IDLEWUXIA_ADB_PATH || "");
const serial = option("--serial", process.env.IDLEWUXIA_ADB_SERIAL || "");
const apkPath = path.resolve(option("--apk", "outputs/idlewuxia-debug.apk"));
const outputDir = path.resolve(option("--output", "outputs/android_device_acceptance/latest"));
const packageName = identity.debugApplicationId;
const activity = `${packageName}/${identity.launcherClass}`;

if (!adb || !fs.existsSync(adb)) throw new Error("ADB path is required via --adb or IDLEWUXIA_ADB_PATH.");
if (!serial) throw new Error("ADB serial is required via --serial or IDLEWUXIA_ADB_SERIAL.");
if (!fs.existsSync(apkPath)) throw new Error(`APK is missing: ${apkPath}`);

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

function adbText(...args) {
  return execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8" }).trim();
}

function adbBytes(...args) {
  return execFileSync(adb, ["-s", serial, ...args]);
}

async function evaluate(expression) {
  const appPid = adbText("shell", "pidof", packageName).split(/\s+/)[0];
  assert.ok(appPid, "application process must be running");
  try {
    adbText("forward", "--remove", "tcp:9222");
  } catch {
    // The forwarding rule may not exist on the first call.
  }
  adbText("forward", "tcp:9222", `localabstract:webview_devtools_remote_${appPid}`);
  const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === "page");
  assert.ok(target, "debuggable WebView page target must exist");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const message = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CDP evaluation timed out.")), 5000);
    socket.addEventListener("message", (event) => {
      const candidate = JSON.parse(event.data);
      if (candidate.id !== 1) return;
      clearTimeout(timeout);
      resolve(candidate);
    });
    socket.send(JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression, returnByValue: true, awaitPromise: true },
    }));
  });
  socket.close();
  if (message.error || message.result?.exceptionDetails) {
    throw new Error(`CDP evaluation failed: ${JSON.stringify(message)}`);
  }
  return message.result?.result?.value;
}

async function runtimeSummary() {
  return evaluate(`(() => {
    const snapshot = window.__idleWuxiaAutomation?.snapshot?.();
    return {
      bodyText: document.body.innerText,
      currentState: snapshot?.currentState || "",
      screen: document.body.dataset.wuxiaScreen || "",
      origin: snapshot?.player?.origin || "",
      eventCount: snapshot?.events?.length || 0,
      persistence: window.__idleWuxiaAutomation?.persistenceStatus?.() || { status: "unavailable" },
      viewport: {
        width: innerWidth,
        height: innerHeight,
        devicePixelRatio,
      },
    };
  })()`);
}

function assertRuntime(summary, expected, persistenceStatuses = []) {
  assert.ok(!summary.bodyText.includes("配置加载失败"), "startup error panel must be absent");
  assert.equal(summary.currentState, expected.state);
  assert.equal(summary.screen, expected.screen);
  if (expected.origin !== undefined) assert.equal(summary.origin, expected.origin);
  if (persistenceStatuses.length) {
    assert.ok(persistenceStatuses.includes(summary.persistence.status), `unexpected persistence status ${summary.persistence.status}`);
  }
}

function startActivity(wait = false) {
  return adbText("shell", "am", "start", ...(wait ? ["-W"] : []), "-n", activity);
}

function screenshot(name) {
  const destination = path.join(outputDir, name);
  fs.writeFileSync(destination, adbBytes("exec-out", "screencap", "-p"));
  return destination;
}

const report = {
  $schema: "idlewuxia.android_device_acceptance.v1",
  generatedAt: new Date().toISOString(),
  status: "fail",
  device: { serial },
  apk: {
    path: apkPath,
    bytes: fs.statSync(apkPath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(apkPath)).digest("hex"),
  },
  cases: [],
  findings: [],
};

function passCase(id, detail) {
  report.cases.push({ id, status: "pass", detail });
}

try {
  assert.equal(adbText("get-state"), "device");
  report.device.model = adbText("shell", "getprop", "ro.product.model");
  report.device.android = adbText("shell", "getprop", "ro.build.version.release");
  adbText("install", "-r", "-t", apkPath);
  assert.equal(adbText("shell", "pm", "clear", packageName), "Success");
  adbText("logcat", "-c");

  startActivity(true);
  await sleep(contract.settleMs.coldStart);
  const initial = await runtimeSummary();
  assertRuntime(initial, { state: contract.initialState, screen: contract.initialScreen, origin: "" });
  const expectedAspect = contract.referenceViewport.width / contract.referenceViewport.height;
  const actualAspect = initial.viewport.width / initial.viewport.height;
  assert.ok(Math.abs(expectedAspect - actualAspect) <= contract.referenceViewport.aspectTolerance, "viewport must match the 540x960 reference aspect");
  screenshot("00_cold_start.png");
  passCase("cold_start", initial);

  const tapX = Math.round(initial.viewport.width * initial.viewport.devicePixelRatio * contract.playerAction.tapRatio.x);
  const tapY = Math.round(initial.viewport.height * initial.viewport.devicePixelRatio * contract.playerAction.tapRatio.y);
  adbText("shell", "input", "tap", String(tapX), String(tapY));
  await sleep(contract.settleMs.lifecycle);
  const afterAction = await runtimeSummary();
  assertRuntime(afterAction, {
    state: contract.playerAction.expectedState,
    screen: contract.playerAction.expectedScreen,
    origin: contract.playerAction.expectedOrigin,
  }, ["saved"]);
  passCase("player_action_and_save", { ...afterAction, tapX, tapY });

  adbText("shell", "input", "keyevent", "3");
  await sleep(contract.settleMs.lifecycle);
  startActivity();
  await sleep(contract.settleMs.lifecycle);
  assertRuntime(await runtimeSummary(), {
    state: contract.playerAction.expectedState,
    screen: contract.playerAction.expectedScreen,
    origin: contract.playerAction.expectedOrigin,
  }, ["saved", "restored"]);
  passCase("background_foreground", "state retained");

  adbText("shell", "input", "keyevent", "26");
  await sleep(contract.settleMs.lifecycle);
  assert.ok(adbText("shell", "dumpsys", "power").includes("mWakefulness=Asleep"), "device must enter sleep state");
  adbText("shell", "input", "keyevent", "26");
  adbText("shell", "input", "keyevent", "82");
  await sleep(contract.settleMs.lifecycle);
  assertRuntime(await runtimeSummary(), {
    state: contract.playerAction.expectedState,
    screen: contract.playerAction.expectedScreen,
    origin: contract.playerAction.expectedOrigin,
  }, ["saved", "restored"]);
  passCase("lock_unlock", "state retained");

  adbText("shell", "input", "keyevent", "4");
  await sleep(contract.settleMs.lifecycle);
  startActivity(true);
  await sleep(contract.settleMs.forceStop);
  assertRuntime(await runtimeSummary(), {
    state: contract.playerAction.expectedState,
    screen: contract.playerAction.expectedScreen,
    origin: contract.playerAction.expectedOrigin,
  }, ["restored"]);
  passCase("android_back_relaunch", "state restored");

  adbText("shell", "am", "force-stop", packageName);
  startActivity(true);
  await sleep(contract.settleMs.forceStop);
  const final = await runtimeSummary();
  assertRuntime(final, {
    state: contract.playerAction.expectedState,
    screen: contract.playerAction.expectedScreen,
    origin: contract.playerAction.expectedOrigin,
  }, ["restored"]);
  const focus = adbText("shell", "dumpsys", "window", "windows");
  assert.ok(focus.includes(`${packageName}/${identity.launcherClass}`), "application must own the final window focus");
  screenshot("01_final_state.png");
  passCase("force_stop_relaunch", final);

  const logcat = adbText("logcat", "-d", "-v", "time");
  fs.writeFileSync(path.join(outputDir, "device_logcat.txt"), `${logcat}\n`);
  const crashHits = contract.crashPatterns.filter((pattern) => logcat.includes(pattern));
  assert.deepEqual(crashHits, [], `device log contains crash patterns: ${crashHits.join(", ")}`);
  passCase("device_log", { crashHits: 0 });
  report.status = "pass";
} catch (error) {
  report.findings.push({ severity: "P0", message: error?.stack || error?.message || String(error) });
}

fs.writeFileSync(path.join(outputDir, "device_acceptance_report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exitCode = 1;
