import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outDir = path.join(root, "outputs", "skill_waterfall_stage_audit_20260706");

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(readText(filePath));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function lineOf(text, needle) {
  const index = text.indexOf(needle);
  if (index < 0) return "";
  return text.slice(0, index).split(/\r?\n/).length;
}

function walkFiles(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, list);
    else list.push(fullPath);
  }
  return list;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = readText(filePath).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuote && ch === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && ch === ",") {
      row.push(cell);
      cell = "";
    } else if (!inQuote && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || "(empty)";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

const issues = [];
function issue(row) {
  issues.push({
    severity: row.severity || "P2",
    domain: row.domain || "unknown",
    item: row.item || "",
    problem: row.problem || "",
    source: row.source || "",
    sourceLine: row.sourceLine || "",
    evidenceLevel: row.evidenceLevel || "audit_detected",
    requiredFix: row.requiredFix || "",
    acceptance: row.acceptance || "",
  });
}

const indexPath = path.join(root, "index.html");
const activeEntryPath = path.join(root, "src", "wuxia-main.js");
const legacyEntryPath = path.join(root, "src", "main.js");
const stylesPath = path.join(root, "src", "styles.css");
const screenPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const interactionSummaryPath = path.join(root, "outputs", "wuxia_fb01_interaction_coverage", "summary.json");
const highRiskCsvPath = path.join(root, "outputs", "wuxia_fb01_interaction_coverage", "fb01_interaction_high_risk.csv");
const resultTokenSummaryPath = path.join(root, "outputs", "wuxia_fb01_result_token_runtime_coverage", "summary.json");
const resultTokenCsvPath = path.join(root, "outputs", "wuxia_fb01_result_token_runtime_coverage", "fb01_result_token_runtime_coverage.csv");

const indexHtml = readText(indexPath);
const activeMain = readText(activeEntryPath);
const legacyMain = readText(legacyEntryPath);
const styles = readText(stylesPath);
const screen = readJson(screenPath, {});
const flow = readJson(flowPath, {});
const interactionSummary = readJson(interactionSummaryPath, {});
const highRiskRows = parseCsv(highRiskCsvPath);
const resultTokenSummary = readJson(resultTokenSummaryPath, {});
const resultTokenRows = parseCsv(resultTokenCsvPath);

if (!indexHtml.includes('src="./src/wuxia-main.js"')) {
  issue({
    severity: "P0",
    domain: "code_line",
    item: "index.html active entry",
    problem: "The browser entry is not bound to src/wuxia-main.js, so the old prototype can still become the active UI.",
    source: "index.html",
    sourceLine: lineOf(indexHtml, "<script"),
    requiredFix: "Bind the only player-facing entry to the Wuxia first-session runtime.",
    acceptance: "Opening the dev server must never show Nova Lite or Idle Dot Shooter screens.",
  });
}

const legacySignals = ["Welcome Back", "GALAXY", "Offline Cap", "debugPanel", "toggle-debug"]
  .map((signal) => ({ signal, line: lineOf(legacyMain, signal) }))
  .filter((entry) => entry.line);

if (legacySignals.length) {
  issue({
    severity: "P1",
    domain: "code_line",
    item: "src/main.js legacy prototype residue",
    problem: `Old Nova Lite / Idle Dot Shooter code still lives in src/main.js: ${legacySignals.map((entry) => `${entry.signal}@${entry.line}`).join("; ")}.`,
    source: "src/main.js",
    sourceLine: legacySignals[0].line,
    requiredFix: "Archive, isolate, or remove the old entry code; if kept, active-entry and build audits must explicitly exclude it.",
    acceptance: "Code audit no longer treats old idle shooter text as part of the current Wuxia UI.",
  });
}

if (indexHtml.includes("./public/original-game/")) {
  issue({
    severity: "P1",
    domain: "asset",
    item: "index asset reference",
    problem: "The active entry references public/original-game, which belongs to inherited template/reference material.",
    source: "index.html",
    sourceLine: lineOf(indexHtml, "original-game"),
    requiredFix: "Replace with project-owned Wuxia assets or mark the reference-only asset as non-product.",
    acceptance: "Entry favicon, manifest, and runtime assets no longer depend on original-game.",
  });
}

const screens = screen?.screens || {};
const screenRows = Object.entries(screens).map(([screenId, value]) => {
  const text = JSON.stringify(value);
  const hasDebugWord = /debug|warning|audit|raw id|TODO/i.test(text);
  const hasAction = Boolean(value.primaryActionId || value.navActions || text.includes("actionId"));
  const hasBody = Array.isArray(value.body) && value.body.length > 0;
  const mode = value.mode || "";
  const status = hasBody && !hasDebugWord ? "mapped" : "needs_review";

  if (!hasBody) {
    issue({
      severity: "P0",
      domain: "screen",
      item: screenId,
      problem: "Screen contract has no body blocks, so it cannot be accepted screen-by-screen.",
      source: "config/wuxia_first_session_screen_contract.json",
      evidenceLevel: "config_confirmed",
      requiredFix: "Add body, view-model, and action mapping.",
      acceptance: "ScreenId can render a readable, clickable screen from data.",
    });
  }

  if (hasDebugWord) {
    issue({
      severity: "P1",
      domain: "screen",
      item: screenId,
      problem: "Screen contract contains debug/warning/audit/TODO wording that must not appear in product UI.",
      source: "config/wuxia_first_session_screen_contract.json",
      requiredFix: "Move debug wording into internal audit panels or remove it from player-facing contracts.",
      acceptance: "Real browser screenshots show no debug or audit wording in player UI.",
    });
  }

  return {
    screenId,
    mode,
    title: value.title || "",
    bodyBlocks: Array.isArray(value.body) ? value.body.length : 0,
    hasAction,
    status,
  };
});

const earlyCombat = screens.UI_EarlyCombat || null;
if (earlyCombat) {
  const combatBlocks = Array.isArray(earlyCombat.body) ? earlyCombat.body : [];
  const hasStaticCombatStage = combatBlocks.some((block) => block?.type === "combatStage");
  const runtimeBlock = combatBlocks.find((block) => block?.type === "combatRuntime") || null;
  const previewId = runtimeBlock?.previewId || flow?.defaultCombatPreviewId || "";
  const preview = previewId ? flow?.combatPreviews?.[previewId] : null;
  const previewText = JSON.stringify(preview || {});
  const hasPlaceholderText = /\?{2,}|Missing combat preview|placeholder|TODO/i.test(previewText);
  const hasRuntimeEvents = Array.isArray(preview?.events) && preview.events.length > 0;
  const hasRuntimeUnits = Boolean(preview?.units?.left?.name && preview?.units?.right?.name);

  if (hasStaticCombatStage || !runtimeBlock || !preview || !hasRuntimeEvents || !hasRuntimeUnits || hasPlaceholderText) {
    issue({
      severity: "P1",
      domain: "screen",
      item: "UI_EarlyCombat",
      problem: "Combat screen is not yet cleanly bound to readable data-driven combat runtime events.",
      source: "config/wuxia_first_session_screen_contract.json",
      evidenceLevel: "config_confirmed",
      requiredFix: "Bind combat UI to competitor-derived combat preview data: unit names, HP/MP, Buff slots, floating text, and combat log must be readable and contain no placeholders.",
      acceptance: "Clicking a combat action shows HP/MP/Buff/log from flow.combatPreviews and no fake static values or question-mark placeholders remain.",
    });
  }
}

const actionCount = interactionSummary?.counts?.actions || 0;
const highRisk = interactionSummary?.counts?.highRisk || 0;
if (highRisk > 0) {
  issue({
    severity: "P0",
    domain: "interaction",
    item: "fb01 interaction coverage",
    problem: `fb01 has ${actionCount} configured actions and ${highRisk} are still high risk: missing exact branch, token-only branch, or unverified behavior.`,
    source: "outputs/wuxia_fb01_interaction_coverage/fb01_interaction_high_risk.csv",
    requiredFix: "Resolve each high-risk row against competitor action branches/result-token semantics; do not replace with invented fallback copy.",
    acceptance: "P0/P1 actions disappear from the high-risk table, and real browser clicks produce exact feedback or a confirmed locked/unavailable reason.",
  });
}

const p0ResultTokens = Number(resultTokenSummary?.bySeverity?.P0 || 0);
const p1ResultTokens = Number(resultTokenSummary?.bySeverity?.P1 || 0);
if (p0ResultTokens > 0 || p1ResultTokens > 0) {
  issue({
    severity: p0ResultTokens > 0 ? "P0" : "P1",
    domain: "runtime_result_token",
    item: "fb01 result token side effects",
    problem: `fb01 restored result tokens still have ${p0ResultTokens} P0 and ${p1ResultTokens} P1 runtime side-effect bindings missing.`,
    source: "outputs/wuxia_fb01_result_token_runtime_coverage/fb01_result_token_runtime_coverage.csv",
    evidenceLevel: "config_confirmed",
    requiredFix: "Implement generic executors for entity visibility mutation, map marker state, room stop/gate, inventory/reward, skill progression, and combat trigger; do not mark first chapter complete before these side effects execute.",
    acceptance: "Result-token audit reports P0=0 and P1=0 or each remaining row is explicitly downgraded with Lua/config evidence and a tested locked-path reason.",
  });
}

const highRiskByAction = Object.entries(countBy(highRiskRows, "actionType"))
  .map(([actionType, count]) => ({ actionType, count }))
  .sort((a, b) => b.count - a.count);
const highRiskByStatus = Object.entries(countBy(highRiskRows, "status"))
  .map(([status, count]) => ({ status, count }))
  .sort((a, b) => b.count - a.count);

const sourceTexts = [
  { source: "index.html", text: indexHtml },
  { source: "src/wuxia-main.js", text: activeMain },
  { source: "src/styles.css", text: styles },
];
const assetRefs = [];
for (const { source, text } of sourceTexts) {
  const regex = /(?:href|src)=["']([^"']+)["']|url\(["']?([^)"']+)["']?\)/g;
  let match;
  while ((match = regex.exec(text))) {
    const rawRef = match[1] || match[2] || "";
    if (!rawRef || rawRef.startsWith("data:")) continue;
    const normalized = rawRef.replace(/^\.\//, "");
    const localPath = path.join(root, normalized);
    assetRefs.push({
      source,
      ref: rawRef,
      exists: fs.existsSync(localPath),
      localPath: fs.existsSync(localPath) ? localPath : "",
      status: fs.existsSync(localPath) ? "exists" : "missing",
    });
  }
}

for (const ref of assetRefs.filter((entry) => !entry.exists)) {
  issue({
    severity: "P1",
    domain: "asset",
    item: ref.ref,
    problem: "A code or stylesheet asset reference does not exist.",
    source: ref.source,
    requiredFix: "Add the asset or remove the reference.",
    acceptance: "Browser network or asset audit has no 404 for active entry assets.",
  });
}

const originalGameFiles = walkFiles(path.join(root, "public", "original-game"));
if (originalGameFiles.length) {
  issue({
    severity: "P2",
    domain: "asset",
    item: "public/original-game",
    problem: `Old template/reference asset directory still exists with ${originalGameFiles.length} files. The active Wuxia product flow must not depend on it.`,
    source: "public/original-game",
    requiredFix: "Move to a reference/archive location or document it as reference-only; active entry must not reference it.",
    acceptance: "The active product public tree contains only Wuxia assets or clearly separated reference-only assets.",
  });
}

const competitorReferenceFiles = walkFiles(path.join(root, "public", "competitor-reference"));
const generatedUiFiles = walkFiles(path.join(root, "public", "generated-ui"));
const flowCounts = {
  states: flow?.states?.length || 0,
  actions: flow?.actions?.length || 0,
  chapter1Rooms: flow?.chapter1?.rooms?.length || 0,
  chapter1Npcs: flow?.chapter1?.npcs?.length || 0,
  chapter1Interactables: flow?.chapter1?.interactables?.length || 0,
  screens: screenRows.length,
};

const issueColumns = [
  "severity",
  "domain",
  "item",
  "problem",
  "source",
  "sourceLine",
  "evidenceLevel",
  "requiredFix",
  "acceptance",
];
const screenColumns = ["screenId", "mode", "title", "bodyBlocks", "hasAction", "status"];
const assetColumns = ["source", "ref", "exists", "localPath", "status"];
const actionColumns = ["actionType", "count"];
const statusColumns = ["status", "count"];
const resultTokenStatusColumns = ["RuntimeStatus", "count"];

ensureDir(outDir);
writeCsv(path.join(outDir, "online_standard_issues.csv"), issues, issueColumns);
writeCsv(path.join(outDir, "screen_audit.csv"), screenRows, screenColumns);
writeCsv(path.join(outDir, "asset_reference_audit.csv"), assetRefs, assetColumns);
writeCsv(path.join(outDir, "interaction_high_risk_by_action.csv"), highRiskByAction, actionColumns);
writeCsv(path.join(outDir, "interaction_high_risk_by_status.csv"), highRiskByStatus, statusColumns);
writeCsv(
  path.join(outDir, "result_token_runtime_status.csv"),
  Object.entries(countBy(resultTokenRows, "RuntimeStatus")).map(([RuntimeStatus, count]) => ({ RuntimeStatus, count })),
  resultTokenStatusColumns,
);

const summary = {
  generatedAt: new Date().toISOString(),
  root,
  flowCounts,
  interaction: {
    actions: actionCount,
    highRisk,
    byStatus: interactionSummary.byStatus || {},
    highRiskByAction,
    highRiskByStatus,
  },
  resultTokens: {
    rows: resultTokenRows.length,
    bySeverity: resultTokenSummary?.bySeverity || {},
    byRuntimeStatus: resultTokenSummary?.byRuntimeStatus || {},
    byBinding: resultTokenSummary?.byBinding || {},
  },
  assets: {
    referencedByActiveEntry: assetRefs.length,
    missingReferences: assetRefs.filter((entry) => !entry.exists).length,
    originalGameFiles: originalGameFiles.length,
    competitorReferenceFiles: competitorReferenceFiles.length,
    generatedUiFiles: generatedUiFiles.length,
  },
  issues: {
    total: issues.length,
    bySeverity: countBy(issues, "severity"),
    byDomain: countBy(issues, "domain"),
  },
  outputDir: outDir,
};
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

const taskList = [
  "# Stage Task Audit: Online Standard Gap 20260706",
  "",
  "## P0 Must Close First",
  ...issues
    .filter((entry) => entry.severity === "P0")
    .map((entry, index) => `${index + 1}. [${entry.domain}] ${entry.item}: ${entry.problem}\n   - Fix: ${entry.requiredFix}\n   - Acceptance: ${entry.acceptance}`),
  "",
  "## P1 Next Round Focus",
  ...issues
    .filter((entry) => entry.severity === "P1")
    .map((entry, index) => `${index + 1}. [${entry.domain}] ${entry.item}: ${entry.problem}\n   - Fix: ${entry.requiredFix}\n   - Acceptance: ${entry.acceptance}`),
  "",
  "## P2 Governance Items",
  ...issues
    .filter((entry) => entry.severity === "P2")
    .map((entry, index) => `${index + 1}. [${entry.domain}] ${entry.item}: ${entry.problem}`),
  "",
  "## High-Risk Interaction Action Types",
  ...highRiskByAction.slice(0, 12).map((row) => `- ${row.actionType}: ${row.count}`),
  "",
  "## Rule",
  "- Evidence rows must stay classified as lua_confirmed / config_confirmed / cross_source_confirmed / reverse_tested / design_proposal / unknown.",
  "- This audit is a stage gate, not a completion claim. P0/P1 remaining means online-standard acceptance is not complete.",
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "stage_tasks_online_standard_gap_audit_20260706.md"), taskList, "utf8");

console.log(JSON.stringify(summary, null, 2));

const allowP1 = process.argv.includes("--allow-p1");
if (issues.some((entry) => entry.severity === "P0" || (!allowP1 && entry.severity === "P1"))) {
  process.exitCode = 1;
}
