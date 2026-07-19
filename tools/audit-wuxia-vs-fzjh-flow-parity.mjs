import fs from "node:fs";
import path from "node:path";

import { allEvidenceReferences } from "../src/evidenceContract.js";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_fzjh_flow_parity_audit");
fs.mkdirSync(outDir, { recursive: true });

function readJson(rel) {
  const source = fs.readFileSync(path.join(root, rel), "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(source);
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, columns) {
  const body = [columns.join(","), ...rows.map((row) => columns.map((col) => csvCell(row[col])).join(","))].join("\n");
  fs.writeFileSync(path.join(outDir, name), `${body}\n`, "utf8");
}

function existsRel(rel) {
  return Boolean(rel) && fs.existsSync(path.join(root, rel));
}

function textOf(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => textOf(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => textOf(item, out));
  return out;
}

function visibleTextOf(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => visibleTextOf(item, out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/actionid|stateid|screenid|nodeid|servercommand/i.test(key)) continue;
      visibleTextOf(item, out);
    }
  }
  return out;
}

const flow = readJson("config/wuxia_first_session_flow.json");
const screens = readJson("config/wuxia_first_session_screen_contract.json");
const reference = readJson("config/wuxia_competitor_first_session_reference.json");
const entryHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const entryMatch = entryHtml.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i);
const activeEntryRel = entryMatch?.[1]?.replace(/^\.\//, "") || "";
const activeEntrySource = activeEntryRel && existsRel(activeEntryRel)
  ? fs.readFileSync(path.join(root, activeEntryRel), "utf8")
  : "";

const flowStates = new Map((flow.states || []).map((state) => [state.screenId, state]));
const actions = new Map((flow.actions || []).map((action) => [action.actionId, action]));
const screenMap = screens.screens || {};
const findings = [];
const chapterContentPolicy = flow.chapterSystem?.chapterContentPolicy || {};

function add(severity, area, subject, issue, sourceEvidence = "", action = "") {
  findings.push({ Severity: severity, Area: area, Subject: subject, Issue: issue, SourceEvidence: sourceEvidence, RequiredAction: action });
}

function evidenceSourceText(evidence) {
  return JSON.stringify(allEvidenceReferences(evidence));
}

for (const [key, rel] of Object.entries(flow.sourceFiles || {})) {
  if (!existsRel(rel)) add("P0", "source", key, "source file referenced by flow does not exist", rel, "restore source or change evidence to unknown/design_proposal");
}

const requiredOrder = reference.requiredFlowOrder || [];
requiredOrder.forEach((screenId, index) => {
  const screen = screenMap[screenId];
  const state = flowStates.get(screenId);
  if (!screen) add("P0", "screen", screenId, `missing screen contract at required order ${index + 1}`, "wuxia_competitor_first_session_reference.requiredFlowOrder", "create screen contract from source evidence");
  if (!state) add("P0", "state", screenId, `missing flow state for required screen at order ${index + 1}`, "wuxia_competitor_first_session_reference.requiredFlowOrder", "create state with evidence and action route");
  if (screen && state) {
    const navLabels = [screen.nav?.left, screen.nav?.right].filter(Boolean);
    for (const label of navLabels) {
      if ((label.includes("返回") || label.includes("离开") || label.includes("状态")) && !Object.values(screen.navActions || {}).some(Boolean)) {
        add("P1", "screen", screenId, `nav label '${label}' has no configured action`, "screen.nav/navActions", "bind nav to ActionId or hide it");
      }
    }
  }
});

for (const [screenId, screen] of Object.entries(screenMap)) {
  const visiblePayload = {
    title: screen.title,
    nav: screen.nav,
    primaryText: screen.primaryText,
    secondaryText: screen.secondaryText,
    body: screen.body,
  };
  const strings = visibleTextOf(visiblePayload).join("\n");
  const rawIdSignals = strings.match(/STATE_FS_|ACTION_FS_|NODE_FB01_|FS_\d{3}/g) || [];
  if (rawIdSignals.length) add("P1", "ui", screenId, `player-facing screen may expose raw IDs: ${[...new Set(rawIdSignals)].slice(0, 5).join("|")}`, "screen_contract", "move IDs to data attributes only; visible copy must be clean zhCN");
  for (const token of ["当前录屏", "待验证", "暂按", "APP备案", "隐私政策", "用户协议", "Welcome Back", "GALAXY", "TURRET", "tesla"]) {
    if (strings.includes(token)) add("P0", "ui", screenId, `forbidden prototype/audit copy visible: ${token}`, "screen_contract", "replace with competitor-confirmed copy or remove");
  }
  if (screen.primaryActionId && !actions.has(screen.primaryActionId)) add("P0", "screen", screenId, `primaryActionId ${screen.primaryActionId} missing in flow actions`, "screen_contract.primaryActionId", "add action route or remove button");
  if (screen.secondaryActionId && !actions.has(screen.secondaryActionId)) add("P1", "screen", screenId, `secondaryActionId ${screen.secondaryActionId} missing in flow actions`, "screen_contract.secondaryActionId", "add action route or remove button");
  for (const [slot, actionId] of Object.entries(screen.navActions || {})) {
    if (actionId && !actions.has(actionId)) add("P0", "screen", screenId, `navActions.${slot} ${actionId} missing in flow actions`, "screen_contract.navActions", "add action route");
  }
}

for (const action of flow.actions || []) {
  if (!action.serverCommand) add("P0", "action", action.actionId, "missing serverCommand", "flow.actions", "add command boundary");
  if (!action.evidence?.level || action.evidence.level === "unknown") add("P1", "action", action.actionId, "missing competitor/config evidence", "flow.actions.evidence", "trace Lua/config/recording evidence");
  if (action.evidence?.level === "design_proposal") {
    const isDocumentedNavigationBridge = Boolean(chapterContentPolicy.navigationBridgePolicy)
      && /back|leave|status|close|return/i.test(action.serverCommand || "");
    add(
      isDocumentedNavigationBridge ? "P3" : "P2",
      "action",
      action.actionId,
      isDocumentedNavigationBridge
        ? "documented project navigation bridge, not competitor progression content"
        : "action is project proposal, not competitor fact",
      evidenceSourceText(action.evidence),
      isDocumentedNavigationBridge
        ? "keep data-driven and forbid reward/progression mutation"
        : "keep but mark in UI/acceptance as project policy",
    );
  }
}

for (const node of flow.chapter1?.nodes || []) {
  if (node.isProjectBridge || node.hideFromMap || node.nodeType === "chapter_settlement") {
    if (!node.hideFromMap) add("P1", "chapter1", node.nodeId, "project bridge node must not be visible on player-facing chapter map", evidenceSourceText(node.evidence), "set hideFromMap=true and route only through result flow");
    if (node.evidence?.level === "design_proposal") {
      add(
        chapterContentPolicy.hiddenProjectBridgePolicy && node.hideFromMap ? "P3" : "P2",
        "chapter1",
        node.nodeId,
        chapterContentPolicy.hiddenProjectBridgePolicy && node.hideFromMap
          ? "hidden project bridge node documented and excluded from player-facing map"
          : "node is project bridge, not competitor map content",
        evidenceSourceText(node.evidence),
        chapterContentPolicy.hiddenProjectBridgePolicy && node.hideFromMap
          ? "keep hidden and exclude from competitor-visible chapter map"
          : "keep hidden and document as project policy",
      );
    }
    continue;
  }
  if (!node.evidence?.level || node.evidence.level === "design_proposal") add("P1", "chapter1", node.nodeId, "node is not fully competitor-confirmed", evidenceSourceText(node.evidence), "trace mapRoom/mapRole/mapRoleBase fields or downgrade presentation claim");
  if (!node.primaryAction?.actionId) add("P0", "chapter1", node.nodeId, "node has no executable primary action", "chapter1.nodes.primaryAction", "bind route action");
}

const legacyTokens = [
  ["offline_return", /Welcome Back|OFFLINE|Offline Cap|claim-offline/g],
  ["nova_galaxy", /GALAXY|Nova Reactor|TURRET|tesla/g],
  ["old_canvas_game", /gameCanvas|fireTesla|applyBurn|bossNovaReactor/g],
];
for (const [group, regex] of legacyTokens) {
  const matches = activeEntrySource.match(regex) || [];
  if (matches.length) add("P1", "source", `${activeEntryRel}:${group}`, `legacy prototype code present in active entry (${matches.length} matches)`, activeEntryRel, "remove from Wuxia entry bundle");
}

const sourceRows = [];
for (const [key, rel] of Object.entries(flow.sourceFiles || {})) {
  sourceRows.push({ SourceKey: key, Path: rel, Exists: existsRel(rel), Policy: existsRel(rel) ? "usable" : "broken" });
}
writeCsv("source_file_audit.csv", sourceRows, ["SourceKey", "Path", "Exists", "Policy"]);
writeCsv("flow_parity_findings.csv", findings, ["Severity", "Area", "Subject", "Issue", "SourceEvidence", "RequiredAction"]);

const summary = {
  generatedAt: new Date().toISOString(),
  requiredScreens: requiredOrder.length,
  states: flow.states?.length || 0,
  actions: flow.actions?.length || 0,
  screens: Object.keys(screenMap).length,
  chapter1Nodes: flow.chapter1?.nodes?.length || 0,
  activeEntry: activeEntryRel,
  findings: findings.length,
  bySeverity: findings.reduce((acc, row) => { acc[row.Severity] = (acc[row.Severity] || 0) + 1; return acc; }, {}),
};
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "flow_parity_audit.md"), [
  "# IdleWuxia vs FangzhiJianghu Flow Parity Audit",
  "",
  `- Generated: ${summary.generatedAt}`,
  `- Required screens: ${summary.requiredScreens}`,
  `- Flow states/actions: ${summary.states}/${summary.actions}`,
  `- Screen contracts: ${summary.screens}`,
  `- Chapter1 nodes: ${summary.chapter1Nodes}`,
  `- Findings: ${summary.findings}`,
  `- By severity: ${JSON.stringify(summary.bySeverity)}`,
  "",
  "## Blocking Findings",
  ...findings.filter((row) => row.Severity === "P0").map((row) => `- ${row.Area}/${row.Subject}: ${row.Issue} -> ${row.RequiredAction}`),
  "",
  "## Next Fix Queue",
  ...findings.filter((row) => row.Severity !== "P0").slice(0, 40).map((row) => `- ${row.Severity} ${row.Area}/${row.Subject}: ${row.Issue}`),
  "",
].join("\n"), "utf8");

console.log(JSON.stringify(summary, null, 2));
if ((summary.bySeverity.P0 || 0) > 0) process.exitCode = 1;
