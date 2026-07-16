import fs from "node:fs";
import path from "node:path";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const root = process.cwd();
const configPath = path.join(root, "config", "wuxia_first_session_flow.json");
const outDir = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl");

const readJson = (filePath, fallback = null) => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { __parseError: error.message };
  }
};

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const writeCsv = (filePath, rows, columns) => {
  fs.writeFileSync(
    filePath,
    `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`,
    "utf8",
  );
};

const parseCsv = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
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
};

const flow = readJson(configPath, {});
if (flow.__parseError) throw new Error(`Cannot parse flow config: ${flow.__parseError}`);
const chapter = flow.chapters?.[flow.chapterSystem?.defaultChapterId] || flow.chapter1 || {};
const combatPolicies = flow.chapterSystem?.combatActionPolicies || {};
const mapState = (flow.states || []).find((state) => state.screenId === "UI_MapExplore")?.stateId || "";

function roomIdsForEntity(entityId, kind) {
  const field = kind === "npc" ? "encounterIds" : "interactableIds";
  return (chapter.rooms || [])
    .filter((room) => (room[field] || []).includes(entityId))
    .map((room) => room.roomId);
}

// This only prepares the interpreter for an interaction. It deliberately does not
// claim that the player can navigate the same route through the browser UI.
function bootstrapToMap(runtime) {
  const executed = [];
  const visited = new Set();
  const attemptedActions = new Set();
  const actionRouteToMap = (fromState, blockedStates) => {
    const queue = [{ stateId: fromState, route: [] }];
    const seen = new Set([fromState]);
    while (queue.length) {
      const current = queue.shift();
      if (current.stateId === mapState) return current.route;
      for (const action of flow.actions || []) {
        if (action.fromState !== current.stateId || !action.toState || action.toState === current.stateId) continue;
        if (action.toState !== mapState && (blockedStates.has(action.toState) || seen.has(action.toState))) continue;
        const route = [...current.route, action];
        if (action.toState === mapState) return route;
        seen.add(action.toState);
        queue.push({ stateId: action.toState, route });
      }
    }
    return [];
  };
  for (let guard = 0; guard < 24; guard += 1) {
    const current = runtime.snapshot().currentState;
    if (current === mapState) return { accepted: true, executed };
    visited.add(current);
    const route = actionRouteToMap(current, visited);
    const routeCandidates = route.length
      ? [route[0]]
      : (flow.actions || []).filter((action) => action.fromState === current && action.toState && action.toState !== current && !visited.has(action.toState));
    const preparationCandidates = (flow.actions || []).filter((action) => (
      action.fromState === current
      && action.toState === current
      && !attemptedActions.has(action.actionId)
    ));
    const candidates = [...routeCandidates, ...preparationCandidates].filter((action, index, all) => (
      !attemptedActions.has(action.actionId)
      && all.findIndex((candidate) => candidate.actionId === action.actionId) === index
    ));
    let transitioned = false;
    for (const action of candidates) {
      const result = runtime.dispatch(action.actionId);
      // A forward transition may be temporarily rejected until a same-state
      // preparation action grants its configured prerequisite. Do not retire it
      // from the route until a subsequent attempt has a chance to pass.
      if (result.accepted || action.toState === current) attemptedActions.add(action.actionId);
      executed.push({ actionId: action.actionId, accepted: result.accepted, reason: result.event?.reason || "" });
      if (result.accepted) {
        transitioned = true;
        break;
      }
    }
    if (!transitioned) return { accepted: false, executed, reason: `no accepted forward action from ${current}` };
  }
  return { accepted: false, executed, reason: "bootstrap guard exceeded" };
}

function exactActionBranch(entity, actionType) {
  return (entity.branches || []).find((branch) => (branch.actionHints || []).includes(actionType)) || null;
}

function executionShape(kind, entity, actionType) {
  const exact = exactActionBranch(entity, actionType);
  if (kind === "npc" && combatPolicies[actionType]?.startActionId) return "configured_combat_policy";
  if (exact) return "configured_branch_executor";
  if (kind === "npc" && ["sale", "present", "compete", "kill", "apprentice"].includes(actionType)) return "global_feedback_only";
  if (kind === "interactable" && actionType === "pickup") return "global_feedback_only";
  return "no_configured_executor";
}

