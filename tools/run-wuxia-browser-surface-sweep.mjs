import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeRelative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

const registry = readJson("config/production/ui_experience_registry.json");
const screenContract = readJson("config/wuxia_first_session_screen_contract.json");
const flow = readJson("config/wuxia_first_session_flow.json");
const modalProbe = readJson("config/wuxia_browser_modal_probe.json");
const runId = argValue("--run-id", new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14));
const outDir = path.resolve(root, argValue("--out-dir", path.join("outputs", "wuxia_visual_matrix", runId)));
const dryRun = args.includes("--dry-run");
const basePort = Number(argValue("--base-port", "9320"));
const runner = path.join(root, "tools", "run-wuxia-real-browser-flow.mjs");
const modalRunner = path.join(root, "tools", "audit-wuxia-choice-result-browser.mjs");

if (!Number.isInteger(basePort) || basePort <= 0) throw new Error("--base-port must be a positive integer.");
if (!Array.isArray(registry.screens) || !Array.isArray(registry.viewports)) throw new Error("UI registry must define screens and viewports.");

const contractScreenIds = new Set(Object.keys(screenContract.screens || {}));
const registryErrors = [];
for (const screen of registry.screens) {
  if (!screen.id || !contractScreenIds.has(screen.id)) registryErrors.push(`screen_missing_from_contract:${screen.id || "empty"}`);
}
if (registry.acceptancePolicy?.requireConsoleErrorCount !== 0 || registry.acceptancePolicy?.requireConsoleWarningCount !== 0) {
  registryErrors.push("registry_must_require_zero_console_errors_and_warnings");
}
if (registryErrors.length) throw new Error(`UI registry contract invalid: ${registryErrors.join(", ")}`);

