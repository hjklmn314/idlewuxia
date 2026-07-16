import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl", "fb01_interaction_runtime_preflight.csv");
const outDir = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl_batches");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const screenContractPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = (filePath, rows, columns) => fs.writeFileSync(
  filePath,
  `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`,
  "utf8",
);

if (!fs.existsSync(inputPath)) throw new Error(`Run wuxia:audit:fb01-browser-crawl first: ${inputPath}`);
const rows = parseCsv(inputPath)
  .filter((row) => row.scope === "fb01_room_mapped" && !["real_browser_clicked", "real_browser_route_blocked"].includes(row.browserStatus));
const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
const screenContract = JSON.parse(fs.readFileSync(screenContractPath, "utf8"));
const chapter = flow.chapters?.[flow.chapterSystem?.defaultChapterId] || flow.chapter1 || {};
const roomById = new Map((chapter.rooms || []).map((room) => [room.roomId, room]));
const npcById = new Map((chapter.npcs || []).map((npc) => [npc.roleId, npc]));
const mapBlock = (screenContract.screens?.UI_MapExplore?.body || []).find((block) => block.type === "roomExplore") || {};
const mapEntryRoomId = mapBlock.defaultRoomId || chapter.rooms?.[0]?.roomId || "";

function pathFromMapEntry(targetRoomId) {
  const queue = [{ roomId: mapEntryRoomId, route: [mapEntryRoomId] }];
  const visited = new Set([mapEntryRoomId]);
  while (queue.length) {
    const current = queue.shift();
    if (current.roomId === targetRoomId) return current.route;
    for (const connection of roomById.get(current.roomId)?.connections || []) {
      if (!connection.roomId || visited.has(connection.roomId)) continue;
      visited.add(connection.roomId);
      queue.push({ roomId: connection.roomId, route: [...current.route, connection.roomId] });
    }
  }
  return [];
}

function gateEvidenceForRoute(route) {
  const gates = [];
  for (let index = 1; index < route.length; index += 1) {
    const sourceRoom = roomById.get(route[index - 1]);
    const targetRoomId = route[index];
    const roomNumber = String(targetRoomId).match(/_(\d+)$/)?.[1];
    const token = roomNumber ? `gorome${Number(roomNumber)}` : "";
    for (const roleId of sourceRoom?.encounterIds || []) {
      const branch = (npcById.get(roleId)?.branches || []).find((candidate) => (
        token && (candidate.conditionTokens || []).includes(token) && (candidate.resultTokens || []).includes("stop")
      ));
      if (branch) gates.push(`${sourceRoom.roomId}:${roleId}:${token}`);
    }
  }
  return gates;
}

const priorityFor = (row) => {
  if (row.executionShape === "configured_branch_executor") return "P1";
  if (row.executionShape === "configured_combat_policy") return "P1";
  return "P2";
};
const isolationFor = (row) => row.executionShape === "configured_combat_policy" || Boolean(row.branchResultTokens);
const targets = rows.map((row) => {
  const roomId = row.roomIds.split(";")[0];
  const fullRoute = pathFromMapEntry(roomId);
  const routeRoomIds = fullRoute.slice(1);
  const routeGateEvidence = gateEvidenceForRoute(fullRoute);
  return {
    ...row,
    priority: priorityFor(row),
    executionMode: isolationFor(row) ? "fresh_first_session_per_action" : "same_room_safe_batch_candidate",
    mapEntryRoomId,
    routeRoomIds: routeRoomIds.join(";"),
    routeGateEvidence: routeGateEvidence.join(";"),
    routePolicy: "Only click visible room exits and entity/action buttons. A missing selector or unmet route gate is evidence, not a reason to dispatch an internal action.",
  };
});

const groups = new Map();
for (const target of targets) {
  const key = [target.priority, target.roomIds.split(";")[0], target.kind, target.actionType, target.executionMode].join("|");
  const list = groups.get(key) || [];
  list.push(target);
  groups.set(key, list);
}
const batches = [...groups.entries()].map(([key, entries], index) => {
  const [priority, roomId, kind, actionType, executionMode] = key.split("|");
  return {
    batchId: `FB01_BROWSER_${String(index + 1).padStart(3, "0")}`,
    priority,
    roomId,
    kind,
    actionType,
    executionMode,
    targetCount: entries.length,
    mapEntryRoomId: entries[0]?.mapEntryRoomId || "",
    routeRoomIds: entries[0]?.routeRoomIds || "",
    routeGateEvidence: entries[0]?.routeGateEvidence || "",
    targetKeys: entries.map((entry) => entry.interactionKey).join(";"),
    runnerContract: "run-wuxia-real-browser-flow.mjs --scenario entity-actions --room-id <roomId> --entity-id <entityId> --entity-kind <kind> --interaction-actions <actionType>",
    acceptance: "Every target obtains a DOM-click result, destination state, feedback/log assertion, and screenshot; no runtime dispatch fallback is allowed.",
  };
}).sort((left, right) => left.priority.localeCompare(right.priority) || left.roomId.localeCompare(right.roomId));

fs.mkdirSync(outDir, { recursive: true });
const targetColumns = [
  "interactionKey", "priority", "executionMode", "kind", "entityId", "entityName", "actionType", "actionLabel", "roomIds", "mapEntryRoomId", "routeRoomIds", "routeGateEvidence",
  "executionShape", "branchResultTokens", "evidenceLevel", "sourceEvidence", "routePolicy",
];
const batchColumns = ["batchId", "priority", "roomId", "kind", "actionType", "executionMode", "targetCount", "mapEntryRoomId", "routeRoomIds", "routeGateEvidence", "targetKeys", "runnerContract", "acceptance"];
writeCsv(path.join(outDir, "fb01_browser_crawl_targets.csv"), targets, targetColumns);
writeCsv(path.join(outDir, "fb01_browser_crawl_batches.csv"), batches, batchColumns);
const summary = {
  generatedAt: new Date().toISOString(),
  inputPath: path.relative(root, inputPath).replaceAll("\\", "/"),
  counts: {
    pendingTargets: targets.length,
    batches: batches.length,
    p1Targets: targets.filter((row) => row.priority === "P1").length,
    p2Targets: targets.filter((row) => row.priority === "P2").length,
    isolatedStarts: targets.filter((row) => row.executionMode === "fresh_first_session_per_action").length,
    targetsWithRouteGateEvidence: targets.filter((row) => row.routeGateEvidence).length,
  },
};
fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "fb01_browser_crawl_plan.md"), [
  "# fb01 Browser Crawl Plan",
  "",
  "This plan is generated from the config/runtime preflight. It contains only fb01 room-mapped actions without existing real-browser click evidence.",
  "",
  ...Object.entries(summary.counts).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Execution Rules",
  "",
  "- Use a fresh first session for rows that can mutate entity visibility, replace an NPC, start combat, or emit result tokens.",
  "- Use only visible DOM buttons; never call the runtime's internal dispatch API to make a selector appear.",
  "- A failed visible route is retained as acceptance evidence with its locked/missing reason.",
  "- A successful runtime preflight does not lower the browser-pending count.",
  "",
].join("\n"), "utf8");
console.log(JSON.stringify(summary, null, 2));