function latestBrowserSummaries() {
  const outputsDir = path.join(root, "outputs");
  if (!fs.existsSync(outputsDir)) return [];
  const summaries = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("skill_waterfall_acceptance_"))
    .map((entry) => {
      const relativePath = path.join("outputs", entry.name, "real_browser_flow_summary.json");
      const summary = readJson(path.join(root, relativePath), null);
      return summary && !summary.__parseError ? { relativePath: relativePath.replaceAll("\\", "/"), summary } : null;
    })
    .filter(Boolean);
  const batchRoot = path.join(outputsDir, "wuxia_fb01_browser_crawl_runs");
  if (fs.existsSync(batchRoot)) {
    for (const batchEntry of fs.readdirSync(batchRoot, { withFileTypes: true })) {
      if (!batchEntry.isDirectory()) continue;
      const batchDir = path.join(batchRoot, batchEntry.name);
      for (const runEntry of fs.readdirSync(batchDir, { withFileTypes: true })) {
        if (!runEntry.isDirectory()) continue;
        const relativePath = path.join("outputs", "wuxia_fb01_browser_crawl_runs", batchEntry.name, runEntry.name, "real_browser_flow_summary.json");
        const summary = readJson(path.join(root, relativePath), null);
        if (summary && !summary.__parseError) summaries.push({ relativePath: relativePath.replaceAll("\\", "/"), summary });
      }
    }
  }
  for (const rootName of ["wuxia_fb01_route_unlock_runs", "wuxia_fb01_route_unlock_probes"]) {
    const runRoot = path.join(outputsDir, rootName);
    if (!fs.existsSync(runRoot)) continue;
    for (const entry of fs.readdirSync(runRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const relativePath = path.join("outputs", rootName, entry.name, "real_browser_flow_summary.json");
      const summary = readJson(path.join(root, relativePath), null);
      if (summary && !summary.__parseError) summaries.push({ relativePath: relativePath.replaceAll("\\", "/"), summary });
    }
  }
  return summaries;
}

const browserSummaries = latestBrowserSummaries();

function selectorEvidenceIndex() {
  const index = new Map();
  for (const { relativePath, summary } of browserSummaries) {
    for (const result of summary.results || []) {
      const selector = result.click?.selector || "";
      if (result.click?.clicked !== true || result.error) continue;
      const npc = selector.match(/data-wuxia-npc-id="([^"]+)"/);
      const item = selector.match(/data-wuxia-interactable-id="([^"]+)"/);
      const action = selector.match(/data-wuxia-(?:npc|interactable)-action="([^"]+)"/);
      if (!(npc || item) || !action) continue;
      const key = `${npc ? "npc" : "interactable"}:${(npc || item)[1]}:${action[1]}`;
      if (!index.has(key)) {
        index.set(key, {
          browserStatus: "real_browser_clicked",
          browserScenario: summary.scenario || "",
          browserScreenshot: result.screenshot || "",
          browserSummary: relativePath,
          browserState: result.state || "",
        });
      }
    }
  }
  const batchRoot = path.join(root, "outputs", "wuxia_fb01_browser_crawl_runs");
  if (fs.existsSync(batchRoot)) {
    for (const batchEntry of fs.readdirSync(batchRoot, { withFileTypes: true })) {
      if (!batchEntry.isDirectory()) continue;
      const relativeBatchPath = path.join("outputs", "wuxia_fb01_browser_crawl_runs", batchEntry.name, "batch_results.csv").replaceAll("\\", "/");
      for (const row of parseCsv(path.join(root, relativeBatchPath))) {
        if (!row.interactionKey || index.has(row.interactionKey)) continue;
        if (row.status === "passed_real_dom_click") {
          index.set(row.interactionKey, {
            browserStatus: "real_browser_clicked",
            browserScenario: "batch_entity_actions",
            browserScreenshot: row.screenshot || "",
            browserSummary: row.summaryPath || relativeBatchPath,
            browserState: row.actualState || "",
          });
        } else if (row.status === "blocked_by_configured_route_gate") {
          index.set(row.interactionKey, {
            browserStatus: "real_browser_route_blocked",
            browserScenario: "batch_entity_actions",
            browserScreenshot: row.screenshot || "",
            browserSummary: row.summaryPath || relativeBatchPath,
            browserState: row.actualState || "",
          });
        }
      }
    }
  }
  return index;
}

