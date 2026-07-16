import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "skill_waterfall_stage_tasks_20260708");
const strict = process.argv.includes("--strict");

const readJson = (relativePath, fallback = null) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const writeCsv = (filePath, rows, columns) => {
  const body = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
  fs.writeFileSync(filePath, `${body}\n`, "utf8");
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const countBy = (rows, key) =>
  rows.reduce((acc, row) => {
    const value = row[key] || "";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

const lineCount = (relativePath) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return 0;
  return fs.readFileSync(fullPath, "utf8").split(/\r?\n/).length;
};

const containsAny = (text, tokens) => tokens.filter((token) => text.includes(token));

const stage = readJson("outputs/skill_waterfall_stage_audit_20260706/summary.json", {});
const resultTokens = readJson("outputs/wuxia_fb01_result_token_runtime_coverage/summary.json", {});
const flowParity = readJson("outputs/wuxia_fzjh_flow_parity_audit/summary.json", {});
const p2Closure = readJson("outputs/wuxia_p2_closure_gate/summary.json", {});
const interactions = readJson("outputs/wuxia_fb01_interaction_coverage/summary.json", {});
const browserInteractionCrawl = readJson("outputs/wuxia_fb01_browser_interaction_crawl/summary.json", {});
const contentBoundary = readJson("outputs/wuxia_content_data_driven_boundary/summary.json", {});
const findLatestRealBrowserSummaryPaths = () => {
  const outputsDir = path.join(root, "outputs");
  if (!fs.existsSync(outputsDir)) return [];
  const candidates = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("skill_waterfall_acceptance_"))
    .map((entry) => {
      const summaryPath = path.join("outputs", entry.name, "real_browser_flow_summary.json");
      const fullPath = path.join(root, summaryPath);
      if (!fs.existsSync(fullPath)) return null;
      const stats = fs.statSync(fullPath);
      const summary = readJson(summaryPath, null);
      if (!summary?.scenario) return null;
      return summary ? { summaryPath, summary, mtimeMs: stats.mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latestByScenario = new Map();
  for (const candidate of candidates) {
    const scenario = candidate.summary.scenario || "unknown";
    if (!latestByScenario.has(scenario)) latestByScenario.set(scenario, candidate);
  }
  return [...latestByScenario.values()].map((entry) => entry.summaryPath);
};
const realBrowserSummaryPaths = findLatestRealBrowserSummaryPaths();
const realBrowserSummaries = realBrowserSummaryPaths
  .map((summaryPath) => ({ summaryPath, summary: readJson(summaryPath, null) }))
  .filter((entry) => entry.summary);
const realBrowserUsableSummaries = realBrowserSummaries.filter((entry) => !entry.summary.runError);
const realBrowserRunErrorSummary = realBrowserSummaries
  .filter((entry) => entry.summary.runError)
  .map((entry) => `${entry.summary.scenario || "unknown"}:${entry.summary.runError?.message || "run_error"}`)
  .join(" | ");
const realBrowser =
  realBrowserUsableSummaries.find((entry) => entry.summary.scenario === "chapter1-deep")?.summary
  || realBrowserUsableSummaries[0]?.summary
  || {};
const flow = readJson("config/wuxia_first_session_flow.json", {});
const screenContract = readJson("config/wuxia_first_session_screen_contract.json", {});

const realResults = realBrowserUsableSummaries.flatMap((entry) =>
  Array.isArray(entry.summary.results)
    ? entry.summary.results.map((result) => ({ ...result, summaryPath: entry.summaryPath, scenario: entry.summary.scenario || "" }))
    : []
);
const seenScreens = new Map();
for (const result of realResults) {
  if (!result.screen) continue;
  if (!seenScreens.has(result.screen)) {
    seenScreens.set(result.screen, { count: 0, firstScreenshot: result.screenshot || "" });
  }
  seenScreens.get(result.screen).count += 1;
}

const realBadMatches = realResults.reduce((sum, result) => sum + (Array.isArray(result.badMatches) ? result.badMatches.length : 0), 0);
const realAutomationDispatches = realResults.filter((result) => result.click?.automation).length;
const realFailures = realBrowserUsableSummaries.reduce((sum, entry) => sum + (Array.isArray(entry.summary.failures) ? entry.summary.failures.length : 0), 0);
const realBrowserStepsTotal = realBrowserUsableSummaries.reduce((sum, entry) => sum + Number(entry.summary.steps || 0), 0);
const realBrowserScenarioSummary = realBrowserUsableSummaries
  .map((entry) => `${entry.summary.scenario || "unknown"}:${entry.summary.steps || 0}`)
  .join(" | ");
const chapterEndEvidence = realResults.some((result) => {
  const signal = [result.label, result.state, result.screen].filter(Boolean).join(" ");
  return /(chapter[_ -]?(complete|clear)|fb01[_ -]?(complete|clear)|STATE_.*(COMPLETE|CLEAR))/i.test(signal);
});

const activeFiles = ["index.html", "src/wuxia-main.js", "src/wuxiaFirstSessionFlow.js", "src/styles.css"];
const forbiddenLegacyTokens = [
  "GALAXY",
  "Void",
  "tesla",
  "Welcome Back",
  "Offline Cap",
  "Ally_01",
  "Enemy_01",
  "华山",
];
const codeRows = activeFiles.map((relativePath) => {
  const fullPath = path.join(root, relativePath);
  const text = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
  const hits = containsAny(text, forbiddenLegacyTokens);
  return {
    file: relativePath,
    lines: lineCount(relativePath),
    status: fs.existsSync(fullPath) ? (hits.length ? "needs_review" : "scanned") : "missing",
    forbiddenHits: hits.join(" | "),
    acceptance: hits.length ? "Remove legacy/template or unconfigured branch strings from active runtime." : "No obvious legacy smoke tokens in active file.",
  };
});

const screenRows = Object.entries(screenContract.screens || {}).map(([screenId, screen]) => {
  const seen = seenScreens.get(screenId);
  const hasAction =
    Boolean(screen.primaryActionId) ||
    Boolean(screen.secondaryActionId) ||
    Boolean(screen.navActions && Object.keys(screen.navActions).length) ||
    JSON.stringify(screen.body || []).includes("actionId");
  const status = seen ? "browser_seen" : screenId === "UI_EarlyCombat" ? "not_reached_by_deep_path" : "not_seen";
  return {
    screenId,
    mode: screen.mode || "",
    title: screen.title || "",
    hasAction: hasAction ? "yes" : "no",
    browserSeenCount: seen?.count || 0,
    evidenceScreenshot: seen?.firstScreenshot || "",
    status,
    nextAction:
      status === "browser_seen"
        ? "Keep in real-browser regression and add pixel/readability comparison when reference crop exists."
        : "Add a real-browser scenario step or route that reaches this screen, then capture screenshot evidence.",
  };
});

const interactionStatusRows = Object.entries(interactions.byStatus || {}).map(([status, count]) => ({
  status,
  count,
  risk: /token_only|fallback/i.test(status) ? "needs_followup" : "covered",
  nextAction: /token_only|fallback/i.test(status)
    ? "Resolve remaining branch text from Lua/config or add reverse-test evidence before calling it product-complete."
    : "Keep covered by interaction audit.",
}));

const assetRows = [
  {
    assetGroup: "activeEntryReferences",
    count: stage.assets?.referencedByActiveEntry || 0,
    status: (stage.assets?.missingReferences || 0) === 0 ? "covered" : "missing",
    nextAction: "Active entry references must remain zero-404 in browser and build audits.",
  },
  {
    assetGroup: "generatedUiFiles",
    count: stage.assets?.generatedUiFiles || 0,
    status: (stage.assets?.generatedUiFiles || 0) > 0 ? "prototype_assets_present" : "missing",
    nextAction: "Replace rough generated placeholders with owned Wuxia UI kit assets after screen-by-screen parity is locked.",
  },
  {
    assetGroup: "competitorReferenceFiles",
    count: stage.assets?.competitorReferenceFiles || 0,
    status: (stage.assets?.competitorReferenceFiles || 0) > 0 ? "reference_only" : "none",
    nextAction: "Use only as internal reference evidence; do not ship competitor-owned files.",
  },
  {
    assetGroup: "originalGameFiles",
    count: stage.assets?.originalGameFiles || 0,
    status: (stage.assets?.originalGameFiles || 0) === 0 ? "clean" : "archive_required",
    nextAction: "Archive or isolate old template assets if they reappear in active product public tree.",
  },
];

const tasks = [];
const addTask = (task) => tasks.push(task);

addTask({
  id: "P0_CONTENT_DATA_DRIVEN_BOUNDARY",
  lane: "architecture",
  skill: "wuxia-system-design + codebase-design + wuxia-project-automation",
  severity: "P0",
  status: contentBoundary.passStrict === true ? "done" : "open",
  evidence: `high=${contentBoundary.counts?.high ?? "not_run"}; medium=${contentBoundary.counts?.medium ?? "not_run"}; activeFiles=${(contentBoundary.activeFiles || []).join(" | ")}`,
  gap: "All chapters, map nodes, NPCs, enemies, story text, gates, and rewards must be config-driven; runtime code must remain a generic interpreter.",
  action: "Move any high-risk concrete content row from active runtime into config/wuxia_first_session_flow.json or another data contract, then rerun content-boundary audit.",
  acceptance: "outputs/wuxia_content_data_driven_boundary/summary.json reports passStrict=true and content_hardcode_findings.csv has no high rows.",
});

addTask({
  id: "DONE_RUNTIME_RESULT_TOKEN_P2_CLOSURE",
  lane: "system_runtime",
  skill: "wuxia-system-design + wuxia-game-planning",
  severity: "P3",
  status: Number(p2Closure.totalP2Rows || 0) === 0 ? "done" : "open",
  evidence: `resultTokenP2=${p2Closure.resultTokenP2Rows ?? "unknown"} flowParityP2=${p2Closure.flowParityP2Rows ?? "unknown"}`,
  gap: "fb01 result token and flow parity P2 closure gate.",
  action: "Keep this gate in every fast check before changing chapter data.",
  acceptance: "P2 closure summary reports totalP2Rows=0.",
});

addTask({
  id: "DONE_FB01_INTERACTION_SEMANTIC_COVERAGE",
  lane: "interaction",
  skill: "wuxia-game-planning + wuxia-ux-ui-design",
  severity: "P3",
  status: Number(interactions.counts?.highRisk || 0) === 0 ? "done" : "open",
  evidence: `actions=${interactions.counts?.actions ?? "unknown"} highRisk=${interactions.counts?.highRisk ?? "unknown"}`,
  gap: "NPC/interactable semantic branches.",
  action: "Do not regress exact branch/global semantic coverage.",
  acceptance: "fb01 interaction coverage reports highRisk=0.",
});

addTask({
  id: "P1_REAL_BROWSER_FULL_INTERACTION_CRAWL",
  lane: "interaction_acceptance",
  skill: "wuxia-project-automation + wuxia-ux-ui-design + diagnosing-bugs",
  severity: "P1",
  status: Number(browserInteractionCrawl.counts?.browserPending || 0) === 0 && Number(browserInteractionCrawl.counts?.executorGaps || 0) === 0
    ? "done"
    : "ready_for_next",
  evidence: `allImported=${browserInteractionCrawl.counts?.allImportedActions ?? "not_run"}; fb01Mapped=${browserInteractionCrawl.counts?.fb01RoomMappedActions ?? "not_run"}; browserClicked=${browserInteractionCrawl.counts?.browserClicked ?? "not_run"}; browserPending=${browserInteractionCrawl.counts?.browserPending ?? "not_run"}; executorGaps=${browserInteractionCrawl.counts?.executorGaps ?? "not_run"}`,
  gap: "A runtime preflight is not a player-visible interaction acceptance. Every visible interaction needs either a real browser click record or a config-backed locked/unavailable reason.",
  action: "Use fb01_interaction_runtime_preflight.csv to build route batches by room/action type, run them with physical DOM clicks, and replace global_feedback_only handlers with configured executor modules where competitor evidence supports a real flow.",
  acceptance: "fb01 browser crawl summary reports browserPending=0 for currently visible/reachable scope, executorGaps=0 or each remaining action is explicitly hidden/unavailable by config with source evidence.",
});

addTask({
  id: "P0_CHAPTER1_TRUE_END_ROUTE",
  lane: "chapter_flow",
  skill: "wuxia-game-planning + wuxia-system-design + wuxia-project-automation",
  severity: "P0",
  status: chapterEndEvidence ? "done" : "open",
  evidence: `realBrowserSteps=${realBrowserStepsTotal}; scenarios=${realBrowserScenarioSummary}; chapterEndEvidence=${chapterEndEvidence}`,
  gap: chapterEndEvidence
    ? "Startup-to-fb01 chapter clear route is now proven by real-browser evidence."
    : "Current real-browser deep scenario proves startup-to-fb01 exploration, but does not prove a true first-chapter completion/end reward route.",
  action: chapterEndEvidence
    ? "Keep chapter clear policy, reward sync, and real-browser chapter_clear_fb01 step in regression."
    : "Trace fb01 completion conditions from mapConditionAndResult/fb01 and add a data-driven browser scenario that reaches chapter clear/end state.",
  acceptance: "Real browser summary contains a chapter complete/clear/end state, reward/result rows execute, and screenshots prove the final chapter-end UI.",
});

addTask({
  id: "P1_REAL_BROWSER_ALL_KEY_SCREENS",
  lane: "browser_acceptance",
  skill: "wuxia-project-automation + wuxia-ux-ui-design",
  severity: "P1",
  status: screenRows.every((row) => row.status === "browser_seen") ? "done" : "open",
  evidence: `seenScreens=${seenScreens.size}/${screenRows.length}; scenarios=${realBrowserScenarioSummary || "none"}; runErrors=${realBrowserRunErrorSummary || "none"}; failures=${realFailures}; badMatches=${realBadMatches}`,
  gap: "The deep browser path is green, but not every configured screen is reached in the same acceptance scenario.",
  action: "Add targeted browser scenarios for each unvisited screen, especially combat/NPC modal variants.",
  acceptance: "screen_acceptance_matrix.csv has no not_seen/not_reached_by_deep_path rows.",
});

addTask({
  id: "P1_PLAYER_VISIBLE_KEY_SCREEN_ENTRY",
  lane: "browser_acceptance",
  skill: "wuxia-project-automation + wuxia-system-design + wuxia-ux-ui-design",
  severity: "P1",
  status: realAutomationDispatches === 0 ? "done" : "open",
  evidence: `automationDispatches=${realAutomationDispatches}; scenarios=${realBrowserScenarioSummary || "none"}`,
  gap: "Some configured key state screens are currently reached by automation dispatch instead of a player-visible, config-driven UI control.",
  action: "Unify the fb01 room-chain interactions with the high-level screen state machine so combat/NPC/loop transitions are triggered by visible configured controls or documented room/NPC actions.",
  acceptance: "Every key screen transition in real_browser_flow_summary.json has click.automation=false and a visible button/room/NPC selector source.",
});

addTask({
  id: "P1_PRODUCT_UI_PARITY_MATRIX",
  lane: "ui_ux",
  skill: "wuxia-ux-ui-design + wuxia-packaging-design",
  severity: "P1",
  status: "open",
  evidence: `screens=${screenRows.length}; currentAuditIssues=${stage.issues?.total ?? "unknown"}`,
  gap: "Current audit proves screen mapping and absence of debug tokens, not competitor-level visual parity or product-grade layout.",
  action: "For each first-session screen, attach competitor source screen/code/config evidence, target layout spec, and 540x960 browser screenshot comparison.",
  acceptance: "Every first-session screen has a parity row with source evidence, target screenshot, actual screenshot, and no readability/layout blocker.",
});

addTask({
  id: "P1_ART_ASSET_OWNERSHIP_AND_STYLE",
  lane: "art_assets",
  skill: "wuxia-art-direction + wuxia-packaging-design",
  severity: "P1",
  status: "open",
  evidence: `generatedUiFiles=${stage.assets?.generatedUiFiles ?? 0}; competitorReferenceFiles=${stage.assets?.competitorReferenceFiles ?? 0}`,
  gap: "Competitor files are reference-only and generated placeholder UI is not a shippable owned art kit.",
  action: "Create owned 9:16 Wuxia UI kit and background/silhouette asset plan; mark every reference-only asset as non-shippable.",
  acceptance: "asset_acceptance_matrix.csv has product-owned replacement target for every player-facing reference/placeholder asset.",
});

addTask({
  id: "P1_COMBAT_PRESENTATION_PRODUCT_PASS",
  lane: "combat_presentation",
  skill: "wuxia-combat-presentation + wuxia-art-direction + wuxia-ux-ui-design",
  severity: "P1",
  status: "open",
  evidence: `combatPolicy=${Object.keys(flow.chapterSystem?.combatActionPolicies || {}).join("|") || "missing"}; preview=${flow.defaultCombatPreviewId || "missing"}`,
  gap: "Combat ordering is now correct, but the web battle remains a fixed preview without product-grade unit-bound effects, outcome variants, Buff presentation, hit rhythm, or owned art.",
  action: "Drive unit state, Buffs, floating feedback, timing, success/failure/runaway result, and visual/audio cues from combat data and owned assets.",
  acceptance: "A real 540x960 run shows readable unit-bound HP/MP/Buff/effects and explicit success, failure, and runaway outcomes without relying on debug logs.",
});

addTask({
  id: "P2_SERVER_LOGIN_SYNC_PURCHASE_CONTRACT",
  lane: "server_client",
  skill: "wuxia-system-design",
  severity: "P2",
  status: "open",
  evidence: "User policy: server does login/sync and purchase validation.",
  gap: "Prototype currently focuses on local config-driven runtime; server command/receipt validation is not yet a runnable contract.",
  action: "Define login/checkpoint/reward/purchase validation request-response JSON and client offline fallback policy.",
  acceptance: "A mocked server contract validates login/session sync and rejects forged purchase/reward claims.",
});

addTask({
  id: "P2_CONFIG_SCHEMA_VERSIONING",
  lane: "configuration",
  skill: "wuxia-system-design + data-configuration-engineer + codebase-design",
  severity: "P2",
  status: "open",
  evidence: `flowBytes=${fs.statSync(path.join(root, "config", "wuxia_first_session_flow.json")).size}; schema=${flow.schema || "missing"}`,
  gap: "The first-session contract is valid but monolithic; chapter, screen, policy, and shared lookup packages need versioned loading and cross-file reference validation.",
  action: "Introduce ContentRepository loading for versioned flow, chapter, screen, combat-policy, and result/condition packages without changing player-visible behavior.",
  acceptance: "Split packages validate references, migrate deterministically, and run the same first-session/browser regressions with zero concrete content IDs added to active runtime.",
});

addTask({
  id: "P2_OUTPUT_CACHE_HYGIENE",
  lane: "automation",
  skill: "wuxia-project-automation",
  severity: "P2",
  status: "open",
  evidence: "Older browser acceptance output dirs include Edge profile/cache trees.",
  gap: "Historical outputs contain browser profile caches that bloat the project and make broad file scans noisy.",
  action: "Add a safe cleanup script that removes only known browser-profile cache dirs under outputs, preserving screenshots/reports/json/csv.",
  acceptance: "Cleanup dry-run reports paths, real run removes cache dirs, and no source/config/evidence files are touched.",
});

addTask({
  id: "P2_NEXT_CHAPTER_CONFIG_IMPORTER",
  lane: "chapter_framework",
  skill: "wuxia-system-design + wuxia-game-planning",
  severity: "P2",
  status: flow.chapterSystem ? "ready_for_next" : "open",
  evidence: flow.chapterSystem?.schema || "missing",
  gap: "Chapter framework policy exists; importer for later chapters and new result-effect module registration is not yet generalized.",
  action: "Generate chapterN package from restored mapRoom/mapRole/mapConditionAndResult with explicit new-system module policies.",
  acceptance: "A second chapter imports without UI/runtime hardcoding and produces the same evidence/interaction/result-token audit matrices.",
});

const gateRows = [
  {
    gateId: "GATE_CONTENT_DATA_DRIVEN_BOUNDARY",
    requirement: "Active runtime code contains no concrete chapter/node/NPC/enemy/story/reward content hardcoding.",
    status: contentBoundary.passStrict === true ? "pass" : "fail",
    evidence: `outputs/wuxia_content_data_driven_boundary/summary.json high=${contentBoundary.counts?.high ?? "not_run"} medium=${contentBoundary.counts?.medium ?? "not_run"}`,
  },
  {
    gateId: "GATE_RUNTIME_P2_CLOSURE",
    requirement: "No P0/P1/P2 result-token or flow-parity blockers.",
    status: Number(p2Closure.totalP2Rows || 0) === 0 ? "pass" : "fail",
    evidence: `outputs/wuxia_p2_closure_gate/summary.json totalP2Rows=${p2Closure.totalP2Rows ?? "unknown"}`,
  },
  {
    gateId: "GATE_ONLINE_STANDARD_TECH",
    requirement: "Online-standard technical audit has no active-entry, asset, runtime, interaction issue.",
    status: Number(stage.issues?.total || 0) === 0 ? "pass" : "fail",
    evidence: `outputs/skill_waterfall_stage_audit_20260706/summary.json issues=${stage.issues?.total ?? "unknown"}`,
  },
  {
    gateId: "GATE_REAL_BROWSER_DEEP_PATH",
    requirement: "Real browser deep path has no click failures or visible bad legacy/debug tokens.",
    status: realFailures === 0 && realBadMatches === 0 ? "pass" : "fail",
    evidence: `steps=${realBrowser.steps ?? 0}; failures=${realFailures}; badMatches=${realBadMatches}; automationDispatches=${realAutomationDispatches}`,
  },
  {
    gateId: "GATE_PLAYER_VISIBLE_KEY_SCREEN_ENTRY",
    requirement: "Key first-session state screens are reached through player-visible configured UI, not automation-only dispatch.",
    status: realAutomationDispatches === 0 ? "pass" : "fail",
    evidence: `automationDispatches=${realAutomationDispatches}`,
  },
  {
    gateId: "GATE_CHAPTER1_TRUE_END",
    requirement: "Startup-to-first-chapter-end route is proven by real browser evidence.",
    status: chapterEndEvidence ? "pass" : "fail",
    evidence: `chapterEndEvidence=${chapterEndEvidence}; finalKnownScreen=${realResults.at(-1)?.screen || ""}; finalKnownLabel=${realResults.at(-1)?.label || ""}`,
  },
  {
    gateId: "GATE_PRODUCT_VISUAL_PARITY",
    requirement: "Every first-session screen has competitor source evidence plus readable 540x960 actual screenshot parity.",
    status: "fail",
    evidence: "Current audit checks mapping/readability basics only; product-grade parity matrix is still open.",
  },
  {
    gateId: "GATE_COMBAT_PRODUCT_PRESENTATION",
    requirement: "Combat is understandable through unit-bound state, Buffs, floating feedback, skill timing, and explicit outcomes using owned assets.",
    status: "fail",
    evidence: `Ordering policy=${Object.keys(flow.chapterSystem?.combatActionPolicies || {}).join("|") || "missing"}; current preview=${flow.defaultCombatPreviewId || "missing"}; product presentation task remains open.`,
  },
];

ensureDir(outDir);

writeCsv(path.join(outDir, "task_list.csv"), tasks, [
  "id",
  "lane",
  "skill",
  "severity",
  "status",
  "evidence",
  "gap",
  "action",
  "acceptance",
]);
writeCsv(path.join(outDir, "stage_gate_matrix.csv"), gateRows, ["gateId", "requirement", "status", "evidence"]);
writeCsv(path.join(outDir, "screen_acceptance_matrix.csv"), screenRows, [
  "screenId",
  "mode",
  "title",
  "hasAction",
  "browserSeenCount",
  "evidenceScreenshot",
  "status",
  "nextAction",
]);
writeCsv(path.join(outDir, "interaction_acceptance_matrix.csv"), interactionStatusRows, [
  "status",
  "count",
  "risk",
  "nextAction",
]);
writeCsv(path.join(outDir, "asset_acceptance_matrix.csv"), assetRows, ["assetGroup", "count", "status", "nextAction"]);
writeCsv(path.join(outDir, "code_surface_acceptance_matrix.csv"), codeRows, [
  "file",
  "lines",
  "status",
  "forbiddenHits",
  "acceptance",
]);

const taskSummary = {
  generatedAt: new Date().toISOString(),
  outDir,
  taskCount: tasks.length,
  tasksBySeverity: countBy(tasks, "severity"),
  tasksByStatus: countBy(tasks, "status"),
  gateStatus: countBy(gateRows, "status"),
  strictOnlineReady: gateRows.every((row) => row.status === "pass") && !tasks.some((task) => task.status === "open" && ["P0", "P1"].includes(task.severity)),
  keyMetrics: {
    states: stage.flowCounts?.states || 0,
    actions: stage.flowCounts?.actions || 0,
    chapter1Rooms: stage.flowCounts?.chapter1Rooms || 0,
    chapter1Npcs: stage.flowCounts?.chapter1Npcs || 0,
    chapter1Interactables: stage.flowCounts?.chapter1Interactables || 0,
    interactionActions: interactions.counts?.actions || 0,
    browserInteractionClicked: browserInteractionCrawl.counts?.browserClicked ?? "not_run",
    browserInteractionPending: browserInteractionCrawl.counts?.browserPending ?? "not_run",
    browserInteractionExecutorGaps: browserInteractionCrawl.counts?.executorGaps ?? "not_run",
    realBrowserSteps: realBrowserStepsTotal,
    realBrowserScenarios: realBrowserScenarioSummary,
    realBrowserRunErrors: realBrowserRunErrorSummary,
    realBrowserFailures: realFailures,
    realBrowserBadMatches: realBadMatches,
    realBrowserAutomationDispatches: realAutomationDispatches,
  },
};
writeJson(path.join(outDir, "summary.json"), taskSummary);

const openP0P1 = tasks.filter((task) => task.status === "open" && ["P0", "P1"].includes(task.severity));
const chapterTrueEndGate = gateRows.find((row) => row.gateId === "GATE_CHAPTER1_TRUE_END")?.status || "fail";
const productVisualGate = gateRows.find((row) => row.gateId === "GATE_PRODUCT_VISUAL_PARITY")?.status || "fail";
const report = [
  "# Skill Waterfall Stage Tasks 20260708",
  "",
  "## Conclusion",
  "",
  taskSummary.strictOnlineReady
    ? "The current first-session stage passes the strict online-ready gate."
    : `The current first-session stage does not pass the strict online-ready gate yet. Runtime/config blockers are closed; first-chapter true-end gate is ${chapterTrueEndGate}; product visual parity gate is ${productVisualGate}.`,
  "",
  "## Gate Summary",
  "",
  ...gateRows.map((row) => `- ${row.gateId}: ${row.status} (${row.evidence})`),
  "",
  "## Open P0/P1 Tasks",
  "",
  ...(openP0P1.length
    ? openP0P1.map((task) => `- ${task.id} [${task.severity}]: ${task.gap}\n  - Next: ${task.action}\n  - Acceptance: ${task.acceptance}`)
    : ["- None"]),
  "",
  "## Closed / Stable Evidence",
  "",
  `- Result token rows: ${resultTokens.rows ?? 0}; severity: ${JSON.stringify(resultTokens.bySeverity || {})}`,
  `- Flow parity findings: ${flowParity.findings ?? 0}; severity: ${JSON.stringify(flowParity.bySeverity || {})}`,
  `- Interaction actions: ${interactions.counts?.actions ?? 0}; highRisk: ${interactions.counts?.highRisk ?? 0}`,
  `- Real browser paths: ${realBrowserScenarioSummary || "none"}; runErrors=${realBrowserRunErrorSummary || "none"}; failures=${realFailures}; badMatches=${realBadMatches}; automationDispatches=${realAutomationDispatches}`,
  "",
  "## Outputs",
  "",
  "- task_list.csv",
  "- stage_gate_matrix.csv",
  "- screen_acceptance_matrix.csv",
  "- interaction_acceptance_matrix.csv",
  "- asset_acceptance_matrix.csv",
  "- code_surface_acceptance_matrix.csv",
  "- summary.json",
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "stage_task_report.md"), report, "utf8");

console.log(JSON.stringify(taskSummary, null, 2));

if (strict && !taskSummary.strictOnlineReady) {
  process.exitCode = 1;
}
