import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const repo = new URL("..", import.meta.url).pathname.replace(/^\//, "").replace(/\//g, "/").replace(/^([A-Za-z]):/, "$1:");
const flowPath = new URL("../config/wuxia_first_session_flow.json", import.meta.url);
const contract = JSON.parse(readFileSync(flowPath, "utf8"));
const chapter = contract.chapter1;
const conditionLookup = chapter.conditionLookup || {};
const clone = (value) => JSON.parse(JSON.stringify(value));

function meaningfulSnapshot(snapshot) {
  return {
    currentState: snapshot.currentState,
    flags: snapshot.flags,
    player: snapshot.player,
    taskState: snapshot.taskState,
    hiddenEntityIds: snapshot.chapter?.hiddenEntityIds || [],
    dynamicEntityIdsByRoom: snapshot.chapter?.dynamicEntityIdsByRoom || {},
    replacementEntityById: snapshot.chapter?.replacementEntityById || {},
    mapMarkers: snapshot.chapter?.mapMarkers || {},
    pendingCombat: snapshot.pendingCombat,
  };
}

function ensurePlayerFixture(player, token) {
  const condition = conditionLookup[token];
  if (!condition) return;
  const action = String(condition.arg1 || condition.action || "");
  const key = String(condition.arg2 || "");
  const expected = Number(condition.arg3 ?? 0);
  const lower = Number.isFinite(expected) ? expected - 1 : -1;
  const greater = Number.isFinite(expected) ? expected + 1 : 1;
  const assign = (target, value) => { if (key) target[key] = value; };
  const attribute = contract.rewardAttributeMap?.[key] || ({ exp: "experience", pot: "potential", qi: "hp", jing: "spirit", neili: "mp" })[key] || key;
  if (action.includes("武功等级小于玩家等级")) {
    player.level = 2;
    assign(player.skillLevels, 1);
  } else if (action.includes("武功等级大于玩家等级")) {
    player.level = 1;
    assign(player.skillLevels, 2);
  } else if (action.includes("武功等级小于")) assign(player.skillLevels, lower);
  else if (action.includes("武功等级大于")) assign(player.skillLevels, greater);
  else if (action.includes("武功等级等于")) assign(player.skillLevels, expected);
  else if (action.includes("物品小于")) assign(player.inventory, lower);
  else if (action.includes("物品大于")) assign(player.inventory, greater);
  else if (action.includes("物品等于")) assign(player.inventory, expected);
  else if (action.includes("属性小于")) player[attribute] = lower;
  else if (action.includes("属性大于")) player[attribute] = greater;
  else if (action.includes("属性等于")) player[attribute] = expected;
  else if (action.includes("时间标记小于")) assign(player.timeMarkers, lower);
  else if (action.includes("时间标记大于")) assign(player.timeMarkers, greater);
  else if (action.includes("时间标记等于")) assign(player.timeMarkers, condition.arg3 ?? "");
  else if (action.includes("定时标记小于")) assign(player.timedMarkers, lower);
  else if (action.includes("定时标记大于")) assign(player.timedMarkers, greater);
  else if (action.includes("定时标记等于")) assign(player.timedMarkers, condition.arg3 ?? "");
  else if (action.includes("可传承玩家标记小于")) assign(player.inheritableMarkers, lower);
  else if (action.includes("可传承玩家标记大于")) assign(player.inheritableMarkers, greater);
  else if (action.includes("可传承玩家标记等于")) assign(player.inheritableMarkers, expected);
  else if (action.includes("门派等于")) player.sectId = key;
  else if (action.includes("门派不等于")) player.sectId = `__NOT_${key}__`;
}

function fixtureForBranch(branch) {
  const player = clone(contract.playerSeed || {});
  player.inventory = clone(player.inventory || {});
  player.skillLevels = clone(player.skillLevels || player.skills || {});
  player.inheritableMarkers = clone(player.inheritableMarkers || {});
  player.timeMarkers = clone(player.timeMarkers || {});
  player.timedMarkers = clone(player.timedMarkers || {});
  const initialMapMarkers = {};
  for (const token of branch?.conditionTokens || []) {
    const condition = conditionLookup[token];
    if (String(condition?.arg1 || "").includes("地图标记等于")) initialMapMarkers[condition.arg2 || ""] = condition.arg3 ?? "";
    else ensurePlayerFixture(player, token);
  }
  return { initialPlayer: player, initialMapMarkers };
}

function branchesForInteractableAction(entity, actionType) {
  const enabled = (entity.branches || []).filter((branch) => (
    (branch.resolvedResults || []).every((result) => result.enabledInFirstSession !== false)
  ));
  const exact = enabled.filter((branch) => (branch.actionHints || []).includes(actionType));
  return exact.length ? exact : enabled.filter((branch) => !(branch.actionHints || []).length);
}

function roomForEntity(entityId) {
  return (chapter.rooms || []).find((room) => (
    [...(room.encounterIds || []), ...(room.interactableIds || [])].includes(entityId)
  ));
}

function probe(entity, action, branch) {
  const interactableId = entity.interactableId;
  const room = roomForEntity(interactableId);
  const fixture = fixtureForBranch(branch);
  const runtime = createFirstSessionRuntime(clone(contract), {
    initialState: "STATE_FS_008_MAP_EXPLORE",
    initialFlags: ["new_install_or_new_save", "chapter_fb01_entered", "map_node_selected"],
    ...fixture,
  });
  if (room?.roomId) runtime.selectChapterRoom(room.roomId);
  runtime.selectChapterInteractable(interactableId);
  const before = runtime.snapshot();
  const result = runtime.interactWithChapterInteractable(interactableId, action.actionType);
  const after = runtime.snapshot();
  const event = result.event || {};
  const sideEffectStatuses = (event.sideEffects || []).flatMap((effect) => [
    effect.status || "",
    ...(effect.followupSideEffects || []).map((followup) => followup.status || ""),
  ]).filter(Boolean);
  const semanticChanged = JSON.stringify(meaningfulSnapshot(before)) !== JSON.stringify(meaningfulSnapshot(after));
  const feedbackOnly = (event.feedbackLines || []).length > 0
    && sideEffectStatuses.length > 0
    && sideEffectStatuses.every((status) => ["applied_text_feedback", "applied_story_dialogue_feedback"].includes(status));
  return {
    interactableId,
    entityName: entity.name || entity.displayName?.zhCN || "",
    roomId: room?.roomId || "",
    actionType: action.actionType,
    actionLabel: action.label || "",
    branchConditionTokens: branch?.conditionTokens || [],
    branchResultTokens: branch?.resultTokens || (branch?.resolvedResults || []).map((result) => result.resultId).filter(Boolean),
    accepted: result.accepted === true,
    executionStatus: result.executionStatus || event.executionStatus || "",
    outcomeKind: result.outcomeKind || event.outcomeKind || "",
    stateChanged: result.stateChanged === true || event.stateChanged === true,
    semanticChanged,
    feedbackOnly,
    feedbackLines: event.feedbackLines || [],
    sideEffectStatuses,
    reasonCode: event.reasonCode || "",
    reason: event.reason || "",
  };
}

export function runAudit({ writeOutputs = true } = {}) {
  const rows = [];
  const defaultRows = [];
  let configuredActionDefinitionCount = 0;
  for (const entity of chapter.interactables || []) {
    for (const action of entity.actions || []) {
      configuredActionDefinitionCount += 1;
      defaultRows.push(probe(entity, action, null));
      const candidates = branchesForInteractableAction(entity, action.actionType);
      const probes = candidates.length ? candidates.map((branch) => probe(entity, action, branch)) : [probe(entity, action, null)];
      const unique = new Map();
      for (const row of probes) {
        const key = `${row.interactableId}|${row.actionType}|${row.branchResultTokens.join(",")}|${row.branchConditionTokens.join(",")}`;
        if (!unique.has(key)) unique.set(key, row);
      }
      rows.push(...unique.values());
    }
  }
  const acceptedNoStateRows = defaultRows.filter((row) => row.accepted && row.feedbackOnly && !row.semanticChanged);
  const rejectedFeedbackRows = defaultRows.filter((row) => !row.accepted && row.feedbackOnly && !row.semanticChanged);
  const branchAcceptedNoStateRows = rows.filter((row) => row.accepted && row.feedbackOnly && !row.semanticChanged);
  const branchRejectedFeedbackRows = rows.filter((row) => !row.accepted && row.feedbackOnly && !row.semanticChanged);
  const unsupportedAcceptedRows = [...defaultRows, ...rows].filter((row) => row.accepted && row.executionStatus === "unsupported");
  const statusCounts = Object.fromEntries([...new Set(rows.map((row) => row.executionStatus || "unknown"))].sort().map((status) => [status, rows.filter((row) => row.executionStatus === status).length]));
  const simulationPath = "outputs/idlewuxia_migration/wuxia_first_session_flow_simulation.json";
  const simulation = existsSync(simulationPath) ? JSON.parse(readFileSync(simulationPath, "utf8")) : null;
  const relatedFirstSessionSimulation = {
    scope: "unrelated_to_T02-02",
    excludedFromVerdict: true,
    reportPath: simulationPath,
    currentMismatches: simulation?.summary?.mismatches ?? simulation?.mismatches ?? null,
    knownHistoricalMismatch: {
      reference: "docs/codex_game_development_os/T03-01_COMPLETION_RECORD_20260723.md",
      description: "历史首轮模拟曾从错误生命周期状态测试战斗交互可用性；该问题属于首轮/战斗链路，不属于 T02-02 交互接受语义。",
    },
  };
  const truthfulAcceptedNoState = acceptedNoStateRows.every((row) => (
    row.executionStatus === "executed" && row.outcomeKind === "narrative_only" && row.stateChanged === false
  ));
  const report = {
    schema: "idlewuxia.t02_02.interaction_semantics_report.v1",
    generatedAt: new Date().toISOString(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: new URL("..", import.meta.url), encoding: "utf8" }).trim(),
    method: "Configured interactable actions are replayed with branch-specific condition fixtures; semantic state excludes selection and event-log changes.",
    summary: {
      configuredActionCount: rows.length,
      configuredActionDefinitionCount,
      defaultActionCount: defaultRows.length,
      branchProbeCount: rows.length,
      acceptedCount: defaultRows.filter((row) => row.accepted).length,
      rejectedCount: defaultRows.filter((row) => !row.accepted).length,
      statusCounts,
      acceptedNoStateCount: acceptedNoStateRows.length,
      rejectedFeedbackNoStateCount: rejectedFeedbackRows.length,
      branchAcceptedNoStateCount: branchAcceptedNoStateRows.length,
      branchRejectedFeedbackNoStateCount: branchRejectedFeedbackRows.length,
      unsupportedAcceptedCount: unsupportedAcceptedRows.length,
      verdict: truthfulAcceptedNoState
        && branchAcceptedNoStateRows.every((row) => row.executionStatus === "executed" && row.outcomeKind === "narrative_only" && row.stateChanged === false)
        && unsupportedAcceptedRows.length === 0 ? "pass" : "fail",
    },
    findings: {
      acceptedNoStateRows,
      rejectedFeedbackRows,
      branchAcceptedNoStateRows,
      branchRejectedFeedbackRows,
      unsupportedAcceptedRows,
      configuredFeedbackOnlyCandidates: [...new Map(
        [...defaultRows.filter((row) => row.feedbackOnly && !row.semanticChanged), ...rows.filter((row) => row.feedbackOnly && !row.semanticChanged)]
          .map((row) => [`${row.interactableId}/${row.actionType}`, row]),
      ).values()],
    },
    relatedFirstSessionSimulation,
    defaultRows,
    rows,
  };
  if (writeOutputs) {
    mkdirSync("outputs/t02_02_interaction_semantics", { recursive: true });
    writeFileSync("outputs/t02_02_interaction_semantics/t02_02_interaction_semantics_report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return report;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("audit-wuxia-t02-02-interaction-semantics.mjs")) {
  const report = runAudit();
  process.stdout.write(`${JSON.stringify({ output: "outputs/t02_02_interaction_semantics/t02_02_interaction_semantics_report.json", ...report.summary }, null, 2)}\n`);
  process.exitCode = report.summary.verdict === "pass" ? 0 : 1;
}