const browserIndex = selectorEvidenceIndex();
const rows = [];
for (const [kind, entities] of [["npc", chapter.npcs || []], ["interactable", chapter.interactables || []]]) {
  const idKey = kind === "npc" ? "roleId" : "interactableId";
  for (const entity of entities) {
    for (const action of entity.actions || []) {
      const entityId = entity[idKey] || "";
      const actionType = action.actionType || "";
      const key = `${kind}:${entityId}:${actionType}`;
      const roomIds = roomIdsForEntity(entityId, kind);
      const scope = roomIds.length ? "fb01_room_mapped" : "outside_fb01_room_scope";
      const runtime = createFirstSessionRuntime(flow);
      const bootstrap = bootstrapToMap(runtime);
      const setup = bootstrap.accepted && roomIds[0]
        ? runtime.selectChapterRoom(roomIds[0])
        : { accepted: false, event: { reason: bootstrap.reason || (roomIds.length ? "map bootstrap failed" : "entity has no room placement") } };
      const selection = setup.accepted
        ? (kind === "npc" ? runtime.selectChapterNpc(entityId) : runtime.selectChapterInteractable(entityId))
        : { accepted: false, event: { reason: setup.event?.reason || "room setup rejected" } };
      const interaction = selection.accepted
        ? (kind === "npc" ? runtime.interactWithChapterNpc(entityId, actionType) : runtime.interactWithChapterInteractable(entityId, actionType))
        : { accepted: false, event: { reason: selection.event?.reason || "entity selection rejected" } };
      const event = interaction.event || {};
      const browserEvidence = browserIndex.get(key) || {};
      const shape = executionShape(kind, entity, actionType);
      const runtimeStatus = scope === "outside_fb01_room_scope"
        ? "out_of_scope_no_fb01_room_placement"
        : interaction.accepted
        ? (shape === "global_feedback_only" ? "accepted_feedback_only" : "accepted")
        : (entity.canSee === false ? "hidden_by_config" : "rejected");
      rows.push({
        interactionKey: key,
        kind,
        entityId,
        entityName: entity.name || entity.displayName?.zhCN || "",
        actionType,
        actionLabel: action.label || "",
        scope,
        roomIds: roomIds.join(";"),
        canSee: entity.canSee === false ? "false" : "true",
        bootstrapStatus: bootstrap.accepted ? "accepted" : "rejected",
        bootstrapRoute: bootstrap.executed.map((entry) => entry.actionId).join(" > "),
        roomSetupStatus: setup.accepted ? "accepted" : "rejected",
        selectionStatus: selection.accepted ? "accepted" : "rejected",
        runtimeStatus,
        runtimeEventType: event.type || "",
        runtimeReason: event.reason || "",
        executionShape: shape,
        branchResultTokens: (exactActionBranch(entity, actionType)?.resultTokens || []).join(";"),
        evidenceLevel: entity.evidence?.level || action.evidenceLevel || "",
        sourceEvidence: entity.evidence?.sourceEvidence || "",
        browserStatus: browserEvidence.browserStatus || (scope === "outside_fb01_room_scope" ? "out_of_scope_not_planned" : "not_yet_real_browser_clicked"),
        browserScenario: browserEvidence.browserScenario || "",
        browserState: browserEvidence.browserState || "",
        browserScreenshot: browserEvidence.browserScreenshot || "",
        browserSummary: browserEvidence.browserSummary || "",
        browserAcceptanceRequirement: "Visible room navigation, entity select, then action button click; direct runtime preflight never counts as browser acceptance.",
      });
    }
  }
}

