import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const outputDir = path.join(root, "outputs", "wuxia_fb01_npc_action_sync");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function sourcePriority(filePath) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("effective_plain_best")) return 0;
  if (normalized.includes("plain")) return 5;
  if (normalized.includes("effective_raw_current")) return 50;
  return 10;
}

function findFile(startDir, relativeParts) {
  const targetSuffix = path.join(...relativeParts).toLowerCase();
  const candidates = [];
  const direct = path.join(startDir, ...relativeParts);
  if (fs.existsSync(direct)) candidates.push(direct);

  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git'].includes(entry.name)) stack.push(fullPath);
      } else if (fullPath.toLowerCase().endsWith(targetSuffix)) {
        candidates.push(fullPath);
      }
    }
  }

  const uniqueCandidates = [...new Set(candidates)];
  uniqueCandidates.sort((a, b) => sourcePriority(a) - sourcePriority(b) || a.localeCompare(b));
  if (uniqueCandidates.length) return uniqueCandidates[0];
  throw new Error(`Unable to locate ${targetSuffix}`);
}

function isEncryptedLua(source) {
  const head = String(source || '').trimStart().slice(0, 96);
  return head.startsWith('JHHU') || /^[0-9a-f]{64,}$/i.test(head);
}
function parseLuaLongString(source, start) {
  if (source[start] !== "[" || source[start + 1] !== "[") return null;
  const end = source.indexOf("]]", start + 2);
  if (end < 0) return null;
  return {
    value: source.slice(start + 2, end),
    end: end + 2,
  };
}

function findMatchingBrace(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const longString = parseLuaLongString(source, index);
    if (longString) {
      index = longString.end - 1;
      continue;
    }
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseLuaValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (value.startsWith("[[") && value.endsWith("]]")) return value.slice(2, -2);
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function parseLuaRecord(recordSource) {
  const record = {};
  const fieldPattern = /\["([^"]+)"\]\s*=\s*(\[\[[\s\S]*?\]\]|-?\d+(?:\.\d+)?|true|false)/g;
  let match;
  while ((match = fieldPattern.exec(recordSource))) {
    record[match[1]] = parseLuaValue(match[2]);
  }
  return record;
}

function parseLuaTable(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (isEncryptedLua(source)) throw new Error(`Encrypted Lua selected instead of plaintext: ${filePath}`);
  const bodyStart = source.indexOf("{");
  if (bodyStart < 0) throw new Error(`Lua table body not found: ${filePath}`);
  const records = new Map();
  let cursor = bodyStart + 1;
  while (cursor > 0 && cursor < source.length) {
    const keyStart = source.indexOf("[\"", cursor);
    if (keyStart < 0) break;
    const keyEnd = source.indexOf("\"]", keyStart + 2);
    if (keyEnd < 0) break;
    const recordId = source.slice(keyStart + 2, keyEnd);
    const recordStart = source.indexOf("{", keyEnd);
    if (recordStart < 0) break;
    const recordEnd = findMatchingBrace(source, recordStart);
    if (recordEnd < 0) break;
    records.set(recordId, parseLuaRecord(source.slice(recordStart + 1, recordEnd)));
    cursor = recordEnd + 1;
  }
  return records;
}

function truthyFlag(value) {
  return String(value || "").trim() === "1";
}

function cleanNarrative(value) {
  return String(value || "")
    .replace(/\b(?:YEL|HIR|HIC|HIB|HIG|HIW|NOR|NORYEL|RED|GRN|BLU|CYN|MAG|WHT)\b/g, "")
    .replace(/\$IN|\$S/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitWords(value) {
  return String(value || "")
    .split(";")
    .map(cleanNarrative)
    .filter(Boolean);
}

function operationKeys(fields) {
  const keys = [];
  for (const key of ["caozuo", "caozuo1", "caozuo2", "caozuo3", "caozuo4", "caozuo5", "caozuo6", "caozuo7", "caozuo8"]) {
    const suffix = key === "caozuo" ? "" : key.slice("caozuo".length);
    const labelKey = key === "caozuo" ? "caozuoName" : `caozuoName${suffix}`;
    if (truthyFlag(fields[key]) || fields[labelKey]) keys.push({ key, labelKey });
  }
  return keys;
}

function actionTypeForOperation(key) {
  return `custom_${key}`;
}

function appendUniqueAction(actions, action) {
  if (actions.some((existing) => existing.actionType === action.actionType)) return false;
  actions.push(action);
  return true;
}

const flow = readJson(flowPath);
const luaPath = findFile(path.join(root, "fangzhijianghu"), ["res", "script", "map", "mapRole", "fb01.lua"]);
const roleFields = parseLuaTable(luaPath);
const reportRows = [];
let updatedDefaultWords = 0;
let addedCustomActions = 0;
let updatedBranchHints = 0;

for (const npc of flow.chapter1?.npcs || []) {
  const fields = roleFields.get(npc.roleId);
  if (!fields) continue;

  const words = splitWords(fields.words);
  if (words.length && (!Array.isArray(npc.defaultNarrativeLines) || npc.defaultNarrativeLines.length === 0)) {
    npc.defaultNarrativeLines = words;
    updatedDefaultWords += 1;
    reportRows.push({
      roleId: npc.roleId,
      name: npc.name || "",
      changeType: "default_words",
      sourceField: "words",
      actionType: "",
      label: "",
      value: words.join(" | "),
      evidenceLevel: "lua_confirmed",
    });
  }

  const operations = operationKeys(fields);
  if (operations.length) {
    npc.customOperations = operations.map(({ key, labelKey }) => ({
      operationKey: key,
      actionType: actionTypeForOperation(key),
      label: fields[labelKey] || "鎿嶄綔",
      sourceField: labelKey,
      evidenceLevel: "lua_confirmed",
    }));
  }

  for (const operation of operations) {
    const actionType = actionTypeForOperation(operation.key);
    const label = fields[operation.labelKey] || "鎿嶄綔";
    if (appendUniqueAction(npc.actions ||= [], {
      actionType,
      label,
      sourceField: operation.key,
      sourceLabelField: operation.labelKey,
      evidenceLevel: "lua_confirmed",
      actionRole: "custom_operation",
    })) {
      addedCustomActions += 1;
      reportRows.push({
        roleId: npc.roleId,
        name: npc.name || "",
        changeType: "custom_action",
        sourceField: `${operation.key}/${operation.labelKey}`,
        actionType,
        label,
        value: label,
        evidenceLevel: "lua_confirmed",
      });
    }
  }

  for (const branch of npc.branches || []) {
    const conditionTokens = branch.conditionTokens || [];
    for (const operation of operations) {
      if (!conditionTokens.includes(operation.key)) continue;
      const actionType = actionTypeForOperation(operation.key);
      branch.actionHints = (branch.actionHints || []).filter((hint) => !(hint === "talk" && conditionTokens.includes(operation.key)));
      if (!branch.actionHints.includes(actionType)) {
        branch.actionHints.push(actionType);
        updatedBranchHints += 1;
      }
    }
  }
}

writeJson(flowPath, flow);
ensureDir(outputDir);
writeCsv(path.join(outputDir, "fb01_npc_action_sync.csv"), reportRows, [
  "roleId",
  "name",
  "changeType",
  "sourceField",
  "actionType",
  "label",
  "value",
  "evidenceLevel",
]);

const summary = {
  generatedAt: new Date().toISOString(),
  luaPath,
  updatedDefaultWords,
  addedCustomActions,
  updatedBranchHints,
  reportRows: reportRows.length,
  outputDir,
};
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));



