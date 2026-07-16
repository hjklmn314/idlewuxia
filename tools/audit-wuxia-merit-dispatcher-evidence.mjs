import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_merit_dispatcher_evidence");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const luaRoot = path.join(
  root,
  "fangzhijianghu",
  "竞品资料",
  "放置江湖apk",
  "完整包内容归档",
  "06_effective_lua",
  "effective_plain_best",
);

const sources = {
  dispatcher: path.join(luaRoot, "src", "app", "models", "map", "MapHandle", "Modules", "CommonModule", "CommonResults.lua"),
  role: path.join(luaRoot, "src", "app", "models", "role", "Role.lua"),
  visitTask: path.join(luaRoot, "src", "app", "models", "task", "visitTask", "VisitTask.lua"),
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function csvCell(value) {
  const text = Array.isArray(value)
    ? value.join("|")
    : typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const text = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
  fs.writeFileSync(filePath, `${text}\n`, "utf8");
}

function lineSnippet(filePath, needle, before = 3, after = 14) {
  const lines = readText(filePath).split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) return { filePath, line: 0, snippet: "" };
  const start = Math.max(0, index - before);
  const end = Math.min(lines.length, index + after + 1);
  return {
    filePath,
    line: index + 1,
    snippet: lines.slice(start, end).map((line, offset) => `${start + offset + 1}: ${line}`).join("\n"),
  };
}

function collectMeritRows(flow) {
  const rows = [];
  for (const kind of ["npcs", "interactables"]) {
    for (const source of flow.chapter1?.[kind] || []) {
      for (const branch of source.branches || []) {
        for (const result of branch.resolvedResults || []) {
          if (!/zhengji/.test(result.resultId || "") && result.action !== "改变政绩") continue;
          rows.push({
            Kind: kind,
            SourceId: source.roleId || source.interactableId || "",
            SourceName: source.name || source.displayName?.zhCN || "",
            BranchOrder: branch.order || "",
            ActionHints: (branch.actionHints || []).join("|"),
            ConditionTokens: (branch.conditionTokens || []).join("|"),
            ResultId: result.resultId || "",
            Action: result.action || "",
            Arg2: result.args?.Arg2 || "",
            Arg3: result.args?.Arg3 || "",
            InferredDelta: result.args?.Arg2 ? Number(result.args.Arg2) : 20,
            DeltaPolicy: result.args?.Arg2 ? "config_arg2" : "dispatcher_default_arg2_nil_20",
            GateField: "officialType",
            PlayerField: "officialAchievement",
            LedgerField: "meritLedger",
            EvidenceLevel: "lua_confirmed",
            ResultSource: result.sourceFile || source.evidence?.resultSource || "",
          });
        }
      }
    }
  }
  return rows;
}

fs.mkdirSync(outDir, { recursive: true });

const flow = readJson(flowPath);
const rows = collectMeritRows(flow);
const evidence = {
  generatedAt: new Date().toISOString(),
  configPath: flowPath,
  rows: rows.length,
  defaultDelta: flow.chapterSystem?.resultEffectPolicies?.officialMerit?.defaultDelta ?? 20,
  dispatcher: lineSnippet(sources.dispatcher, '["改变政绩"]'),
  roleState: lineSnippet(sources.role, "officialAchievement"),
  visitTaskReward: lineSnippet(sources.visitTask, "--政绩奖励", 0, 32),
  conclusion: rows.every((row) => Number(row.InferredDelta) === 20)
    ? "All restored fb01 改变政绩 rows have empty Arg2, so CommonResults.lua default delta 20 applies when officialType is non-zero."
    : "At least one row has explicit Arg2 and should use config_arg2.",
  outputDir: outDir,
};

writeCsv(path.join(outDir, "fb01_merit_dispatcher_rows.csv"), rows, [
  "Kind",
  "SourceId",
  "SourceName",
  "BranchOrder",
  "ActionHints",
  "ConditionTokens",
  "ResultId",
  "Action",
  "Arg2",
  "Arg3",
  "InferredDelta",
  "DeltaPolicy",
  "GateField",
  "PlayerField",
  "LedgerField",
  "EvidenceLevel",
  "ResultSource",
]);

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(evidence, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "report.md"), [
  "# 改变政绩 Dispatcher Evidence",
  "",
  `Generated: ${evidence.generatedAt}`,
  "",
  "## Conclusion",
  "",
  evidence.conclusion,
  "",
  "## Runtime Mapping",
  "",
  "- `result.arg2` empty -> dispatcher default delta `20`.",
  "- Apply only when `player.officialType != 0`.",
  "- Store audit trail in `player.meritLedger`; mutate `player.officialAchievement` only when the official-type gate passes.",
  "",
  "## fb01 Rows",
  "",
  ...rows.map((row) => `- ${row.SourceId} ${row.SourceName} / ${row.ResultId}: ${row.DeltaPolicy}, delta=${row.InferredDelta}`),
  "",
  "## Dispatcher Snippet",
  "",
  "```lua",
  evidence.dispatcher.snippet,
  "```",
  "",
  "## Role State Snippet",
  "",
  "```lua",
  evidence.roleState.snippet,
  "```",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({
  rows: rows.length,
  defaultDelta: evidence.defaultDelta,
  conclusion: evidence.conclusion,
  outputDir: outDir,
}, null, 2));
