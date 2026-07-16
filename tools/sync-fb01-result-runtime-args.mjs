import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const resultPath = path.join(
  root,
  "fangzhijianghu",
  "outputs",
  "fzjh_chapter1_planning_audit_20260622",
  "chapter1_results.csv",
);
const conditionLuaPath = path.join(
  root,
  "fangzhijianghu",
  "竞品资料",
  "放置江湖apk",
  "完整包内容归档",
  "06_effective_lua",
  "effective_plain_best",
  "res",
  "script",
  "map",
  "mapConditionAndResult",
  "fb01.lua",
);
const outDir = path.join(root, "outputs", "wuxia_fb01_result_runtime_args_sync");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter((item) => item.length > 1 || item[0]);
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ""), values[index] ?? ""])));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resultKey(id = "") {
  return String(id || "").replace(/^rlt_/, "");
}

function splitNarrativeLines(raw = "") {
  return String(raw || "")
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseLuaValue(raw = "") {
  const trimmed = String(raw || "").trim();
  if (/^\[\[/.test(trimmed)) return trimmed.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed.replace(/^"+|"+$/g, "");
}

function parseConditionLookup(luaText = "") {
  const lookup = {};
  const entryPattern = /\["con_([^"]+)"\]=\{([^{}]*?)\}/g;
  let match = entryPattern.exec(luaText);
  while (match) {
    const [, token, body] = match;
    const entry = { conditionId: `con_${token}` };
    const argPattern = /\["(arg\d+|id)"\]=(?:\[\[([\s\S]*?)\]\]|([^,}]+))/g;
    let argMatch = argPattern.exec(body);
    while (argMatch) {
      const [, key, bracketValue, rawValue] = argMatch;
      entry[key] = parseLuaValue(bracketValue !== undefined ? `[[${bracketValue}]]` : rawValue);
      argMatch = argPattern.exec(body);
    }
    lookup[token] = entry;
    match = entryPattern.exec(luaText);
  }
  return lookup;
}

const flow = readJson(flowPath);
const resultRows = parseCsv(fs.readFileSync(resultPath, "utf8").replace(/^\uFEFF/, ""));
const byId = new Map();
for (const row of resultRows) {
  if (!row.ResultId) continue;
  byId.set(row.ResultId, row);
  byId.set(resultKey(row.ResultId), row);
}

flow.chapter1 = flow.chapter1 || {};
flow.chapter1.resultLookup = Object.fromEntries(
  resultRows
    .filter((row) => row.ResultId)
    .map((row) => {
      const key = resultKey(row.ResultId);
      return [key, {
        resultId: key,
        rawResultId: row.ResultId,
        category: row.Category || "",
        action: row.Action || "",
        args: {
          Arg2: row.Arg2 || "",
          Arg3: row.Arg3 || "",
          Arg4: row.Arg4 || "",
          Arg5: row.Arg5 || "",
          Arg6: row.Arg6 || "",
          Arg7: row.Arg7 || "",
        },
        narrativeLines: splitNarrativeLines(row.Arg2),
        sourceFile: row.SourceFile || "",
      }];
    }),
);
flow.chapter1.conditionLookup = fs.existsSync(conditionLuaPath)
  ? parseConditionLookup(fs.readFileSync(conditionLuaPath, "utf8").replace(/^\uFEFF/, ""))
  : {};

let resolvedResults = 0;
let updatedResults = 0;
let missingRows = 0;

for (const collectionName of ["npcs", "interactables"]) {
  for (const source of flow.chapter1?.[collectionName] || []) {
    for (const branch of source.branches || []) {
      for (const result of branch.resolvedResults || []) {
        resolvedResults += 1;
        const sourceRow = byId.get(result.resultId);
        if (!sourceRow) {
          missingRows += 1;
          continue;
        }
        const args = {
          Arg2: sourceRow.Arg2 || "",
          Arg3: sourceRow.Arg3 || "",
          Arg4: sourceRow.Arg4 || "",
          Arg5: sourceRow.Arg5 || "",
          Arg6: sourceRow.Arg6 || "",
          Arg7: sourceRow.Arg7 || "",
        };
        result.args = args;
        result.sourceFile = sourceRow.SourceFile || result.sourceFile || "";
        result.category = sourceRow.Category || result.category || "";
        result.action = sourceRow.Action || result.action || "";
        updatedResults += 1;
      }
    }
  }
}

writeJson(flowPath, flow);
fs.mkdirSync(outDir, { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  flowPath,
  resultPath,
  conditionLuaPath,
  resolvedResults,
  updatedResults,
  missingRows,
  resultLookupRows: Object.keys(flow.chapter1.resultLookup || {}).length,
  conditionLookupRows: Object.keys(flow.chapter1.conditionLookup || {}).length,
};
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
