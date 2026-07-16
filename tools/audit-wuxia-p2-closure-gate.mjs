import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_p2_closure_gate");
const resultCsvPath = path.join(root, "outputs", "wuxia_fb01_result_token_runtime_coverage", "fb01_result_token_runtime_coverage.csv");
const flowCsvPath = path.join(root, "outputs", "wuxia_fzjh_flow_parity_audit", "flow_parity_findings.csv");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "") : "";
}

function readJson(filePath, fallback = {}) {
  const text = readText(filePath);
  return text ? JSON.parse(text) : fallback;
}

function parseCsv(filePath) {
  const text = readText(filePath);
  if (!text) return [];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (!quoted && ch === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const text = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
  fs.writeFileSync(filePath, `${text}\n`, "utf8");
}

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const value = row[field] || "(empty)";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function resultLookup(flow, resultId) {
  const key = String(resultId || "").replace(/^rlt_/, "");
  return flow.chapter1?.resultLookup?.[key] || flow.chapter1?.resultLookup?.[`rlt_${key}`] || null;
}

function classifyResultToken(row, flow) {
  const result = resultLookup(flow, row.ResultId);
  const arg2 = result?.args?.Arg2 || "";
  const arg3 = result?.args?.Arg3 || "";
  const narrative = Array.isArray(result?.narrativeLines) ? result.narrativeLines.join("\n") : "";
  const base = {
    Domain: "result_token",
    ItemId: `${row.SourceId}#${row.BranchOrder}:${row.ResultId}`,
    SourceId: row.SourceId,
    SourceName: row.SourceName,
    ResultId: row.ResultId,
    ActionHints: row.ActionHints,
    ConditionTokens: row.ConditionTokens,
    RuntimeStatus: row.RuntimeStatus,
    RequiredRuntimeBinding: row.RequiredRuntimeBinding,
    SourceFile: row.SourceFile,
    SourceRecord: row.SourceRecord,
    EvidenceLevel: row.EvidenceLevel,
    SourceArgs: [arg2, arg3].filter(Boolean).join("|"),
    SourceNarrative: narrative,
  };

  if (row.RuntimeStatus === "not_executed_skill_progression") {
    return {
      ...base,
      ClosureGroup: "skill_exp_executor_gap",
      ClosurePolicy: "implement_runtime",
      PlayerImpact: "A first-chapter practice or tutor action can grant martial skill experience, so player progression is incomplete until applied.",
      NextAction: "Add a data-driven skillExp map on player state; apply result args Arg2 skillId and Arg3 expDelta; extend condition evaluator for skill level/skill exp gates.",
      AutomatedGate: "interaction regression must assert skillExp[Arg2] increases by Arg3 and result-token audit downgrades this row to implemented_skill_progression.",
      HumanGate: "Click the source NPC/object action in real browser and verify the room log and player progression panel show the configured skill gain without raw IDs.",
      BlockingScope: "chapter1_progression",
    };
  }

  if (row.RuntimeStatus === "not_executed_time_marker") {
    return {
      ...base,
      ClosureGroup: "time_marker_executor_gap",
      ClosurePolicy: "implement_runtime",
      PlayerImpact: "Quest/cooldown/repeat gates can be wrong because player time markers and timed markers are only recorded as missing semantics.",
      NextAction: "Add playerTimeMarkers/playerTimedMarkers to runtime snapshot; implement result actions 玩家时间标记设置 and 玩家定时标记设置; extend corresponding condition tokens.",
      AutomatedGate: "unit regression must assert marker name Arg2 and value/time args are stored; result-token audit downgrades this row to implemented_time_marker.",
      HumanGate: "Trigger a marker-setting branch, leave/return, and verify the branch/gate changes according to the stored marker.",
      BlockingScope: "quest_repeatability",
    };
  }

  if (row.RuntimeStatus === "not_bound_seasonal_activity_delegate") {
    return {
      ...base,
      ClosureGroup: "seasonal_activity_delegate",
      ClosurePolicy: "defer_with_guard",
      PlayerImpact: "拜年/拜年委托 belongs to seasonal activity logic. It must not appear as a broken normal first-session action.",
      NextAction: "Keep event-only action hidden or disabled unless seasonal activity module is enabled; later bind to activity dispatcher evidence.",
      AutomatedGate: "normal first-session browser flow must not expose an enabled seasonal action; if exposed, audit fails.",
      HumanGate: "NPC action list should not show a dead seasonal button in normal mode.",
      BlockingScope: "event_content_out_of_first_session",
    };
  }

  if (row.Action === "改变政绩") {
    return {
      ...base,
      ClosureGroup: "merit_side_effect_gap",
      ClosurePolicy: "implement_runtime_or_scope_out",
      PlayerImpact: "Political/merit score changes are configured side effects; they affect broader account/system progression if the route is enabled.",
      NextAction: "Trace the merit field owner from Lua/config; either implement player.meritLedger delta or mark the branch as non-first-session hidden.",
      AutomatedGate: "audit must prove either implemented_merit_delta or hidden_non_first_session_branch.",
      HumanGate: "No visible player action may claim success while silently dropping merit rewards.",
      BlockingScope: "system_progression",
    };
  }

  if (row.Action === "副本故事") {
    return {
      ...base,
      ClosureGroup: "story_dialog_delegate_gap",
      ClosurePolicy: "implement_runtime",
      PlayerImpact: "Configured story text exists in Arg2 but current runtime treats it as an unimplemented side effect, so NPC dialogue can be blank or wrong.",
      NextAction: "Route 副本故事 Arg2 text through the same dialogue feedback pipeline used by narrative results; preserve semicolon-separated lines.",
      AutomatedGate: "interaction regression must assert source dialogue contains Arg2 text and result-token audit downgrades to implemented_story_dialog.",
      HumanGate: "Click the Tang Zhu branch and verify the full story panel is readable and no result ID is shown.",
      BlockingScope: "npc_dialogue",
    };
  }

  return {
    ...base,
    ClosureGroup: "unclassified_p2_result_token",
    ClosurePolicy: "manual_review_required",
    PlayerImpact: "Unknown P2 result-token semantics.",
    NextAction: "Trace Lua/config dispatcher before implementation.",
    AutomatedGate: "This row must be classified before the next acceptance claim.",
    HumanGate: "Manual review required.",
    BlockingScope: "unknown",
  };
}

function classifyFlowParity(row) {
  const base = {
    Domain: "flow_parity",
    ItemId: row.Subject,
    SourceId: "",
    SourceName: "",
    ResultId: "",
    ActionHints: "",
    ConditionTokens: "",
    RuntimeStatus: row.Issue,
    RequiredRuntimeBinding: row.RequiredAction,
    SourceFile: row.SourceEvidence,
    SourceRecord: row.Area,
    EvidenceLevel: "audit_detected",
    SourceArgs: "",
    SourceNarrative: "",
  };
  if (row.Area === "action" && row.Issue.includes("project proposal")) {
    return {
      ...base,
      ClosureGroup: "navigation_bridge_policy",
      ClosurePolicy: "allow_if_player_facing_and_documented",
      PlayerImpact: "The action is useful for browser/app navigation but is not confirmed as a competitor command.",
      NextAction: "Keep the action data-driven, document it as project-policy navigation, and forbid it from altering competitor progression rewards.",
      AutomatedGate: "action route must have evidence.level=design_proposal and real-browser test must confirm the destination is sane; visible text must not expose project IDs.",
      HumanGate: "Tap 返回/离开 and verify it returns to the expected previous competitor screen, not a random sect or debug screen.",
      BlockingScope: "navigation_quality",
    };
  }
  if (row.Area === "chapter1" && row.Subject === "NODE_FB01_SETTLEMENT_LOOP") {
    return {
      ...base,
      ClosureGroup: "hidden_project_bridge_node",
      ClosurePolicy: "allow_hidden_only",
      PlayerImpact: "The bridge keeps the prototype loop stable but is not a visible competitor map node.",
      NextAction: "Keep hideFromMap=true and prevent it from appearing in route lists or node detail panels.",
      AutomatedGate: "browser screenshots and route-list DOM must not contain NODE_FB01_SETTLEMENT_LOOP or a visible settlement card.",
      HumanGate: "Chapter route list should contain only competitor-visible content.",
      BlockingScope: "map_presentation",
    };
  }
  return {
    ...base,
    ClosureGroup: "unclassified_p2_flow_parity",
    ClosurePolicy: "manual_review_required",
    PlayerImpact: "Unknown flow parity gap.",
    NextAction: "Trace the matching competitor code/config or mark as explicit project bridge.",
    AutomatedGate: "This row must be classified before the next acceptance claim.",
    HumanGate: "Manual review required.",
    BlockingScope: "unknown",
  };
}

fs.mkdirSync(outDir, { recursive: true });

const flow = readJson(flowPath);
const resultP2Rows = parseCsv(resultCsvPath).filter((row) => row.Severity === "P2");
const flowP2Rows = parseCsv(flowCsvPath).filter((row) => row.Severity === "P2");
const resultClosureRows = resultP2Rows.map((row) => classifyResultToken(row, flow));
const flowClosureRows = flowP2Rows.map(classifyFlowParity);
const allRows = [...resultClosureRows, ...flowClosureRows];

const columns = [
  "Domain",
  "ClosureGroup",
  "ClosurePolicy",
  "BlockingScope",
  "ItemId",
  "SourceId",
  "SourceName",
  "ResultId",
  "RuntimeStatus",
  "RequiredRuntimeBinding",
  "ActionHints",
  "ConditionTokens",
  "SourceArgs",
  "PlayerImpact",
  "NextAction",
  "AutomatedGate",
  "HumanGate",
  "EvidenceLevel",
  "SourceFile",
  "SourceRecord",
  "SourceNarrative",
];

writeCsv(path.join(outDir, "p2_result_token_closure.csv"), resultClosureRows, columns);
writeCsv(path.join(outDir, "p2_flow_parity_closure.csv"), flowClosureRows, columns);
writeCsv(path.join(outDir, "p2_closure_gate.csv"), allRows, columns);

const unclassified = allRows.filter((row) => row.ClosureGroup.startsWith("unclassified_"));
const implementRuntime = allRows.filter((row) => row.ClosurePolicy === "implement_runtime");
const deferred = allRows.filter((row) => row.ClosurePolicy === "defer_with_guard");
const allowedBridge = allRows.filter((row) => row.ClosurePolicy.startsWith("allow_"));
const summary = {
  generatedAt: new Date().toISOString(),
  resultTokenP2Rows: resultP2Rows.length,
  flowParityP2Rows: flowP2Rows.length,
  totalP2Rows: allRows.length,
  byDomain: countBy(allRows, "Domain"),
  byClosureGroup: countBy(allRows, "ClosureGroup"),
  byClosurePolicy: countBy(allRows, "ClosurePolicy"),
  byBlockingScope: countBy(allRows, "BlockingScope"),
  implementRuntimeRows: implementRuntime.length,
  deferredRows: deferred.length,
  allowedBridgeRows: allowedBridge.length,
  unclassifiedRows: unclassified.length,
  passed: unclassified.length === 0,
  outputDir: outDir,
};

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

const topGroups = Object.entries(summary.byClosureGroup)
  .sort((a, b) => b[1] - a[1])
  .map(([group, count]) => `- ${group}: ${count}`);
const implementRows = implementRuntime.map((row) => `- ${row.ClosureGroup} / ${row.ItemId}: ${row.NextAction}`);
const md = [
  "# fb01 P2 Closure Gate",
  "",
  `Generated: ${summary.generatedAt}`,
  "",
  "## What This Gate Does",
  "",
  "This gate does not claim the remaining P2 rows are done. It only accepts the next phase when every remaining P2 row is classified with a source-backed closure policy, an automated gate, and a human acceptance point.",
  "",
  "## Summary",
  "",
  `- Result-token P2 rows: ${summary.resultTokenP2Rows}`,
  `- Flow-parity P2 rows: ${summary.flowParityP2Rows}`,
  `- Total P2 rows: ${summary.totalP2Rows}`,
  `- Unclassified rows: ${summary.unclassifiedRows}`,
  `- Runtime implementation rows: ${summary.implementRuntimeRows}`,
  `- Deferred-with-guard rows: ${summary.deferredRows}`,
  `- Allowed bridge rows: ${summary.allowedBridgeRows}`,
  "",
  "## Groups",
  "",
  ...topGroups,
  "",
  "## Runtime Work Queue",
  "",
  ...(implementRows.length ? implementRows : ["- None"]),
  "",
  "## Gate Result",
  "",
  summary.passed
    ? "PASS: all current P2 rows are classified. This is a planning/closure gate, not a product-quality pass."
    : "FAIL: at least one P2 row is unclassified and must be traced before acceptance.",
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "p2_closure_gate.md"), md, "utf8");

console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
