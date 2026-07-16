import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const findings = [];

function add(severity, subject, issue, action) {
  findings.push({ severity, subject, issue, action });
}

function readText(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/^\uFEFF/, "");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const html = readText("index.html");
const moduleScripts = [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi)]
  .map((match) => match[1].replace(/^\.\//, ""));

if (moduleScripts.length !== 1) {
  add("P0", "index.html", `expected exactly one module script, got ${moduleScripts.length}`, "Keep one Wuxia entry module only.");
}

const activeEntry = moduleScripts[0] || "";
if (activeEntry !== "src/wuxia-main.js") {
  add("P0", "index.html", `active entry is ${activeEntry || "<missing>"}`, "Point index.html to src/wuxia-main.js.");
}

if (!activeEntry || !exists(activeEntry)) {
  add("P0", activeEntry || "activeEntry", "active entry file does not exist", "Create or restore the Wuxia first-session entry.");
}

const source = activeEntry && exists(activeEntry) ? readText(activeEntry) : "";
const forbiddenSignals = [
  ["offline_modal", /Welcome Back|Offline Cap|claim-offline|OFFLINE/i],
  ["nova_galaxy", /GALAXY|Nova Reactor|TURRET|tesla/i],
  ["legacy_canvas", /gameCanvas|fireTesla|applyBurn|bossNovaReactor/i],
  ["audit_copy", /当前录屏|待验证|暂按|APP备案|隐私政策|用户协议/],
];

for (const [id, regex] of forbiddenSignals) {
  const matches = source.match(regex) || [];
  if (matches.length) {
    add("P0", `${activeEntry}:${id}`, `forbidden legacy/audit copy in active entry: ${matches[0]}`, "Move old template code out of the active bundle.");
  }
}

const requiredConfigRefs = [
  "config/wuxia_first_session_flow.json",
  "config/wuxia_first_session_screen_contract.json",
  "config/wuxia_competitor_first_session_reference.json",
];

for (const rel of requiredConfigRefs) {
  if (!exists(rel)) add("P0", rel, "required first-session config is missing", "Restore config before running the client.");
  if (source && !source.includes(rel.replace(/\\/g, "/"))) {
    add("P1", activeEntry, `active entry does not reference ${rel}`, "Load the first-session config from the isolated entry.");
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  activeEntry,
  moduleScripts,
  findings: findings.length,
  bySeverity: findings.reduce((acc, row) => {
    acc[row.severity] = (acc[row.severity] || 0) + 1;
    return acc;
  }, {}),
};

console.log(JSON.stringify({ ...summary, findings }, null, 2));
if ((summary.bySeverity.P0 || 0) > 0) process.exitCode = 1;
