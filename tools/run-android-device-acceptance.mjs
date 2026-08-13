import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  assertFreshOutputDirectory,
  auditAndroidDeviceContract,
  evaluatePerformanceBudgets,
  forbiddenTextHits,
  parseAmStartWait,
  parseGfxInfo,
  parseMemoryInfo,
  selectDeviceProfile,
  validateAndroidDeviceContractSchema,
} from "./lib/android-device-acceptance.mjs";

const root = path.resolve(".");
const option = (name, fallback = "") => {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const requireCleanRevision = process.argv.includes("--require-clean-revision");
const gitText = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 20_000 }).trim();
const safeGitText = (...args) => {
  try { return gitText(...args); } catch { return ""; }
};

const contractPath = option("--contract", "config/android_device_acceptance_contract.json");
const contract = readJson(contractPath);
const schema = readJson(contract.schemaPath);
const schemaResult = validateAndroidDeviceContractSchema(contract, schema);
assert.equal(schemaResult.pass, true, `Device acceptance Schema failed: ${JSON.stringify(schemaResult.errors)}`);
const contractAudit = auditAndroidDeviceContract(contract);
assert.equal(contractAudit.pass, true, `Device acceptance semantics failed: ${JSON.stringify(contractAudit.findings)}`);

const profileId = option("--profile", "");
const profile = selectDeviceProfile(contract, profileId);
const identity = readJson(contract.identityContract);
const adb = option("--adb", process.env.IDLEWUXIA_ADB_PATH || "");
const serial = option("--serial", process.env.IDLEWUXIA_ADB_SERIAL || profile.serialHint || "");
const apkPath = path.resolve(option("--apk", "outputs/idlewuxia-debug.apk"));
const outputDir = path.resolve(option("--output", ""));
const packageName = identity.debugApplicationId;
const activity = `${packageName}/${identity.launcherClass}`;

if (!adb || !fs.existsSync(adb)) throw new Error("ADB path is required via --adb or IDLEWUXIA_ADB_PATH.");
if (!serial) throw new Error("ADB serial is required via --serial, IDLEWUXIA_ADB_SERIAL or the selected profile.");
if (!fs.existsSync(apkPath)) throw new Error(`APK is missing: ${apkPath}`);
if (!option("--output", "")) throw new Error("A unique --output child directory is required; evidence is never overwritten or deleted.");

const sourceRevision = {
  head: gitText("rev-parse", "HEAD"),
  upstream: safeGitText("rev-parse", "@{upstream}"),
  dirtyEntries: gitText("status", "--porcelain=v1", "--untracked-files=normal")
    .split(/\r?\n/)
    .filter(Boolean),
  cleanRequired: requireCleanRevision,
};
sourceRevision.clean = sourceRevision.dirtyEntries.length === 0;
sourceRevision.matchesUpstream = Boolean(sourceRevision.upstream) && sourceRevision.head === sourceRevision.upstream;
if (requireCleanRevision) {
  assert.equal(sourceRevision.clean, true, `formal evidence requires a clean tracked worktree: ${sourceRevision.dirtyEntries.join(", ")}`);
  assert.ok(sourceRevision.upstream, "formal evidence requires a configured upstream revision");
  assert.equal(sourceRevision.matchesUpstream, true, "formal evidence requires local HEAD to match its pushed upstream revision");
}
assertFreshOutputDirectory(root, outputDir, contract.evidencePolicy.outputRoot);

const adbText = (...args) => execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8", timeout: 20_000 }).trim();
const adbBytes = (...args) => execFileSync(adb, ["-s", serial, ...args], { timeout: 20_000 });
const safeAdbText = (...args) => {
  try { return adbText(...args); } catch { return ""; }
};

