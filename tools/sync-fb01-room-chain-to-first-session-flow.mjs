import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const levelNodesPath = path.join(
  root,
  "fangzhijianghu",
  "outputs",
  "fzjh_chapter1_planning_audit_20260622",
  "chapter1_level_nodes.csv",
);
const npcPath = path.join(
  root,
  "fangzhijianghu",
  "outputs",
  "fzjh_chapter1_planning_audit_20260622",
  "chapter1_npc_interactions.csv",
);
const resultsPath = path.join(
  root,
  "fangzhijianghu",
  "outputs",
  "fzjh_chapter1_planning_audit_20260622",
  "chapter1_results.csv",
);
const mapItemPath = path.join(
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
  "mapItem",
  "fb01.lua",
);

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

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseConnections(value) {
  return splitPipe(value).map((entry) => {
    const [direction, roomId] = entry.split(":").map((item) => item.trim());
    return {
      direction: direction || "",
      roomId: roomId || entry,
    };
  });
}

function parseGateTokens(value) {
  return String(value || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, rawValue = ""] = entry.split("=").map((item) => item.trim());
      return {
        key,
        value: rawValue,
      };
    });
}

function splitSemi(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
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

function narrativeLinesForResult(row) {
  if (!row || row.Category !== "narrative_feedback") return [];
  return [row.Arg2, row.Arg3, row.Arg4]
    .flatMap((value) => String(value || "").split("|"))
    .map(cleanNarrative)
    .filter(Boolean);
}

function actionHintsForCondition(tokens) {
  const values = new Set(tokens);
  const hints = [];
  if (values.has("talk")) hints.push("talk");
  if (values.has("comparewin") || values.has("comparelose")) hints.push("compete");
  if (values.has("gift")) hints.push("present");
  if (values.has("kill")) hints.push("kill");
  if (values.has("sale")) hints.push("sale");
  if (values.has("apprentice")) hints.push("apprentice");
  if (values.has("caozuo") && !hints.length) hints.push("talk");
  return hints;
}

function itemActionHintsForCondition(tokens) {
  const values = new Set(tokens);
  return ["use", "use1", "use2", "use3", "use4", "open", "pickup", "give", "extract"]
    .filter((actionType) => values.has(actionType));
}

function buildResultIndex(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!row.ResultId) continue;
    byId.set(row.ResultId, row);
    if (row.ResultId.startsWith("rlt_")) byId.set(row.ResultId.slice(4), row);
  }
  return byId;
}

function buildNpcActions(row) {
  return [
    ["talk", "交谈", row.CanTalk],
    ["compete", "切磋", row.CanCompete],
    ["kill", "杀死", row.CanKill],
    ["present", "送礼", row.CanPresent],
    ["sale", "交易", row.CanSale],
    ["apprentice", "拜师", row.CanApprentice],
  ]
    .filter(([, , value]) => truthyFlag(value))
    .map(([actionType, label]) => ({
      actionType,
      label,
      sourceField: actionType,
      evidenceLevel: "config_confirmed",
    }));
}

