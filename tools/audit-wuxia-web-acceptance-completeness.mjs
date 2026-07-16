import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "wuxia_web_acceptance_completeness_20260711");
const readJson = (filePath, fallback = null) => {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback; }
  catch (error) { return { parseError: error.message }; }
};
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = (filePath, rows, columns) => fs.writeFileSync(filePath, `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`, "utf8");

const flow = readJson(path.join(root, "config", "wuxia_first_session_flow.json"), {});
const screens = readJson(path.join(root, "config", "wuxia_first_session_screen_contract.json"), {});
const crawl = readJson(path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl", "summary.json"), {});
const preflightPath = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl", "fb01_interaction_runtime_preflight.csv");
const parseCsv = (filePath) => {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) { if (char === "\r" && next === "\n") index += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
};

const interactions = fs.existsSync(preflightPath) ? parseCsv(preflightPath) : [];
const mapped = interactions.filter((row) => row.scope === "fb01_room_mapped");
const browserCovered = mapped.filter((row) => ["real_browser_clicked", "real_browser_route_blocked"].includes(row.browserStatus));
const browserPending = mapped.filter((row) => !["real_browser_clicked", "real_browser_route_blocked"].includes(row.browserStatus));
const executorGaps = mapped.filter((row) => ["global_feedback_only", "no_configured_executor"].includes(row.executionShape));
const runtimeRejected = mapped.filter((row) => ["rejected", "hidden_by_config"].includes(row.runtimeStatus));
const productScreens = Object.entries(screens.screens || {}).map(([screenId, screen]) => ({
  screenId,
  mode: screen.mode || "",
  source: screen.policy?.sourceReference || screens.policy?.sourceReference || "",
  bodyTypes: (screen.body || []).map((block) => block.type || "").join(";"),
  primaryActionId: screen.primaryActionId || "",
  navActionCount: Object.keys(screen.navActions || {}).length,
  evidenceStatus: screenId === "UI_EarlyCombat" && !screen.body?.find((block) => block.type === "combatRuntime")?.autoResolve
    ? "FAIL: combat does not auto resolve"
    : "not_individually_browser_covered_or_requires_trace",
}));

const infrastructure = [];
const browserExecutionFailures = [];
const fullAuditProgress = readJson(path.join(root, "outputs", "wuxia_full_browser_audit_20260711", "progress.json"), null);
for (const row of fullAuditProgress?.completed || []) {
  if (row.stderrTail?.includes("Timed out waiting for Edge DevTools target")) infrastructure.push(row);
}
for (const batchId of fullAuditProgress?.running || []) {
  infrastructure.push({ batchId, reason: "audit process was interrupted while this concurrent batch was marked running" });
}
const crawlRunRoot = path.join(root, "outputs", "wuxia_fb01_browser_crawl_runs");
for (const entry of fs.existsSync(crawlRunRoot) ? fs.readdirSync(crawlRunRoot, { withFileTypes: true }) : []) {
  if (!entry.isDirectory()) continue;
  const batchResultPath = path.join(crawlRunRoot, entry.name, "batch_results.csv");
  if (!fs.existsSync(batchResultPath)) {
    infrastructure.push({ batchId: entry.name, reason: "interrupted batch has no persisted batch_results.csv" });
    continue;
  }
  const rows = parseCsv(batchResultPath);
  for (const row of rows.filter((row) => row.status === "failed_or_unreachable")) {
    const failure = String(row.failure || "");
    const infrastructureFailure = /Timed out waiting for Edge DevTools target|CDP timeout|Page\.navigate/i.test(failure);
    const failureRow = { ...row, batchId: row.batchId || entry.name, classification: infrastructureFailure ? "infrastructure_invalid" : "product_or_executor_failure" };
    browserExecutionFailures.push(failureRow);
    if (infrastructureFailure) infrastructure.push({ batchId: failureRow.batchId, reason: failure || "browser infrastructure failure" });
  }
}
const uniqueInfrastructure = [...new Map(infrastructure.map((row) => [row.batchId, row])).values()];
const productOrExecutorFailures = browserExecutionFailures.filter((row) => row.classification === "product_or_executor_failure");

const findings = [
  { severity: "blocker", area: "browser_coverage", message: `${browserPending.length} of ${mapped.length} visible FB01 actions have no real-browser acceptance evidence.`, evidence: "fb01_interaction_runtime_preflight.csv" },
  { severity: "blocker", area: "executors", message: `${executorGaps.length} visible actions are feedback-only or lack a configured executor.`, evidence: "executionShape" },
  { severity: "high", area: "runtime_conditions", message: `${runtimeRejected.length} mapped actions are currently rejected in runtime preflight and require evidence-backed condition/UI handling.`, evidence: "runtimeStatus" },
  { severity: productOrExecutorFailures.length ? "high" : "info", area: "browser_execution", message: productOrExecutorFailures.length ? `${productOrExecutorFailures.length} real DOM click attempts reached a product or executor failure; these are not covered or passed.` : "No persisted non-infrastructure browser execution failures.", evidence: "wuxia_fb01_browser_crawl_runs/*/batch_results.csv" },
  { severity: "high", area: "screen_coverage", message: `${productScreens.length} configured screens require individual real-browser state/screenshot coverage; a key-flow trace is not an exhaustive screen audit.`, evidence: "wuxia_first_session_screen_contract.json" },
  { severity: uniqueInfrastructure.length ? "high" : "info", area: "audit_infrastructure", message: uniqueInfrastructure.length ? `${uniqueInfrastructure.length} parallel batch results are invalid because Edge DevTools timed out under concurrent launch.` : "No invalid concurrent-browser results recorded.", evidence: "wuxia_full_browser_audit_20260711/progress.json" },
  { severity: "high", area: "combat_presentation", message: "Combat has a correct auto-resolution route, but its actors/background remain prototype placeholders and do not meet competitor visual parity.", evidence: "browser_acceptance_combat_layout_20260711/18_contract_combat_enter.png" },
];

fs.mkdirSync(outputDir, { recursive: true });
writeCsv(path.join(outputDir, "visible_interactions_not_browser_accepted.csv"), browserPending, [
  "interactionKey", "kind", "entityId", "entityName", "actionType", "actionLabel", "roomIds", "runtimeStatus", "runtimeReason", "executionShape", "branchResultTokens", "evidenceLevel", "sourceEvidence", "browserStatus",
]);
writeCsv(path.join(outputDir, "executor_gaps.csv"), executorGaps, [
  "interactionKey", "kind", "entityId", "entityName", "actionType", "actionLabel", "roomIds", "executionShape", "runtimeStatus", "runtimeReason", "branchResultTokens", "evidenceLevel",
]);
writeCsv(path.join(outputDir, "browser_execution_failures.csv"), browserExecutionFailures, [
  "batchId", "interactionKey", "roomId", "entityId", "kind", "actionType", "executionShape", "status", "classification", "failure", "screenshot", "summaryPath",
]);
writeCsv(path.join(outputDir, "screen_acceptance_inventory.csv"), productScreens, ["screenId", "mode", "bodyTypes", "primaryActionId", "navActionCount", "evidenceStatus", "source"]);
writeCsv(path.join(outputDir, "findings.csv"), findings, ["severity", "area", "message", "evidence"]);
const report = {
  generatedAt: new Date().toISOString(),
  policy: "No runtime simulation, static screenshot, or feedback-only action counts as web acceptance. Browser coverage requires visible DOM click, resulting state, feedback assertion, and capture.",
  counts: {
    configuredStates: (flow.states || []).length,
    configuredScreens: productScreens.length,
    configuredActions: (flow.actions || []).length,
    importedActions: interactions.length,
    visibleFb01Actions: mapped.length,
    browserCovered: browserCovered.length,
    browserPending: browserPending.length,
    executorGaps: executorGaps.length,
    runtimeRejected: runtimeRejected.length,
    persistedBrowserExecutionFailures: browserExecutionFailures.length,
    productOrExecutorBrowserFailures: productOrExecutorFailures.length,
    invalidConcurrentAuditBatches: uniqueInfrastructure.length,
  },
  findings,
};
fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outputDir, "web_acceptance_audit.md"), [
  "# Web Acceptance Completeness Audit",
  "",
  "## Rule",
  "",
  report.policy,
  "",
  "## Counts",
  "",
  ...Object.entries(report.counts).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Blocking Findings",
  "",
  ...findings.map((finding) => `- ${finding.severity.toUpperCase()} | ${finding.area}: ${finding.message}`),
  "",
  "## Required Closure",
  "",
  "1. Run browser actions through a single-session or port-isolated sequential harness; do not accept parallel DevTools timeout rows.",
  "2. For every visible action, either provide a config-bound executor and browser pass, or hide it until its Lua/config behavior is restored.",
  "3. Capture every configured screen at 540x960 and assert text, touch bounds, state transition, and safe-area layout.",
  "4. Keep combat visual parity as a separate product gate; auto-resolution alone is not visual completion.",
  "",
].join("\n"), "utf8");
console.log(JSON.stringify(report, null, 2));
if (browserPending.length || executorGaps.length || runtimeRejected.length) process.exitCode = 1;