async function evaluate(expression, retries = 10) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const appPid = adbText("shell", "pidof", packageName).split(/\s+/)[0];
      assert.ok(appPid, "application process must be running");
      safeAdbText("forward", "--remove", "tcp:9222");
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
        socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
      });
      socket.close();
      if (message.error || message.result?.exceptionDetails) throw new Error(`CDP evaluation failed: ${JSON.stringify(message)}`);
      return message.result?.result?.value;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError;
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
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    };
  })()`);
}

async function actionCoordinates() {
  const exactText = JSON.stringify(contract.playerAction.locator.exactText);
  const result = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent.trim() === ${exactText});
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height, devicePixelRatio };
  })()`);
  assert.ok(result, `Unable to find configured button: ${contract.playerAction.locator.exactText}`);
  return {
    source: "cdp-dom-button-text",
    cssRect: result,
    tapX: Math.round(result.x * result.devicePixelRatio),
    tapY: Math.round(result.y * result.devicePixelRatio),
  };
}

function assertRuntime(summary, expected, persistenceStatuses = []) {
  const textHits = forbiddenTextHits(summary.bodyText, contract.textIntegrityForbiddenPatterns);
  assert.deepEqual(textHits, [], `rendered text contains forbidden encoding patterns: ${textHits.join(", ")}`);
  assert.equal(summary.currentState, expected.state);
  assert.equal(summary.screen, expected.screen);
  if (expected.origin !== undefined) assert.equal(summary.origin, expected.origin);
  if (persistenceStatuses.length) assert.ok(persistenceStatuses.includes(summary.persistence.status), `unexpected persistence status ${summary.persistence.status}`);
}

function startActivity(wait = false) {
  const text = adbText("shell", "am", "start", ...(wait ? ["-W"] : []), "-n", activity);
  return wait ? parseAmStartWait(text) : { raw: text };
}

function screenshot(name) {
  assert.ok(contract.requiredScreenshots.includes(name), `Screenshot is not declared by contract: ${name}`);
  const destination = path.join(outputDir, name);
  fs.writeFileSync(destination, adbBytes("exec-out", "screencap", "-p"));
  return destination;
}

function uiTree(name) {
  adbText("shell", "uiautomator", "dump", "/sdcard/window.xml");
  fs.writeFileSync(path.join(outputDir, name), adbBytes("exec-out", "cat", "/sdcard/window.xml"));
}

function collectInstalledPackage() {
  const dump = adbText("shell", "dumpsys", "package", packageName);
  return {
    versionName: dump.match(/versionName=([^\s]+)/)?.[1] || "",
    versionCode: Number(dump.match(/versionCode=(\d+)/)?.[1] || NaN),
    firstInstallTime: dump.match(/firstInstallTime=(.+)/)?.[1]?.trim() || "",
    lastUpdateTime: dump.match(/lastUpdateTime=(.+)/)?.[1]?.trim() || "",
  };
}

function restoreNetworkIsolation() {
  if (appFirewallUid) {
    safeAdbText("shell", "su", "0", "iptables", "-D", "OUTPUT", "-m", "owner", "--uid-owner", appFirewallUid, "-j", "REJECT");
    appFirewallUid = "";
  }
  if (wifiInitial.known && profile.networkIsolationCapabilities.includes("wifi")) safeAdbText("shell", "svc", "wifi", wifiInitial.value === "1" ? "enable" : "disable");
  if (dataInitial.known && profile.networkIsolationCapabilities.includes("mobile-data")) safeAdbText("shell", "svc", "data", dataInitial.value === "1" ? "enable" : "disable");
}

const report = {
  $schema: "idlewuxia.android_device_acceptance.v2",
  generatedAt: new Date().toISOString(),
  status: "fail",
  releaseEligible: false,
  qualification: "unverified",
  sourceRevision,
  contract: { path: contractPath, version: contract.contractVersion, sha256: sha256File(path.join(root, contractPath)) },
  profile,
  device: { serial },
  apk: { path: apkPath, bytes: fs.statSync(apkPath).size, sha256: sha256File(apkPath), buildType: "debug" },
  cases: [],
  performance: null,
  evidence: [],
  findings: [],
  limitations: [],
  manualVisualAcceptance: { required: true, status: "pending-independent-human-review" },
};
const passCase = (id, detail) => report.cases.push({ id, status: "pass", detail });
const wifiInitial = { value: "", known: false };
const dataInitial = { value: "", known: false };
let appFirewallUid = "";

