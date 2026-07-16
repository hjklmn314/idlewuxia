import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_content_data_driven_boundary");
const strict = process.argv.includes("--strict");

fs.mkdirSync(outDir, { recursive: true });

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  fs.writeFileSync(
    filePath,
    `${[
      columns.join(","),
      ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
    ].join("\n")}\n`,
    "utf8",
  );
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function collectActiveRuntimeFiles() {
  const indexText = readText("index.html");
  const scripts = [...indexText.matchAll(/<script[^>]+src=["']\.\/([^"']+)["']/g)].map((match) => match[1]);
  const active = new Set(["index.html", ...scripts]);
  const queue = [...scripts];
  while (queue.length) {
    const relativePath = queue.shift();
    const text = readText(relativePath);
    for (const match of text.matchAll(/import\s+[^"']*["'](\.\/[^"']+)["']/g)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), match[1]));
      if (!active.has(resolved)) {
        active.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...active].sort();
}

const activeFiles = collectActiveRuntimeFiles();
const config = JSON.parse(readText("config/wuxia_first_session_flow.json"));
const screenContract = JSON.parse(readText("config/wuxia_first_session_screen_contract.json"));

const highRiskPatterns = [
  {
    id: "chapter_id_literal",
    severity: "high",
    pattern: /\bfb\d{2}\b|NODE_FB\d{2}|REWARD_FB\d{2}|ENC_FB\d{2}|GATE_FB\d{2}|fb\d{2}r\d+|fb\d{2}item_\d+/g,
    reason: "Concrete chapter/map/NPC/item IDs must live in config, not active runtime code.",
  },
  {
    id: "content_copy_literal",
    severity: "high",
    pattern: /无名少女|池边打鱼|武馆|书房|馆主卧室|老管家|张风|朱宇|赵教头|周教头|前厅|大厅挑战|华山|师门/g,
    reason: "Player-facing story, NPC, room, sect, and task text must be config-driven.",
  },
  {
    id: "specific_result_literal",
    severity: "high",
    pattern: /mapbj\d+|gorome\d+|rlt_[A-Za-z0-9_]+|con_[A-Za-z0-9_]+/g,
    reason: "Competitor condition/result tokens must be interpreted from config rows.",
  },
];

const mediumRiskPatterns = [
  {
    id: "first_chapter_property",
    severity: "medium",
    pattern: /chapter1/g,
    reason: "Runtime should prefer active chapter access; chapter1 is allowed only as legacy config compatibility.",
  },
  {
    id: "hardcoded_reward_field",
    severity: "medium",
    pattern: /\bexperience\b|\bpotential\b|\byueli\b|\bmoney\b|\bhp\b|\bmp\b|\bspirit\b/g,
    reason: "Framework may bind generic fields, but concrete reward grant rules should come from rewardAttributeMap/reward rows.",
  },
];

const allowedMediumContexts = [
  "flowContract?.chapter1",
  "snapshot?.chapter1",
  "|| contract?.chapter1",
  "chapter1: chapterSnapshot",
  "rewardAttributeMap",
  "playerStatValue",
  "renderCombatBar",
  "renderCombatRuntimeUnit",
];

const findings = [];
for (const relativePath of activeFiles) {
  const text = readText(relativePath);
  for (const rule of [...highRiskPatterns, ...mediumRiskPatterns]) {
    for (const match of text.matchAll(rule.pattern)) {
      const line = lineNumberAt(text, match.index || 0);
      const lineText = text.split(/\r?\n/)[line - 1]?.trim() || "";
      const allowed = rule.severity === "medium" && allowedMediumContexts.some((context) => lineText.includes(context));
      findings.push({
        file: relativePath,
        line,
        token: match[0],
        ruleId: rule.id,
        severity: allowed ? "allowed_compat" : rule.severity,
        reason: allowed ? "Compatibility or generic field binding; keep bounded and do not add new concrete content here." : rule.reason,
        lineText,
      });
    }
  }
}

const chapterRows = [];
const chapter = config.chapter || config.activeChapter || config.chapter1 || {};
chapterRows.push({
  chapterKey: config.chapter ? "chapter" : config.activeChapter ? "activeChapter" : "chapter1",
  chapterId: chapter.chapterId || "",
  nodes: chapter.nodes?.length || 0,
  rooms: chapter.rooms?.length || 0,
  npcs: chapter.npcs?.length || 0,
  interactables: chapter.interactables?.length || 0,
  enemies: chapter.enemies?.length || chapter.npcs?.filter((npc) => (npc.actions || []).some((action) => action.actionType === "compete")).length || 0,
  rewards: chapter.rewards?.length || 0,
  gates: chapter.gates?.length || 0,
  resultTokens: Object.keys(chapter.resultLookup || {}).length,
  conditionTokens: Object.keys(chapter.conditionLookup || {}).length,
  status: chapter.nodes?.length && chapter.rooms?.length && chapter.npcs?.length ? "content_in_config" : "incomplete_config",
});

const screenRows = Object.entries(screenContract.screens || {}).map(([screenId, screen]) => ({
  screenId,
  mode: screen.mode || "",
  primaryActionId: screen.primaryActionId || "",
  hasBodyConfig: Array.isArray(screen.body) && screen.body.length > 0 ? "yes" : "no",
  status: Array.isArray(screen.body) && screen.body.length > 0 ? "config_driven_screen" : "missing_body",
}));

const summary = {
  generatedAt: new Date().toISOString(),
  activeFiles,
  counts: {
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    allowedCompat: findings.filter((finding) => finding.severity === "allowed_compat").length,
    total: findings.length,
  },
  chapterRows,
  screenCount: screenRows.length,
  passStrict: findings.filter((finding) => finding.severity === "high").length === 0,
};

writeCsv(path.join(outDir, "content_hardcode_findings.csv"), findings, [
  "severity",
  "ruleId",
  "file",
  "line",
  "token",
  "reason",
  "lineText",
]);
writeCsv(path.join(outDir, "chapter_content_config_matrix.csv"), chapterRows, [
  "chapterKey",
  "chapterId",
  "nodes",
  "rooms",
  "npcs",
  "interactables",
  "enemies",
  "rewards",
  "gates",
  "resultTokens",
  "conditionTokens",
  "status",
]);
writeCsv(path.join(outDir, "screen_config_matrix.csv"), screenRows, [
  "screenId",
  "mode",
  "primaryActionId",
  "hasBodyConfig",
  "status",
]);
writeJson(path.join(outDir, "summary.json"), summary);

fs.writeFileSync(path.join(outDir, "content_data_driven_boundary_report.md"), [
  "# Wuxia Content Data-Driven Boundary Audit",
  "",
  "## Conclusion",
  "",
  summary.passStrict
    ? "Active runtime has no high-risk concrete content hardcoding. Any remaining medium rows are compatibility/generic-binding rows and must not grow."
    : "Active runtime still contains high-risk concrete content hardcoding. These rows must move to config before this stage can be called architecture-clean.",
  "",
  "## Counts",
  "",
  `- Active files: ${activeFiles.join(", ")}`,
  `- High: ${summary.counts.high}`,
  `- Medium: ${summary.counts.medium}`,
  `- Allowed compatibility: ${summary.counts.allowedCompat}`,
  "",
  "## Outputs",
  "",
  "- content_hardcode_findings.csv",
  "- chapter_content_config_matrix.csv",
  "- screen_config_matrix.csv",
  "- summary.json",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify(summary, null, 2));
if (strict && !summary.passStrict) process.exit(1);