const counts = (field) => rows.reduce((result, row) => {
  const value = row[field] || "(empty)";
  result[value] = (result[value] || 0) + 1;
  return result;
}, {});
const activeScopeRows = rows.filter((row) => row.scope === "fb01_room_mapped");
const outOfScopeRows = rows.filter((row) => row.scope === "outside_fb01_room_scope");
const executorGaps = activeScopeRows.filter((row) => row.executionShape === "global_feedback_only" || row.executionShape === "no_configured_executor");
const browserClicked = rows.filter((row) => row.browserStatus === "real_browser_clicked");
const browserBlocked = rows.filter((row) => row.browserStatus === "real_browser_route_blocked");
const runtimeRejected = rows.filter((row) => row.runtimeStatus === "rejected" || row.runtimeStatus === "hidden_by_config");
const passedRouteUnlockFlows = browserSummaries.filter(({ summary }) => (
  summary.scenario === "route-unlock-plan"
  && (summary.failures || []).length === 0
  && String(summary.results?.at(-1)?.label || "").startsWith("route_unlock_target_")
  && Boolean(summary.results?.at(-1)?.roomId)
));

fs.mkdirSync(outDir, { recursive: true });
const columns = [
  "interactionKey", "kind", "entityId", "entityName", "actionType", "actionLabel", "scope", "roomIds", "canSee",
  "bootstrapStatus", "bootstrapRoute", "roomSetupStatus", "selectionStatus", "runtimeStatus", "runtimeEventType",
  "runtimeReason", "executionShape", "branchResultTokens", "evidenceLevel", "sourceEvidence", "browserStatus",
  "browserScenario", "browserState", "browserScreenshot", "browserSummary", "browserAcceptanceRequirement",
];
writeCsv(path.join(outDir, "fb01_interaction_runtime_preflight.csv"), rows, columns);
writeCsv(path.join(outDir, "fb01_interaction_executor_gaps.csv"), executorGaps, columns);
writeCsv(path.join(outDir, "fb01_interaction_browser_clicked.csv"), browserClicked, columns);
writeCsv(path.join(outDir, "fb01_interaction_runtime_rejected.csv"), runtimeRejected, columns);

const summary = {
  generatedAt: new Date().toISOString(),
  configPath: path.relative(root, configPath).replaceAll("\\", "/"),
  purpose: "Config/runtime preflight and real-browser evidence index. Direct runtime checks are not browser acceptance.",
  counts: {
    allImportedActions: rows.length,
    fb01RoomMappedActions: activeScopeRows.length,
    outOfScopeNoFb01RoomPlacement: outOfScopeRows.length,
    runtimeAccepted: activeScopeRows.filter((row) => row.runtimeStatus === "accepted").length,
    runtimeFeedbackOnly: activeScopeRows.filter((row) => row.runtimeStatus === "accepted_feedback_only").length,
    runtimeRejected: runtimeRejected.length,
    browserClicked: browserClicked.filter((row) => row.scope === "fb01_room_mapped").length,
    browserBlocked: browserBlocked.filter((row) => row.scope === "fb01_room_mapped").length,
    browserCovered: activeScopeRows.filter((row) => ["real_browser_clicked", "real_browser_route_blocked"].includes(row.browserStatus)).length,
    browserPending: activeScopeRows.filter((row) => !["real_browser_clicked", "real_browser_route_blocked"].includes(row.browserStatus)).length,
    executorGaps: executorGaps.length,
    routeUnlockFlowsPassed: passedRouteUnlockFlows.length,
  },
  byActionType: counts("actionType"),
  byExecutionShape: counts("executionShape"),
  byRuntimeStatus: counts("runtimeStatus"),
  byBrowserStatus: counts("browserStatus"),
  outputDir: path.relative(root, outDir).replaceAll("\\", "/"),
};
fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "fb01_interaction_crawl_report.md"), [
  "# fb01 Interaction Crawl Preflight",
  "",
  "## Evidence Rule",
  "",
  "- `runtimeStatus` proves only that the generic interpreter can execute configured input after a controlled setup.",
  "- `browserStatus=real_browser_clicked` is the only field that counts as a visible browser interaction acceptance.",
  "- `accepted_feedback_only` is intentionally not treated as feature-complete: it has a button and text feedback but no configured transaction, combat, or modal executor.",
  "",
  "## Counts",
  "",
  ...Object.entries(summary.counts).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Next Gate",
  "",
  "1. Add real-browser routes for visible, reachable rows in `fb01_interaction_runtime_preflight.csv`.",
  "2. Convert each `global_feedback_only` row to a configured executor or explicitly keep it unavailable until its competitor evidence and UI contract exist.",
  "3. Do not convert browser-pending rows into pass status merely because their runtime preflight accepted.",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify(summary, null, 2));