try {
  assert.equal(adbText("get-state"), "device");
  report.device = {
    serial,
    model: adbText("shell", "getprop", "ro.product.model"),
    manufacturer: adbText("shell", "getprop", "ro.product.manufacturer"),
    android: adbText("shell", "getprop", "ro.build.version.release"),
    apiLevel: Number(adbText("shell", "getprop", "ro.build.version.sdk")),
    abi: adbText("shell", "getprop", "ro.product.cpu.abi"),
    kernelQemu: adbText("shell", "getprop", "ro.kernel.qemu"),
    resolution: adbText("shell", "wm", "size").match(/Physical size:\s*([^\s]+)/)?.[1] || "",
    density: adbText("shell", "wm", "density").match(/Physical density:\s*([^\s]+)/)?.[1] || "",
    webViewProvider: safeAdbText("shell", "cmd", "webviewupdate", "getCurrentWebViewPackage"),
  };
  const detectedKind = report.device.kernelQemu === "1" || serial.startsWith("emulator-") ? "emulator" : "physical";
  assert.equal(detectedKind, profile.kind, `selected profile kind ${profile.kind} does not match detected ${detectedKind}`);
  if (profile.expectedApiLevel) assert.equal(report.device.apiLevel, profile.expectedApiLevel, "device API does not match profile");
  if (profile.expectedResolution) assert.equal(report.device.resolution, profile.expectedResolution, "device resolution does not match profile");

  const installText = adbText("install", "-r", "-t", apkPath);
  assert.ok(installText.includes("Success"), `APK install failed: ${installText}`);
  report.apk.installed = collectInstalledPackage();
  assert.equal(adbText("shell", "pm", "clear", packageName), "Success");
  adbText("logcat", "-c");
  safeAdbText("shell", "dumpsys", "gfxinfo", packageName, "reset");

  adbText("shell", "am", "force-stop", packageName);
  const coldStart = startActivity(true);
  await sleep(contract.settleMs.coldStart);
  const initial = await runtimeSummary();
  assertRuntime(initial, { state: contract.initialState, screen: contract.initialScreen, origin: "" });
  const expectedAspect = contract.referenceViewport.width / contract.referenceViewport.height;
  const actualAspect = initial.viewport.width / initial.viewport.height;
  assert.ok(Math.abs(expectedAspect - actualAspect) <= contract.referenceViewport.aspectTolerance, "viewport must match the configured reference aspect");
  screenshot("00_cold_start.png");
  uiTree("00_cold_start_ui.xml");
  passCase("cold_start", { timing: coldStart, runtime: initial });

  const coordinates = await actionCoordinates();
  adbText("shell", "input", "tap", String(coordinates.tapX), String(coordinates.tapY));
  await sleep(contract.settleMs.lifecycle);
  const afterAction = await runtimeSummary();
  assertRuntime(afterAction, { state: contract.playerAction.expectedState, screen: contract.playerAction.expectedScreen, origin: contract.playerAction.expectedOrigin }, ["saved"]);
  screenshot("01_player_action.png");
  passCase("player_action_and_save", { runtime: afterAction, coordinates });

  adbText("shell", "input", "keyevent", "3");
  await sleep(contract.settleMs.lifecycle);
  const warmStart = startActivity(true);
  await sleep(contract.settleMs.lifecycle);
  const foreground = await runtimeSummary();
  assertRuntime(foreground, { state: contract.playerAction.expectedState, screen: contract.playerAction.expectedScreen, origin: contract.playerAction.expectedOrigin }, ["saved", "restored"]);
  screenshot("02_background_foreground.png");
  passCase("background_foreground", { timing: warmStart, runtime: foreground });

  adbText("shell", "input", "keyevent", "26");
  await sleep(contract.settleMs.lifecycle);
  assert.ok(adbText("shell", "dumpsys", "power").includes("mWakefulness=Asleep"), "device must enter sleep state");
  adbText("shell", "input", "keyevent", "26");
  adbText("shell", "input", "keyevent", "82");
  await sleep(contract.settleMs.lifecycle);
  const unlocked = await runtimeSummary();
  assertRuntime(unlocked, { state: contract.playerAction.expectedState, screen: contract.playerAction.expectedScreen, origin: contract.playerAction.expectedOrigin }, ["saved", "restored"]);
  screenshot("03_lock_unlock.png");
  passCase("lock_unlock", unlocked);

  wifiInitial.value = safeAdbText("shell", "settings", "get", "global", "wifi_on");
  dataInitial.value = safeAdbText("shell", "settings", "get", "global", "mobile_data");
  wifiInitial.known = ["0", "1"].includes(wifiInitial.value);
  dataInitial.known = ["0", "1"].includes(dataInitial.value);
  if (profile.networkIsolationCapabilities.includes("app-firewall-root")) {
    const packageDump = adbText("shell", "dumpsys", "package", packageName);
    appFirewallUid = packageDump.match(/userId=(\d+)/)?.[1] || "";
    assert.ok(appFirewallUid, "package UID is required for application-scoped offline isolation");
    adbText("shell", "su", "0", "iptables", "-I", "OUTPUT", "-m", "owner", "--uid-owner", appFirewallUid, "-j", "REJECT");
    adbText("shell", "su", "0", "iptables", "-C", "OUTPUT", "-m", "owner", "--uid-owner", appFirewallUid, "-j", "REJECT");
  } else {
    if (profile.networkIsolationCapabilities.includes("wifi")) adbText("shell", "svc", "wifi", "disable");
    if (profile.networkIsolationCapabilities.includes("mobile-data")) adbText("shell", "svc", "data", "disable");
  }
  await sleep(contract.settleMs.offline);
  adbText("shell", "am", "force-stop", packageName);
  startActivity(true);
  await sleep(contract.settleMs.offline);
  const offline = await runtimeSummary();
  assertRuntime(offline, { state: contract.playerAction.expectedState, screen: contract.playerAction.expectedScreen, origin: contract.playerAction.expectedOrigin }, ["restored"]);
  screenshot("04_offline_restore.png");
  passCase("offline_force_stop_restore", {
    runtime: offline,
    isolatedTransports: profile.networkIsolationCapabilities,
    connectivityBefore: { wifi: wifiInitial.value, mobileData: dataInitial.value },
  });
  restoreNetworkIsolation();

  adbText("shell", "input", "keyevent", "4");
  await sleep(contract.settleMs.lifecycle);
  const backRelaunch = startActivity(true);
  await sleep(contract.settleMs.forceStop);
  const afterBack = await runtimeSummary();
  assertRuntime(afterBack, { state: contract.playerAction.expectedState, screen: contract.playerAction.expectedScreen, origin: contract.playerAction.expectedOrigin }, ["restored"]);
  screenshot("05_android_back_relaunch.png");
  passCase("android_back_relaunch", { timing: backRelaunch, runtime: afterBack });

  adbText("shell", "am", "force-stop", packageName);
  const forceRelaunch = startActivity(true);
  await sleep(contract.settleMs.forceStop);
  const final = await runtimeSummary();
  assertRuntime(final, { state: contract.playerAction.expectedState, screen: contract.playerAction.expectedScreen, origin: contract.playerAction.expectedOrigin }, ["restored"]);
  const focus = adbText("shell", "dumpsys", "window", "windows");
  assert.ok(focus.includes(`${packageName}/${identity.launcherClass}`), "application must own the final window focus");
  screenshot("06_force_stop_relaunch.png");
  uiTree("06_force_stop_relaunch_ui.xml");
  passCase("force_stop_relaunch", { timing: forceRelaunch, runtime: final });

  const memoryText = adbText("shell", "dumpsys", "meminfo", packageName);
  const gfxText = adbText("shell", "dumpsys", "gfxinfo", packageName);
  fs.writeFileSync(path.join(outputDir, "memory_info.txt"), `${memoryText}\n`);
  fs.writeFileSync(path.join(outputDir, "gfx_info.txt"), `${gfxText}\n`);
  const memory = parseMemoryInfo(memoryText);
  const frames = parseGfxInfo(gfxText);
  const selectedPerformanceBudget = contract.performanceBudgets[profile.performanceBudgetClass];
  const performanceAudit = evaluatePerformanceBudgets({ coldStart, warmStart, memory, frames }, selectedPerformanceBudget);
  report.performance = {
    status: performanceAudit.pass ? "pass" : "fail",
    budgetClass: profile.performanceBudgetClass,
    coldStart: { totalTimeMs: coldStart.totalTimeMs },
    warmStart: { totalTimeMs: warmStart.totalTimeMs },
    memory: { totalPssKb: memory.totalPssKb, javaHeapKb: memory.javaHeapKb, nativeHeapKb: memory.nativeHeapKb },
    frames: { totalFrames: frames.totalFrames, jankyFrames: frames.jankyFrames, jankyFramePercent: frames.jankyFramePercent, frameP95Ms: frames.frameP95Ms },
    budgetChecks: performanceAudit.checks,
  };
  if (!performanceAudit.pass) report.findings.push({ severity: "P0", type: "performance-budget-failed", checks: performanceAudit.checks.filter((check) => check.status === "fail") });

  const logcat = adbText("logcat", "-d", "-v", "time");
  fs.writeFileSync(path.join(outputDir, "device_logcat.txt"), `${logcat}\n`);
  const crashHits = contract.crashPatterns.filter((pattern) => logcat.includes(pattern));
  assert.deepEqual(crashHits, [], `device log contains crash patterns: ${crashHits.join(", ")}`);
  passCase("device_log", { crashHits: 0 });

  for (const file of fs.readdirSync(outputDir).sort()) {
    const absolute = path.join(outputDir, file);
    if (!fs.statSync(absolute).isFile()) continue;
    report.evidence.push({ file, bytes: fs.statSync(absolute).size, sha256: sha256File(absolute) });
  }
  report.qualification = profile.releaseEligible ? "physical-profile-automated-evidence" : "development-emulator-only";
  report.limitations = [
    "This is a debug APK, not a signed Release APK or AAB.",
    profile.kind === "emulator" ? "The selected environment is an emulator and does not satisfy physical-device coverage." : "Only one physical profile was executed; the complete matrix remains required.",
    "Audio latency and subjective audio quality require a physical-device manual session.",
    "Manual screenshot review is recorded separately and cannot be self-certified by this runner."
  ];
  report.status = report.findings.length ? "fail" : "automated-pass-manual-pending";
} catch (error) {
  report.findings.push({ severity: "P0", type: "device-acceptance-exception", message: error?.stack || error?.message || String(error) });
} finally {
  if (contract.offlinePolicy.restoreConnectivity) {
    restoreNetworkIsolation();
  }
  safeAdbText("shell", "input", "keyevent", "224");
  safeAdbText("shell", "input", "keyevent", "82");
  safeAdbText("forward", "--remove", "tcp:9222");
}

report.generatedAtEnd = new Date().toISOString();
report.releaseEligible = false;
fs.writeFileSync(path.join(outputDir, "device_acceptance_report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "automated-pass-manual-pending") process.exitCode = 1;
