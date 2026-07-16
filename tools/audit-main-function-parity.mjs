import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
const mainPath = path.join(root, "src", "main.js");
const lineAuditPath = path.join(outputDir, "current_vs_original_code_audit", "line_audit.jsonl");
const referenceAuditPath = path.join(outputDir, "reference_consistency_deep_audit_20260701.json");

fs.mkdirSync(outputDir, { recursive: true });

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function readJson(file) {
  const text = read(file);
  return text ? JSON.parse(text) : null;
}

function splitLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function parseLineAudit(file) {
  const text = read(file).trim();
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function addCount(target, key, amount = 1) {
  if (!key) return;
  target[key] = (target[key] || 0) + amount;
}

function sortedEntries(record) {
  return Object.fromEntries(Object.entries(record || {}).sort(([a], [b]) => a.localeCompare(b)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function detectFunctions(lines) {
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const declaration = line.match(/^function\s+([A-Za-z0-9_$]+)\s*\(/);
    const asyncDeclaration = line.match(/^async function\s+([A-Za-z0-9_$]+)\s*\(/);
    const match = asyncDeclaration || declaration;
    if (!match) continue;
    starts.push({ name: match[1], startLine: i + 1 });
  }

  const functions = [];
  if (starts.length && starts[0].startLine > 1) {
    functions.push({ name: "<module-scope>", startLine: 1, endLine: starts[0].startLine - 1 });
  }

  for (let i = 0; i < starts.length; i += 1) {
    functions.push({
      name: starts[i].name,
      startLine: starts[i].startLine,
      endLine: i + 1 < starts.length ? starts[i + 1].startLine - 1 : lines.length,
    });
  }
  return functions;
}

function areaForFunction(name) {
  const lower = name.toLowerCase();
  if (/(audio|sfx|haptic|presentation|screenfx|particle|draw|visual|theme)/.test(lower)) return "presentation";
  if (/(ad|iap|reward|monetization|railskill|store|purchase|gift|entitlement)/.test(lower)) return "commercial";
  if (/(modal|render|ui|tab|button|card|slot|sideentrance|label|shell|focus)/.test(lower)) return "ui";
  if (/(economy|cost|world|galaxy|dps|upgrade|afford|value|multiplier|bossreward)/.test(lower)) return "economy";
  if (/(spawn|dot|projectile|shoot|damage|kill|boss|weapon|turret|drone|vacuum|collector|target|update|enemy|wave)/.test(lower)) return "combat";
  if (/(save|load|persist|storage|snapshot)/.test(lower)) return "persistence";
  if (/(qa|debug|audit|demo)/.test(lower)) return "debug";
  return "general";
}

function actionForFunction(item) {
  const lower = item.name.toLowerCase();
  const review = item.statusCounts["needs-mechanics-parity-review"] || 0;
  const extension = item.statusCounts["prototype-extension"] || 0;

  if (review <= 0 && extension <= 0) return "No immediate parity action; keep covered by current gate.";
  if (/(spawndot|spawndots|spawnwave|entitycap|wave)/.test(lower)) {
    return "Compare spawn count, batch timing, cap, value/hp scaling, and special-dot cadence against original runtime/video evidence.";
  }
  if (/(projectile|shoot|target|turret|shooter)/.test(lower)) {
    return "Verify target selection, projectile rotation, fire interval, turret-count semantics, and hit timing against original Canvas behavior.";
  }
  if (/(collector|drone|vacuum)/.test(lower)) {
    return "Verify slot unlock count, flying-unit combat AI, movement range, kill radius, and upgrade mapping against original Drone/Vacuum evidence.";
  }
  if (/(boss)/.test(lower)) {
    return "Verify boss entry state, phase gates, HP/reward mapping, heavy-hit feedback, and Galaxy panel button state against original evidence.";
  }
  if (/(railskill|reward|ad|iap|store|purchase)/.test(lower)) {
    return "Keep current P0 stubs gated; production path must use AdMob SSV/IAP backend resolver before granting rewards or entitlements.";
  }
  if (/(render|ui|tab|button|slot|sideentrance|modal)/.test(lower)) {
    return "Compare visible/disabled/locked states on mobile scenarios and keep all unlock states config-driven.";
  }
  if (/(draw|presentation|particle|audio|haptic|theme)/.test(lower)) {
    return "Treat as polish extension: keep tunable, mobile-safe, and reversible without changing parity formulas.";
  }
  if (extension > 0) return "Prototype/debug extension: ensure hidden from normal product path or guarded by config/debug mode.";
  return "Mechanics parity review required; attach original evidence or document accepted product divergence.";
}

function severityForFunction(item) {
  const review = item.statusCounts["needs-mechanics-parity-review"] || 0;
  const extension = item.statusCounts["prototype-extension"] || 0;
  if (review >= 80) return "P1";
  if (review >= 20) return "P1";
  if (review > 0) return "P2";
  if (extension > 0) return "P2";
  return "P3";
}

const mainText = read(mainPath);
const mainLines = splitLines(mainText);
const functions = detectFunctions(mainLines);
const auditRows = parseLineAudit(lineAuditPath).filter((row) => row.file === "src/main.js");
const referenceAudit = readJson(referenceAuditPath);

const functionItems = functions.map((fn) => {
  const rows = auditRows.filter((row) => row.line >= fn.startLine && row.line <= fn.endLine);
  const statusCounts = {};
  const priorityCounts = {};
  const evidenceIds = [];
  const notes = [];

  for (const row of rows) {
    addCount(statusCounts, row.status);
    addCount(priorityCounts, row.priority);
    evidenceIds.push(...(row.evidenceIds || []));
    if (row.note && notes.length < 4 && !notes.includes(row.note)) notes.push(row.note);
  }

  const item = {
    name: fn.name,
    area: areaForFunction(fn.name),
    startLine: fn.startLine,
    endLine: fn.endLine,
    totalLines: rows.length,
    statusCounts: sortedEntries(statusCounts),
    priorityCounts: sortedEntries(priorityCounts),
    evidenceIds: uniqueSorted(evidenceIds),
    sampleNotes: notes,
  };
  item.severity = severityForFunction(item);
  item.requiredAction = actionForFunction(item);
  return item;
});

const totals = {
  functions: functionItems.length,
  auditedLines: auditRows.length,
  statusCounts: {},
  priorityCounts: {},
  areaReviewCounts: {},
};

for (const row of auditRows) {
  addCount(totals.statusCounts, row.status);
  addCount(totals.priorityCounts, row.priority);
}
totals.statusCounts = sortedEntries(totals.statusCounts);
totals.priorityCounts = sortedEntries(totals.priorityCounts);

for (const item of functionItems) {
  addCount(totals.areaReviewCounts, item.area, item.statusCounts["needs-mechanics-parity-review"] || 0);
}
totals.areaReviewCounts = Object.fromEntries(
  Object.entries(totals.areaReviewCounts).sort(([, a], [, b]) => b - a),
);

const reviewBacklog = functionItems
  .filter((item) => (item.statusCounts["needs-mechanics-parity-review"] || 0) > 0)
  .sort((a, b) => {
    const ar = a.statusCounts["needs-mechanics-parity-review"] || 0;
    const br = b.statusCounts["needs-mechanics-parity-review"] || 0;
    if (br !== ar) return br - ar;
    return a.startLine - b.startLine;
  });

const extensionBacklog = functionItems
  .filter((item) => (item.statusCounts["prototype-extension"] || 0) > 0)
  .sort((a, b) => {
    const ae = a.statusCounts["prototype-extension"] || 0;
    const be = b.statusCounts["prototype-extension"] || 0;
    if (be !== ae) return be - ae;
    return a.startLine - b.startLine;
  });

const report = {
  generatedAt: new Date().toISOString(),
  root,
  mainPath,
  lineAuditPath,
  referenceSummary: referenceAudit?.summary || null,
  totals,
  reviewBacklog: reviewBacklog.slice(0, 80),
  extensionBacklog: extensionBacklog.slice(0, 50),
  allFunctions: functionItems,
};

fs.writeFileSync(
  path.join(outputDir, "main_function_parity_audit_20260702.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);

function count(item, key) {
  return item.statusCounts[key] || 0;
}

function evidenceText(item) {
  return item.evidenceIds.length ? item.evidenceIds.slice(0, 4).join(", ") : "-";
}

const reviewRows = reviewBacklog.slice(0, 35).map((item) => (
  `| ${item.severity} | ${item.area} | \`${item.name}\` | ${item.startLine}-${item.endLine} | ${count(item, "needs-mechanics-parity-review")} | ${count(item, "mapped-to-original")} | ${count(item, "prototype-extension")} | ${evidenceText(item)} | ${item.requiredAction} |`
));

const extensionRows = extensionBacklog.slice(0, 25).map((item) => (
  `| ${item.severity} | ${item.area} | \`${item.name}\` | ${item.startLine}-${item.endLine} | ${count(item, "prototype-extension")} | ${count(item, "needs-mechanics-parity-review")} | ${item.requiredAction} |`
));

const md = [
  "# Main Function Parity Audit - 2026-07-02",
  "",
  "## Summary",
  "",
  `- Functions scanned: ${totals.functions}`,
  `- Audited \`src/main.js\` lines: ${totals.auditedLines}`,
  `- mapped-to-original: ${totals.statusCounts["mapped-to-original"] || 0}`,
  `- needs-mechanics-parity-review: ${totals.statusCounts["needs-mechanics-parity-review"] || 0}`,
  `- prototype-extension: ${totals.statusCounts["prototype-extension"] || 0}`,
  `- unmapped-neutral: ${totals.statusCounts["unmapped-neutral"] || 0}`,
  `- Reference consistency current findings: ${referenceAudit?.summary?.findings ?? "unknown"}`,
  `- Reference consistency P0 findings: ${referenceAudit?.summary?.p0Findings ?? "unknown"}`,
  "",
  "## Review Load By Area",
  "",
  "| Area | Review Lines |",
  "| --- | ---: |",
  ...Object.entries(totals.areaReviewCounts).map(([area, lines]) => `| ${area} | ${lines} |`),
  "",
  "## Highest Priority Function Backlog",
  "",
  "| Severity | Area | Function | Lines | Review | Mapped | Extension | Evidence | Adjustment Content |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
  ...reviewRows,
  "",
  "## Prototype / Polish Extension Backlog",
  "",
  "| Severity | Area | Function | Lines | Extension | Review | Adjustment Content |",
  "| --- | --- | --- | ---: | ---: | ---: | --- |",
  ...extensionRows,
  "",
  "## Next Work Order",
  "",
  "1. Resolve combat/progression functions first: spawn cadence, turret shooting, projectile orientation, damage/kill, Drone/Vacuum units, Boss state.",
  "2. Resolve UI/commercial gate functions second: tab availability, slot buttons, Galaxy/Boss panel, rewarded skill resolver, store preview/entitlement path.",
  "3. Keep presentation functions as reversible polish: tune through config, keep mobile particle/audio budgets, do not change core parity formulas.",
  "4. After each function batch, rerun `npm run check` and regenerate this report.",
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "main_function_parity_audit_20260702.md"), md, "utf8");

console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  functions: totals.functions,
  auditedLines: totals.auditedLines,
  reviewLines: totals.statusCounts["needs-mechanics-parity-review"] || 0,
  extensionLines: totals.statusCounts["prototype-extension"] || 0,
  topReviewFunctions: reviewBacklog.slice(0, 10).map((item) => ({
    name: item.name,
    area: item.area,
    line: item.startLine,
    reviewLines: count(item, "needs-mechanics-parity-review"),
  })),
}, null, 2));