function buildNpcBranches(row, resultById) {
  const conditionGroups = splitPipe(row.Conditions);
  const resultGroups = splitPipe(row.Results);
  const count = Math.max(conditionGroups.length, resultGroups.length);
  const branches = [];
  for (let index = 0; index < count; index += 1) {
    const conditionTokens = splitSemi(conditionGroups[index] || "");
    const resultTokens = splitSemi(resultGroups[index] || "");
    const resolvedResults = resultTokens
      .map((resultId) => {
        const result = resultById.get(resultId);
        return {
          resultId,
          category: result?.Category || "",
          action: result?.Action || "",
          narrativeLines: narrativeLinesForResult(result),
          evidenceLevel: result ? "config_confirmed" : "unknown",
        };
      });
    branches.push({
      order: index + 1,
      conditionTokens,
      actionHints: actionHintsForCondition(conditionTokens),
      resultTokens,
      narrativeLines: resolvedResults.flatMap((result) => result.narrativeLines),
      resolvedResults,
      evidenceLevel: "config_confirmed",
    });
  }
  return branches;
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

function parseMapItemLua(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const bodyStart = source.indexOf("{");
  const items = [];
  let cursor = bodyStart + 1;
  while (cursor > 0 && cursor < source.length) {
    const keyStart = source.indexOf("[\"", cursor);
    if (keyStart < 0) break;
    const keyEnd = source.indexOf("\"]", keyStart + 2);
    if (keyEnd < 0) break;
    const itemId = source.slice(keyStart + 2, keyEnd);
    const recordStart = source.indexOf("{", keyEnd);
    if (recordStart < 0) break;
    const recordEnd = findMatchingBrace(source, recordStart);
    if (recordEnd < 0) break;
    items.push({
      itemId,
      fields: parseLuaRecord(source.slice(recordStart + 1, recordEnd)),
    });
    cursor = recordEnd + 1;
  }
  return items;
}

const ITEM_ACTION_SPECS = [
  ["use", "canUse", "useName", "使用"],
  ["use1", "canUse1", "useName1", "使用1"],
  ["use2", "canUse2", "useName2", "使用2"],
  ["use3", "canUse3", "useName3", "使用3"],
  ["use4", "canUse4", "useName4", "使用4"],
  ["open", "canOpen", "openName", "打开"],
  ["pickup", "canPickUp", "pickUpName", "拾取"],
  ["give", "canPushIn", "pushInName", "放入"],
  ["extract", "canExtract", "extractName", "提取"],
];

function buildItemActions(fields) {
  return ITEM_ACTION_SPECS
    .filter(([, flag]) => truthyFlag(fields[flag]))
    .map(([actionType, flag, labelField, fallbackLabel]) => ({
      actionType,
      label: fields[labelField] || fallbackLabel,
      sourceField: flag,
      evidenceLevel: "lua_confirmed",
    }));
}

function buildItemBranches(fields, resultById) {
  const branches = [];
  for (let index = 1; index <= 8; index += 1) {
    const conditionTokens = splitSemi(fields[`conditions${index}`]);
    const resultTokens = splitSemi(fields[`results${index}`]);
    if (!conditionTokens.length && !resultTokens.length) continue;
    const resolvedResults = resultTokens.map((resultId) => {
      const result = resultById.get(resultId);
      return {
        resultId,
        category: result?.Category || "",
        action: result?.Action || "",
        narrativeLines: narrativeLinesForResult(result),
        evidenceLevel: result ? "config_confirmed" : "unknown",
      };
    });
    branches.push({
      order: index,
      conditionTokens,
      actionHints: itemActionHintsForCondition(conditionTokens),
      resultTokens,
      narrativeLines: resolvedResults.flatMap((result) => result.narrativeLines),
      resolvedResults,
      evidenceLevel: "lua_confirmed",
    });
  }
  return branches;
}

function findParentNodeId(roomId, chapterNodes) {
  const owner = chapterNodes.find((node) => (node.sourceRooms || []).includes(roomId));
  return owner?.nodeId || "";
}

const flow = readJson(flowPath);
const roomRows = parseCsv(fs.readFileSync(levelNodesPath, "utf8").replace(/^\uFEFF/, ""));
const npcRows = parseCsv(fs.readFileSync(npcPath, "utf8").replace(/^\uFEFF/, ""));
const resultRows = parseCsv(fs.readFileSync(resultsPath, "utf8").replace(/^\uFEFF/, ""));
const resultById = buildResultIndex(resultRows);
const npcNameById = new Map(npcRows.map((row) => [row.RoleId, row.Name]).filter(([roleId]) => roleId));
const itemRows = parseMapItemLua(mapItemPath);
const itemById = new Map(itemRows.map((row) => [row.itemId, row.fields]));
const itemNameById = new Map(itemRows.map((row) => [row.itemId, row.fields.name || row.itemId]));
const chapterNodes = flow.chapter1?.nodes || [];
const parsedConnectionsByRoom = new Map(roomRows.map((row) => [row.NodeId, parseConnections(row.Connections)]));
const parentByRoom = new Map(
  roomRows
    .map((row) => [row.NodeId, findParentNodeId(row.NodeId, chapterNodes)])
    .filter(([, parentNodeId]) => parentNodeId),
);

let changed = true;
while (changed) {
  changed = false;
  for (const row of roomRows) {
    if (parentByRoom.has(row.NodeId)) continue;
    const outgoing = parsedConnectionsByRoom.get(row.NodeId) || [];
    const incoming = roomRows
      .filter((candidate) => (parsedConnectionsByRoom.get(candidate.NodeId) || []).some((connection) => connection.roomId === row.NodeId))
      .map((candidate) => ({ roomId: candidate.NodeId }));
    const linkedParent = [...outgoing, ...incoming]
      .map((connection) => parentByRoom.get(connection.roomId))
      .find(Boolean);
    if (linkedParent) {
      parentByRoom.set(row.NodeId, linkedParent);
      changed = true;
    }
  }
}

const rooms = roomRows.map((row, index) => {
  const encounterIds = splitPipe(row.Encounters);
  const interactableIds = splitPipe(row.Interactables);
  const rewardIds = splitPipe(row.Rewards);
  return {
    roomId: row.NodeId,
    order: index + 1,
    displayName: {
      zhCN: row.DisplayName || row.NodeId,
      rawCompetitorText: row.DisplayName || "",
      sourceQuality: "config_confirmed_map_room",
    },
    parentNodeId: parentByRoom.get(row.NodeId) || "",
    nodeType: row.NodeType || "room",
    connections: parseConnections(row.Connections),
    gates: parseGateTokens(row.Gates),
    encounterIds,
    encounterNames: encounterIds.map((roleId) => npcNameById.get(roleId) || ""),
    interactableIds,
    interactableNames: interactableIds.map((itemId) => npcNameById.get(itemId) || itemNameById.get(itemId) || ""),
    rewardIds,
    fightBackground: row.FightBackground || "",
    roomBgm: row.RoomBgm || "",
    evidence: {
      level: "config_confirmed",
      source: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_level_nodes.csv",
      sourceEvidence: row.SourceEvidence || "res/script/map/mapRoom/fb01.lua",
      record: row.NodeId,
    },
    projectPresentation: row.ProjectPresentation || "",
  };
});

const npcs = npcRows
  .filter((row) => row.RoleId && row.Name)
  .map((row) => {
    const actions = buildNpcActions(row);
    const branches = buildNpcBranches(row, resultById);
    const defaultBranch = branches.find((branch) => branch.narrativeLines.length) || branches[0] || null;
    return {
      roleId: row.RoleId,
      name: row.Name,
      baseId: row.BaseId || "",
      displayName: {
        zhCN: row.Name,
        rawCompetitorText: row.Name,
        sourceQuality: "config_confirmed_map_role",
      },
      actions,
      branches,
      defaultNarrativeLines: defaultBranch?.narrativeLines || [],
      receivePresent: row.ReceivePresent || "",
      saleList: row.SaleList || "",
      level: row.Level || "",
      qi: row.Qi || "",
      neili: row.Neili || "",
      skills: splitPipe(row.Skills),
      evidence: {
        level: "config_confirmed",
        source: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_npc_interactions.csv",
        resultSource: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_results.csv",
        sourceEvidence: row.SourceFile || "res/script/map/mapRole/fb01.lua|res/script/map/mapRoleBase/fb01.lua",
        record: row.RoleId,
      },
    };
  });

const roomInteractableIds = new Set(roomRows.flatMap((row) => splitPipe(row.Interactables)));
const interactables = itemRows
  .filter((row) => roomInteractableIds.has(row.itemId))
  .map((row) => {
    const fields = row.fields;
    const actions = buildItemActions(fields);
    const branches = buildItemBranches(fields, resultById);
    const defaultBranch = branches.find((branch) => branch.narrativeLines.length) || branches[0] || null;
    return {
      interactableId: row.itemId,
      name: fields.name || row.itemId,
      description: fields.dsc || "",
      baseId: fields.baseId || "",
      canSee: truthyFlag(fields.canSee),
      canUse: truthyFlag(fields.canUse),
      canOpen: truthyFlag(fields.canOpen),
      canPickUp: truthyFlag(fields.canPickUp),
      canPushIn: truthyFlag(fields.canPushIn),
      canExtract: truthyFlag(fields.canExtract),
      receivePresent: fields.receivePresent || "",
      actions,
      branches,
      defaultNarrativeLines: defaultBranch?.narrativeLines || [],
      rawFields: Object.fromEntries(
        Object.entries(fields).filter(([key]) => (
          key === "id"
          || key === "name"
          || key === "dsc"
          || key === "baseId"
          || key.startsWith("can")
          || key.startsWith("useName")
          || key.startsWith("conditions")
          || key.startsWith("results")
          || key.startsWith("conditionRelation")
          || key === "receivePresent"
        )),
      ),
      evidence: {
        level: "lua_confirmed",
        source: "fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/res/script/map/mapItem/fb01.lua",
        resultSource: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_results.csv",
        sourceEvidence: "res/script/map/mapItem/fb01.lua",
        record: row.itemId,
      },
    };
  });

const roomIds = new Set(rooms.map((room) => room.roomId));
const orphanConnections = [];
for (const room of rooms) {
  for (const connection of room.connections || []) {
    if (connection.roomId && !roomIds.has(connection.roomId)) {
      orphanConnections.push({
        roomId: room.roomId,
        direction: connection.direction,
        targetRoomId: connection.roomId,
      });
    }
  }
}

flow.chapter1 = flow.chapter1 || {};
flow.chapter1.rooms = rooms;
flow.chapter1.npcs = npcs;
flow.chapter1.interactables = interactables;
flow.chapter1.roomSync = {
  generatedAt: new Date().toISOString(),
  source: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_level_nodes.csv",
  npcNameSource: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_npc_interactions.csv",
  resultSource: "fangzhijianghu/outputs/fzjh_chapter1_planning_audit_20260622/chapter1_results.csv",
  roomCount: rooms.length,
  npcCount: npcs.length,
  npcActionCount: npcs.reduce((total, npc) => total + (npc.actions?.length || 0), 0),
  npcNarrativeBranchCount: npcs.reduce((total, npc) => total + (npc.branches || []).filter((branch) => branch.narrativeLines?.length).length, 0),
  interactableCount: interactables.length,
  visibleInteractableCount: interactables.filter((item) => item.canSee).length,
  interactableActionCount: interactables.reduce((total, item) => total + (item.actions?.length || 0), 0),
  roomsWithParentNode: rooms.filter((room) => room.parentNodeId).length,
  roomsWithoutParentNode: rooms.filter((room) => !room.parentNodeId).map((room) => room.roomId),
  orphanConnections,
};

writeJson(flowPath, flow);

const outDir = path.join(root, "outputs", "wuxia_first_session_contract_sync");
fs.mkdirSync(outDir, { recursive: true });
const summary = {
  generatedAt: flow.chapter1.roomSync.generatedAt,
  source: flow.chapter1.roomSync.source,
  roomCount: rooms.length,
  npcCount: flow.chapter1.roomSync.npcCount,
  npcActionCount: flow.chapter1.roomSync.npcActionCount,
  npcNarrativeBranchCount: flow.chapter1.roomSync.npcNarrativeBranchCount,
  interactableCount: flow.chapter1.roomSync.interactableCount,
  visibleInteractableCount: flow.chapter1.roomSync.visibleInteractableCount,
  interactableActionCount: flow.chapter1.roomSync.interactableActionCount,
  roomsWithParentNode: flow.chapter1.roomSync.roomsWithParentNode,
  roomsWithoutParentNode: flow.chapter1.roomSync.roomsWithoutParentNode,
  orphanConnections,
};
fs.writeFileSync(path.join(outDir, "fb01_room_chain_sync_summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