const requestedViewportIds = argValue("--viewport-ids", "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = registry.viewports.filter((viewport) => !requestedViewportIds.length || requestedViewportIds.includes(viewport.id));
if (!viewports.length) throw new Error("No configured viewport matches --viewport-ids.");

const activeScreens = registry.screens.filter((screen) => (screen.acceptanceStatus || "active") === "active");
const postponedScreens = registry.screens.filter((screen) => screen.acceptanceStatus === "postponed");
const matrix = registry.screens.flatMap((screen) => viewports.map((viewport) => ({
  caseId: `${screen.id}__${viewport.id}`,
  screenId: screen.id,
  viewportId: viewport.id,
  width: viewport.width,
  height: viewport.height,
  acceptanceStatus: screen.acceptanceStatus || "active",
  requiredEvidence: ["screenshot", "dom-state", "computed-style", "overflow", "console", "interaction-before-after"],
})));

function configuredEntryActionIds() {
  const ids = [];
  const order = ["UI_OpeningStory", "UI_OpeningOriginResult", "UI_TitleStart", "UI_CharacterStatus", "UI_IdleConfirm", "UI_IdleTaskList", "UI_ChapterCardEntry", "UI_MapExplore"];
  function collectActionIds(value) {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(collectActionIds);
    const own = Object.entries(value)
      .filter(([key, candidate]) => /actionId$/i.test(key) && typeof candidate === "string" && candidate)
      .map(([, candidate]) => candidate);
    return [...own, ...Object.values(value).flatMap(collectActionIds)];
  }
  for (const screenId of order) {
    const screen = screenContract.screens?.[screenId];
    if (!screen) continue;
    const actionId = collectActionIds(screen)[0];
    if (actionId) ids.push(actionId);
  }
  return ids;
}

const plan = {
  schema: "idlewuxia.browser_surface_sweep_plan.v1",
  authority: "config/production/ui_experience_registry.json",
  registryHash: sha256(registry),
  screenContractHash: sha256(screenContract),
  flowHash: sha256(flow),
  configuredEntryActionIds: configuredEntryActionIds(),
  configuredModalProbe: modalProbe,
  summary: {
    registryScreens: registry.screens.length,
    activeScreens: activeScreens.length,
    postponedScreens: postponedScreens.length,
    configuredViewports: registry.viewports.length,
    selectedViewports: viewports.length,
    matrixCases: matrix.length,
    activeCases: matrix.filter((entry) => entry.acceptanceStatus === "active").length,
    postponedCases: matrix.filter((entry) => entry.acceptanceStatus === "postponed").length,
  },
  matrix,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sweep_plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");

if (dryRun) {
  const report = {
    schema: "idlewuxia.browser_surface_sweep.v1",
    generatedAt: new Date().toISOString(),
    status: "pass",
    mode: "dry-run",
    outDir: safeRelative(outDir),
    plan,
    blockers: [],
    coverageGaps: activeScreens.flatMap((screen) => viewports.map((viewport) => ({
      caseId: `${screen.id}__${viewport.id}`,
      reason: "browser_not_executed_in_dry_run",
    }))),
    acceptance: {
      runnerConsumesRegistry: true,
      failureEvidence: "screenshot + DOM + state + console + viewport",
      deterministicRoute: "baseline configured first-session route",
      postponedScreensExcludedFromBlockers: postponedScreens.map((screen) => screen.id),
    },
  };
  fs.writeFileSync(path.join(outDir, "browser_surface_sweep_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: report.status, mode: report.mode, summary: plan.summary, outDir: report.outDir }, null, 2));
  process.exit(0);
}

const blockers = [];
const viewportRuns = [];
const observedScreens = new Set();

for (const [index, viewport] of viewports.entries()) {
  const viewportOut = path.join(outDir, viewport.id);
  fs.mkdirSync(viewportOut, { recursive: true });
  const execution = spawnSync(process.execPath, [
    runner,
    "--scenario", "baseline",
    "--viewport-width", String(viewport.width),
    "--viewport-height", String(viewport.height),
    "--out-dir", safeRelative(viewportOut),
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, WUXIA_CAPTURE_DOM: "1", EDGE_DEBUG_PORT: String(basePort + index) },
  });
  const summaryPath = path.join(viewportOut, "real_browser_flow_summary.json");
  let summary = null;
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  } catch (error) {
    blockers.push({ type: "missing_flow_summary", viewportId: viewport.id, message: error.message });
  }
  if (execution.status !== 0) blockers.push({ type: "flow_process_failed", viewportId: viewport.id, exitCode: execution.status, stderr: String(execution.stderr || "").slice(-2000) });
  for (const entry of summary?.results || []) {
    if (entry.screen) observedScreens.add(entry.screen);
    const screenshotExists = entry.screenshot && fs.existsSync(path.join(root, entry.screenshot));
    const hasDom = Boolean(entry.domSnapshot?.html && entry.domSnapshot?.state && entry.domSnapshot?.screen);
    const hasViewport = entry.viewport?.innerWidth === viewport.width && entry.viewport?.innerHeight === viewport.height;
    if (!screenshotExists) blockers.push({ type: "missing_screenshot_evidence", viewportId: viewport.id, label: entry.label });
    if (!hasDom) blockers.push({ type: "missing_dom_evidence", viewportId: viewport.id, label: entry.label });
    if (!hasViewport) blockers.push({ type: "viewport_observation_mismatch", viewportId: viewport.id, label: entry.label, observed: entry.viewport });
  }
  for (const failure of summary?.failures || []) blockers.push({ type: "flow_failure", viewportId: viewport.id, failure });
  for (const problem of summary?.pageConsoleProblems || []) blockers.push({ type: "console_problem", viewportId: viewport.id, problem });
  viewportRuns.push({
    viewportId: viewport.id,
    width: viewport.width,
    height: viewport.height,
    exitCode: execution.status ?? -1,
    steps: summary?.steps || 0,
    failures: summary?.failures || [],
    pageConsoleProblems: summary?.pageConsoleProblems || [],
    observedScreens: [...new Set((summary?.results || []).map((entry) => entry.screen).filter(Boolean))],
    summaryPath: safeRelative(summaryPath),
    stdoutTail: String(execution.stdout || "").trim().slice(-1000),
    stderrTail: String(execution.stderr || "").trim().slice(-1000),
  });
}

const coverageGaps = activeScreens.flatMap((screen) => viewports
  .filter(() => !observedScreens.has(screen.id))
  .map((viewport) => ({ caseId: `${screen.id}__${viewport.id}`, screenId: screen.id, viewportId: viewport.id, reason: "screen_not_observed_by_baseline_route" })));

const modalOutDir = path.join(outDir, "modal");
fs.mkdirSync(modalOutDir, { recursive: true });
const modalViewports = viewports.map((viewport) => `${viewport.width}x${viewport.height}`).join(",");
const modalExecution = spawnSync(process.execPath, [
  modalRunner,
  `--out-dir=${safeRelative(modalOutDir)}`,
  `--viewport-ids=${modalViewports}`,
], { cwd: root, encoding: "utf8", env: { ...process.env } });
const modalReportPath = path.join(modalOutDir, "browser_acceptance.json");
let modalReport = null;
try { modalReport = JSON.parse(fs.readFileSync(modalReportPath, "utf8")); }
catch (error) { blockers.push({ type: "missing_modal_report", message: error.message }); }
if (modalExecution.status !== 0) blockers.push({ type: "modal_process_failed", exitCode: modalExecution.status, stderr: String(modalExecution.stderr || "").slice(-2000) });
for (const modalCase of modalReport?.cases || []) {
  if (modalCase.status !== "pass" || (modalCase.consoleErrors || []).length) blockers.push({ type: "modal_case_failed", viewport: modalCase.viewport, case: modalCase });
}

const report = {
  schema: "idlewuxia.browser_surface_sweep.v1",
  generatedAt: new Date().toISOString(),
  status: blockers.length ? "fail" : "pass",
  mode: "real-browser",
  outDir: safeRelative(outDir),
  plan,
  viewportRuns,
  modal: {
    exitCode: modalExecution.status ?? -1,
    cases: modalReport?.cases?.length || 0,
    reportPath: safeRelative(modalReportPath),
    summary: modalReport ? { status: modalReport.status, cases: modalReport.cases.length } : null,
  },
  observedScreens: [...observedScreens],
  coverageGaps,
  blockers,
  acceptance: {
    runnerConsumesRegistry: true,
    failureEvidence: "screenshot + DOM + state + console + viewport",
    deterministicRoute: "baseline configured first-session route",
    postponedScreensExcludedFromBlockers: postponedScreens.map((screen) => screen.id),
  },
};
fs.writeFileSync(path.join(outDir, "browser_surface_sweep_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "browser_surface_sweep_report.md"), [
  "# Wuxia Browser Surface and Modal Sweep",
  "",
  `- status: ${report.status}`,
  `- registry screens: ${plan.summary.registryScreens}`,
  `- active screens: ${plan.summary.activeScreens}`,
  `- selected viewports: ${plan.summary.selectedViewports}`,
  `- matrix cases planned: ${plan.summary.matrixCases}`,
  `- observed screens: ${report.observedScreens.length}`,
  `- coverage gaps: ${report.coverageGaps.length}`,
  `- modal cases: ${report.modal.cases}`,
  `- blockers: ${report.blockers.length}`,
  "",
  "Coverage gaps are reported for T05-01; they are not silently treated as passed evidence.",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({
  status: report.status,
  outDir: report.outDir,
  summary: plan.summary,
  observedScreens: report.observedScreens.length,
  coverageGaps: report.coverageGaps.length,
  modalCases: report.modal.cases,
  blockers: report.blockers.length,
}, null, 2));
if (blockers.length) process.exitCode = 1;
