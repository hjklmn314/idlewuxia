import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const originalJsPath = path.resolve(root, "..", "apk_contents", "focused_game_monetization", "game_web", "index-DINbkGXA.linebreak.js");
const outputDir = path.join(root, "outputs", "current_vs_original_code_audit");
const includeExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".txt"]);
const skipDirs = new Set(["node_modules", "dist", "outputs", ".git", ".tmp-edge-profile", "android", "www"]);
const skipDirectoryPrefixes = ["public/original-game/"];

fs.mkdirSync(outputDir, { recursive: true });

function readLines(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path.relative(root, full).replaceAll(path.sep, "/");
      if (skipDirectoryPrefixes.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix))) continue;
      walk(full, files);
      continue;
    }
    if (includeExtensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

const originalLines = fs.existsSync(originalJsPath) ? readLines(originalJsPath) : [];

const evidenceQueries = [
  { id: "engine.react_vite_canvas", terms: ["createRoot", "canvas", "Capacitor"], note: "Original product body is WebView + React/Vite + Canvas." },
  { id: "upgrade.enum", terms: ["SHOOTER_COUNT", "DOT_SPAWN_RATE", "LUCK"], note: "Original upgrade enum and economic keys." },
  { id: "upgrade.base_costs", terms: ["[b.SHOOTER_COUNT]:100", "[b.FREQUENCY]:1", "[b.DAMAGE]:75"], note: "Original base upgrade costs." },
  { id: "upgrade.growth_rates", terms: ["[b.SHOOTER_COUNT]:3.5", "[b.FREQUENCY]:1.5", "[b.DAMAGE]:1.45"], note: "Original cost growth rates." },
  { id: "drone.unlock_slots", terms: ["[1,3,5,8,20,30]", "fo=6"], note: "Original Drone slot requirements and max slots." },
  { id: "vacuum.unlock_slots", terms: ["[2,4,6,8]", "mo=4"], note: "Original Vacuum slot requirements and max slots." },
  { id: "bottom.tabs", terms: ["Defense", "Drone", "Vacuum", "Economy", "Galaxy"], note: "Original five-tab shell." },
  { id: "drone.tab", terms: ["UNLOCK DRONE", "COLLECTOR_HULL", "COLLECTOR_AGILITY"], note: "Original Drone tab placeholders and upgrades." },
  { id: "vacuum.tab", terms: ["UNLOCK VACUUM", "VACUUM_SPEED", "VACUUM_SUCTION"], note: "Original Vacuum tab placeholders and upgrades." },
  { id: "economy.tab", terms: ["DOT_COUNT", "DOT_VALUE", "DOT_SPAWN_RATE", "LUCK"], note: "Original Economy tab upgrade keys." },
  { id: "galaxy.tab", terms: ["Next Galaxy", "unlocksFeature"], note: "Original Galaxy tab travel panel." },
  { id: "combat.dps_formula", terms: ["DAMAGE", "FREQUENCY", "DOT_VALUE", "*10"], note: "Original multiplicative DPS estimate." },
  { id: "canvas.combat", terms: ["unlockedDroneSlots", "unlockedVacuumSlots", "screenShakeEnabled"], note: "Original Canvas props for combat and helper systems." },
  { id: "monetization.flags", terms: ["banner_ads_enabled", "InAppPurchase", "rewarded"], note: "Original IAA/IAP chain references." },
];

function lineMatchesAny(line, terms) {
  return terms.some((term) => line.includes(term));
}

const evidenceIndex = {};
for (const query of evidenceQueries) {
  const hits = [];
  for (let i = 0; i < originalLines.length; i += 1) {
    if (lineMatchesAny(originalLines[i], query.terms)) {
      hits.push({
        line: i + 1,
        hash: hash(originalLines[i]),
        preview: originalLines[i].trim().slice(0, 180),
      });
      if (hits.length >= 8) break;
    }
  }
  evidenceIndex[query.id] = { ...query, hits };
}

const classifierRules = [
  { id: "ui.unlock_config", evidence: ["drone.unlock_slots", "vacuum.unlock_slots"], test: (rel, line) => rel.includes("original_ui_unlocks") || /unlock|slotRequirementsGalaxy|maxSlots/.test(line) },
  { id: "bottom_tabs", evidence: ["bottom.tabs"], test: (rel, line) => /bottom-tab|data-tab-target|data-tab-page|DEFENSE|DRONE|VACUUM|ECONOMY|GALAXY/.test(line) },
  { id: "drone_tab", evidence: ["drone.tab", "drone.unlock_slots"], test: (rel, line) => /droneWing|droneFocus|droneLoop|UNLOCK DRONE|COLLECTOR_/.test(line) },
  { id: "vacuum_tab", evidence: ["vacuum.tab", "vacuum.unlock_slots"], test: (rel, line) => /vacuumPull|vacuumChain|vacuumSurge|UNLOCK VACUUM|VACUUM_/.test(line) },
  { id: "economy_tab", evidence: ["economy.tab", "upgrade.base_costs", "upgrade.growth_rates"], test: (rel, line) => /capacity|spawn|luck|DOT_|economy/.test(line) },
  { id: "combat", evidence: ["combat.dps_formula", "canvas.combat"], test: (rel, line) => /damagePerShot|fireInterval|expectedDps|projectile|boss|killDot|spawnDot|canvas|ctx\./.test(line) },
  { id: "resource", evidence: ["engine.react_vite_canvas"], test: (rel, line) => rel.includes("public") || /original-game|asset_manifest|icon\.png|splash/.test(line) },
  { id: "monetization", evidence: ["monetization.flags"], test: (rel, line) => /admob|rewarded|iap|purchase|store|ads|monetization/i.test(line) },
  { id: "prototype_debug", evidence: [], test: (rel, line) => /debug|DemoDirector|demo|QA|prototype-only/i.test(line) },
];

function classify(rel, line) {
  const matches = classifierRules.filter((rule) => rule.test(rel, line));
  const evidenceIds = [...new Set(matches.flatMap((match) => match.evidence))];
  let status = "unmapped-neutral";
  let priority = "P3";
  let note = "No direct original evidence needed for this neutral line.";

  if (matches.some((match) => match.id === "prototype_debug")) {
    status = "prototype-extension";
    priority = "P2";
    note = "Prototype/debug behavior should stay hidden from normal product parity unless explicitly enabled.";
  }
  if (matches.some((match) => ["bottom_tabs", "drone_tab", "vacuum_tab", "economy_tab", "ui.unlock_config"].includes(match.id))) {
    status = "mapped-to-original";
    priority = "P1";
    note = "Mapped to known original UI/config evidence.";
  }
  if (matches.some((match) => match.id === "combat")) {
    status = status === "mapped-to-original" ? status : "needs-mechanics-parity-review";
    priority = "P1";
    note = "Combat code needs parity checks against original Canvas formulas and helper-system gates.";
  }
  if (rel.includes("config") && line.includes("missingInPrototype")) {
    status = "known-gap";
    priority = "P0";
    note = "Explicitly recorded original system that still needs implementation.";
  }
  if (rel.endsWith("index.html") && /galaxyBossBtn|galaxyProgressBtn|galaxySkinBtn/.test(line)) {
    status = "known-gap";
    priority = "P0";
    evidenceIds.push("galaxy.tab");
    note = "Current Galaxy tab is still prototype cards; original uses a Next Galaxy panel.";
  }
  return { status, priority, evidenceIds: [...new Set(evidenceIds)], note };
}

const files = walk(root).sort((a, b) => a.localeCompare(b));
const auditRows = [];
const summary = {
  generatedAt: new Date().toISOString(),
  root,
  originalJsPath,
  filesAudited: 0,
  linesAudited: 0,
  statusCounts: {},
  priorityCounts: {},
  knownGaps: [],
};

for (const file of files) {
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  const lines = readLines(file);
  summary.filesAudited += 1;
  summary.linesAudited += lines.length;
  lines.forEach((text, index) => {
    const classification = classify(rel, text);
    summary.statusCounts[classification.status] = (summary.statusCounts[classification.status] || 0) + 1;
    summary.priorityCounts[classification.priority] = (summary.priorityCounts[classification.priority] || 0) + 1;
    if (classification.status === "known-gap") {
      summary.knownGaps.push({ file: rel, line: index + 1, note: classification.note });
    }
    auditRows.push({
      file: rel,
      line: index + 1,
      hash: hash(text),
      textPreview: text.trim().slice(0, 160),
      ...classification,
      originalEvidence: classification.evidenceIds.map((id) => ({
        id,
        lines: (evidenceIndex[id]?.hits || []).map((hit) => hit.line),
      })),
    });
  });
}

fs.writeFileSync(path.join(outputDir, "line_audit.jsonl"), auditRows.map((row) => JSON.stringify(row)).join("\n"), "utf8");
fs.writeFileSync(path.join(outputDir, "evidence_index.json"), JSON.stringify(evidenceIndex, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

const summaryMd = [
  "# Current Code vs Original APK Audit",
  "",
  `Generated: ${summary.generatedAt}`,
  `Files audited: ${summary.filesAudited}`,
  `Lines audited: ${summary.linesAudited}`,
  "",
  "## Status Counts",
  "",
  ...Object.entries(summary.statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Priority Counts",
  "",
  ...Object.entries(summary.priorityCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## P0 Known Gaps",
  "",
  ...(summary.knownGaps.length
    ? summary.knownGaps.slice(0, 80).map((gap) => `- ${gap.file}:${gap.line} - ${gap.note}`)
    : ["- None detected by script."]),
  "",
  "## Evidence Anchors",
  "",
  ...Object.entries(evidenceIndex).map(([id, evidence]) => `- ${id}: ${evidence.note} Lines: ${(evidence.hits || []).map((hit) => hit.line).join(", ") || "not found"}`),
  "",
  "## Immediate Parity Priorities",
  "",
  "- Wire rewarded-skill, slot-unlock, and Galaxy rewarded placements to a real AdMob SSV/backend reward resolver; current grants are local QA/runtime stubs.",
  "- Replace preview/local IAP fulfillment with Google Play/App Store product IDs plus backend entitlement refresh, using config/iap_product_catalog.json as the contract source.",
  "- Continue decomposing original minified combat helper formulas so config/weapon_runtime_tuning.json can graduate from documented overlay to fully reference-derived values.",
  "- Keep mobile visual parity verification active against device screenshots: safe-area layout, tab content, helper units, projectile rotation, dot population timing, and Galaxy panel state.",
].join("\n");

fs.writeFileSync(path.join(outputDir, "summary.md"), summaryMd, "utf8");
console.log(JSON.stringify(summary, null, 2));
