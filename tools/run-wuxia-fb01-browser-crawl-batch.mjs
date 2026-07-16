import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);
const argValue = (name, fallback = "") => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
};
const batchId = argValue("--batch-id", "");
const maxTargets = Number(argValue("--max-targets", "0"));
const portBase = Number(argValue("--port-base", "9400"));
if (!batchId) throw new Error("--batch-id is required. Generate batches first with wuxia:plan:fb01-browser-crawl.");

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = (filePath, rows, columns) => fs.writeFileSync(
  filePath,
  `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`,
  "utf8",
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const safeName = (value) => String(value).replace(/[^a-zA-Z0-9_-]+/g, "_");

const batchPath = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl_batches", "fb01_browser_crawl_batches.csv");
const targetPath = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl_batches", "fb01_browser_crawl_targets.csv");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const runnerPath = path.join(root, "tools", "run-wuxia-real-browser-flow.mjs");
const outputDir = path.join(root, "outputs", "wuxia_fb01_browser_crawl_runs", batchId);
const batches = parseCsv(batchPath);
const batch = batches.find((row) => row.batchId === batchId);
if (!batch) throw new Error(`Unknown batch ${batchId}.`);
const selectedKeys = new Set(batch.targetKeys.split(";").filter(Boolean));
let targets = parseCsv(targetPath).filter((row) => selectedKeys.has(row.interactionKey));
if (maxTargets > 0) targets = targets.slice(0, maxTargets);
if (!targets.length) throw new Error(`Batch ${batchId} has no targets.`);

const flow = readJson(flowPath);
const mapState = (flow.states || []).find((state) => state.screenId === "UI_MapExplore")?.stateId || "STATE_FS_008_MAP_EXPLORE";
const actionMap = new Map((flow.actions || []).map((action) => [action.actionId, action]));
const expectedStateFor = (target) => {
  const policy = flow.chapterSystem?.combatActionPolicies?.[target.actionType];
  return policy?.startActionId ? (actionMap.get(policy.startActionId)?.toState || mapState) : mapState;
};

fs.mkdirSync(outputDir, { recursive: true });
const results = [];
for (let index = 0; index < targets.length; index += 1) {
  const target = targets[index];
  const runDir = path.join(outputDir, `${String(index + 1).padStart(3, "0")}_${safeName(target.interactionKey)}`);
  const expectedState = expectedStateFor(target);
  const port = portBase + index;
  const child = spawnSync(process.execPath, [
    runnerPath,
    "--scenario", "entity-actions",
    "--room-id", target.roomIds.split(";")[0],
    "--entity-id", target.entityId,
    "--entity-kind", target.kind,
    "--interaction-actions", target.actionType,
    "--expected-state", expectedState,
    "--route-room-ids", target.routeRoomIds.split(";").filter(Boolean).join(","),
    "--out-dir", runDir,
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, EDGE_DEBUG_PORT: String(port) },
  });
  const summaryPath = path.join(runDir, "real_browser_flow_summary.json");
  let summary = null;
  let parseError = "";
  try {
    summary = fs.existsSync(summaryPath) ? readJson(summaryPath) : null;
  } catch (error) {
    parseError = error.message;
  }
  const actionLabel = `crawl_${target.kind}_${target.entityId}_${target.actionType}`.replace(/[^a-zA-Z0-9_]+/g, "_");
  const actionResult = (summary?.results || []).find((result) => result.label === actionLabel) || null;
  const selectionResult = (summary?.results || []).find((result) => result.label === "crawl_entity_selected") || null;
  const beforeFeedback = (selectionResult?.logTexts || []).join("\n").trim();
  const afterFeedback = (actionResult?.logTexts || []).join("\n").trim();
  const feedbackChanged = Boolean(afterFeedback) && afterFeedback !== beforeFeedback;
  const requiresFeedbackChange = target.executionShape !== "configured_combat_policy";
  const routeBlock = (summary?.results || []).find((result) => (
    String(result.label || "").startsWith("crawl_route_")
    && /expected room .+, got /i.test(String(result.error || ""))
  )) || null;
  const passed = child.status === 0
    && actionResult?.click?.clicked === true
    && actionResult?.state === expectedState
    && !actionResult?.error
    && (!requiresFeedbackChange || feedbackChanged);
  const blocked = !passed && Boolean(target.routeGateEvidence) && Boolean(routeBlock);
  results.push({
    batchId,
    interactionKey: target.interactionKey,
    roomId: target.roomIds.split(";")[0],
    entityId: target.entityId,
    kind: target.kind,
    actionType: target.actionType,
    executionShape: target.executionShape,
    expectedState,
    routeRoomIds: target.routeRoomIds || "",
    routeGateEvidence: target.routeGateEvidence || "",
    status: passed ? "passed_real_dom_click" : (blocked ? "blocked_by_configured_route_gate" : "failed_or_unreachable"),
    processExitCode: child.status ?? "",
    actionClicked: actionResult?.click?.clicked === true ? "true" : "false",
    feedbackChanged: feedbackChanged ? "true" : "false",
    actualState: actionResult?.state || "",
    failure: routeBlock?.error || actionResult?.error || ((requiresFeedbackChange && !feedbackChanged) ? "action click did not produce new visible feedback" : "") || summary?.runError?.message || parseError || child.error?.message || "",
    screenshot: actionResult?.screenshot || routeBlock?.screenshot || "",
    summaryPath: path.relative(root, summaryPath).replaceAll("\\", "/"),
    stdoutTail: String(child.stdout || "").trim().slice(-500),
  });
}

const columns = ["batchId", "interactionKey", "roomId", "entityId", "kind", "actionType", "executionShape", "expectedState", "routeRoomIds", "routeGateEvidence", "status", "processExitCode", "actionClicked", "feedbackChanged", "actualState", "failure", "screenshot", "summaryPath", "stdoutTail"];
writeCsv(path.join(outputDir, "batch_results.csv"), results, columns);
const summary = {
  generatedAt: new Date().toISOString(),
  batchId,
  batchPriority: batch.priority,
  total: results.length,
  passed: results.filter((row) => row.status === "passed_real_dom_click").length,
  blocked: results.filter((row) => row.status === "blocked_by_configured_route_gate").length,
  failed: results.filter((row) => row.status === "failed_or_unreachable").length,
  outputDir: path.relative(root, outputDir).replaceAll("\\", "/"),
};
fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (summary.failed) process.exitCode = 1;
