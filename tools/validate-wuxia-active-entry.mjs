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

const scope = JSON.parse(readText("config/project_scope.json"));
const html = readText(scope.htmlEntry);
const moduleScripts = [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi)].map((match) =>
  match[1].replace(/^\.\//, ""),
);

if (moduleScripts.length !== 1) {
  add("P0", scope.htmlEntry, `expected exactly one module script, got ${moduleScripts.length}`, "Keep one Wuxia entry module only.");
}

const activeEntry = moduleScripts[0] || "";
if (activeEntry !== scope.activeEntry) {
  add("P0", scope.htmlEntry, `active entry is ${activeEntry || "<missing>"}`, `Point index.html to ${scope.activeEntry}.`);
}

if (!activeEntry || !exists(activeEntry)) {
  add("P0", activeEntry || "activeEntry", "active entry file does not exist", "Create or restore the Wuxia first-session entry.");
}

const activeRuntimeText = scope.activeRuntimeFiles
  .filter((rel) => exists(rel) && /\.(?:html|js|mjs|ts|css)$/i.test(rel))
  .map(readText)
  .join("\n");
const source = activeEntry && exists(activeEntry) ? readText(activeEntry) : "";
const forbiddenSignals = [
  ["offline_modal", /Welcome Back|Offline Cap|claim-offline|OFFLINE/i],
  ["nova_galaxy", /GALAXY|Nova Reactor|TURRET|tesla/i],
  ["legacy_canvas", /gameCanvas|fireTesla|applyBurn|bossNovaReactor/i],
  ["audit_copy", /褰撳墠褰曞睆|寰呴獙璇亅鏆傛寜|APP澶囨|闅愮鏀跨瓥|鐢ㄦ埛鍗忚/],
];

for (const [id, regex] of forbiddenSignals) {
  const matches = source.match(regex) || [];
  if (matches.length) {
    add("P0", `${activeEntry}:${id}`, `forbidden legacy/audit copy in active entry: ${matches[0]}`, "Move old template code out of the active bundle.");
  }
}

for (const rel of scope.activeConfigFiles) {
  if (!exists(rel)) add("P0", rel, "required first-session config is missing", "Restore config before running the client.");
  if (!activeRuntimeText.includes(rel)) {
    add("P0", scope.activeEntry, `active runtime does not reference ${rel}`, "Load every declared runtime config from the isolated entry.");
  }
}

for (const rel of scope.developmentReferenceFiles) {
  if (activeRuntimeText.includes(rel)) {
    add("P0", rel, "development-only evidence is loaded by active runtime", "Keep competitor evidence outside the shipping runtime closure.");
  }
  if (scope.shippingFiles.includes(rel)) {
    add("P0", rel, "development-only evidence is included in shippingFiles", "Remove it from the shipping whitelist.");
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  activeEntry,
  moduleScripts,
  runtimeConfigs: scope.activeConfigFiles,
  shippingFiles: scope.shippingFiles.length,
  findings: findings.length,
  bySeverity: findings.reduce((acc, row) => {
    acc[row.severity] = (acc[row.severity] || 0) + 1;
    return acc;
  }, {}),
};

console.log(JSON.stringify({ ...summary, findings }, null, 2));
if ((summary.bySeverity.P0 || 0) > 0) process.exitCode = 1;
