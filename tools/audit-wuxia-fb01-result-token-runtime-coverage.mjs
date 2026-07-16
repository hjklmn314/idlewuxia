import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_fb01_result_token_runtime_coverage");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
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

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function matchesAnyPattern(value = "", patterns = []) {
  const text = String(value || "");
  return (patterns || []).some((pattern) => {
    if (!pattern) return false;
    const startsWithWildcard = pattern.startsWith("*");
    const endsWithWildcard = pattern.endsWith("*");
    const needle = pattern.replace(/^\*/, "").replace(/\*$/, "");
    if (startsWithWildcard && endsWithWildcard) return text.includes(needle);
    if (startsWithWildcard) return text.endsWith(needle);
    if (endsWithWildcard) return text.startsWith(needle);
    return text === pattern;
  });
}

function effectPolicies(flow = {}) {
  return flow.chapterSystem?.resultEffectPolicies || {};
}

function matchesOfficialMeritResult(result = {}, flow = {}) {
  const policy = effectPolicies(flow).officialMerit || {};
  return (
    result.action === (policy.actionName || "改变政绩")
    || matchesAnyPattern(result.resultId, policy.resultIdPatterns || [])
  );
}

function matchesSeasonalActivityResult(result = {}, flow = {}) {
  const policy = effectPolicies(flow).seasonalActivity || {};
  return (
    (policy.actionNames || []).includes(result.action)
    || matchesAnyPattern(result.resultId, policy.resultIdPatterns || [])
  );
}

function runtimeStatus(result = {}) {
  const category = result.category || "";
  const action = result.action || "";
  const hasNarrative = (result.narrativeLines || []).filter(Boolean).length > 0;
  if (category === "narrative_feedback" && hasNarrative) return "implemented_text_feedback";
  if (category === "narrative_feedback") return "partial_empty_text_feedback";
  if (category === "other" && action === "阻止玩家移动") return "not_executed_navigation_block";
  if (category === "other" && ["换人", "添加人物", "删除人物", "删除自身"].includes(action)) return "not_executed_entity_mutation";
  if (category === "map_state") return "not_executed_map_state";
  if (category === "role_state") return "not_executed_player_or_role_state";
  if (category === "attribute_reward") return "not_executed_attribute_reward";
  if (category === "item_reward_or_cost") return "not_executed_item_reward_or_cost";
  if (category === "skill_progression") return "implemented_skill_exp_delta";
  if (category === "combat") return "not_executed_combat_trigger";
  if (category === "other") return "not_executed_other_side_effect";
  return "unknown_result_semantics";
}

function runtimeStatusV2(result = {}, source = {}, flow = {}) {
  const category = result.category || "";
  const action = result.action || "";
  const resultId = result.resultId || "";
  const hasNarrative = (result.narrativeLines || []).filter(Boolean).length > 0;
  if (category === "narrative_feedback" && hasNarrative) return "implemented_text_feedback";
  if (category === "narrative_feedback") return "partial_empty_text_feedback";
  if (category === "other" && (action === "阻止玩家移动" || resultId === "stop")) return "implemented_navigation_block";
  if (
    category === "other"
    && (
      action === "换人"
      || action === "添加人物"
      || action === "删除人物"
      || action === "删除自身"
      || /^(bf1?change|cg2change|change|shuchange|tmchange|znqgzxlhr)/.test(resultId)
      || /^(bf1?addnpc|cg2addnpc|additem2)$/.test(resultId)
      || /^(cg2delnpc|delete)$/.test(resultId)
    )
  ) return "implemented_entity_mutation";
  if (category === "map_state") return "implemented_map_state";
  if (category === "role_state") return "implemented_player_marker";
  if (category === "attribute_reward") return "implemented_attribute_reward";
  if (category === "item_reward_or_cost" && (action === "物品合成" || resultId.includes("hecheng"))) {
    return result.args?.Arg2 && result.args?.Arg3 ? "implemented_item_crafting_recipe" : "not_executed_item_crafting_recipe";
  }
  if (category === "item_reward_or_cost") return "implemented_inventory_delta";
  if (category === "skill_progression") return "implemented_skill_exp_delta";
  if (category === "combat" && resultId === "compare") {
    const hasCompareWinBranch = (source.branches || []).some((branch) => (branch.conditionTokens || []).includes("comparewin"));
    return hasCompareWinBranch ? "implemented_combat_compare_to_comparewin" : "recorded_combat_trigger_not_resolved";
  }
  if (category === "combat" && /^inattack/.test(resultId)) {
    const autoTextId = result.args?.Arg3 || "";
    return autoTextId && flow.chapter1?.resultLookup?.[autoTextId]
      ? "implemented_inheritance_combat_autotext"
      : "recorded_combat_trigger_not_resolved";
  }
  if (category === "combat") return "recorded_combat_trigger_not_resolved";
  if (category === "other" && /^tmstory/.test(resultId)) return "implemented_story_dialogue_feedback";
  if (category === "other" && (action === "玩家时间标记设置" || action === "玩家定时标记设置" || resultId.includes("timebj") || resultId.includes("dingshi"))) return "implemented_time_marker";
  if (category === "other" && matchesOfficialMeritResult(result, flow)) return "implemented_official_merit_ledger";
  if (category === "other" && matchesSeasonalActivityResult(result, flow)) return "scoped_out_seasonal_activity_module_disabled";
  if (category === "other") return "not_executed_other_side_effect";
  return "unknown_result_semantics";
}

function severityFor(row) {
  if (row.RuntimeStatus.startsWith("implemented_")) return "P3";
  if (row.RuntimeStatus.startsWith("scoped_out_")) return "P3";
  if (row.RuntimeStatus === "partial_empty_text_feedback") return "P2";
  if (
    row.SourceId === "fb01r01_1"
    || row.SourceId === "fb01r02_1"
    || row.SourceId === "fb01r02_1b"
    || row.SourceId === "fb01r02_2"
    || row.SourceId === "fb01r04_1"
    || row.SourceId === "fb01item_16"
    || row.SourceId === "fb01item_5"
  ) {
    return "P0";
  }
  if (
    row.RuntimeStatus === "not_executed_entity_mutation"
    || row.RuntimeStatus === "not_executed_map_state"
    || row.RuntimeStatus === "not_executed_navigation_block"
    || row.RuntimeStatus === "recorded_navigation_stop_not_enforced"
    || row.RuntimeStatus === "not_executed_attribute_reward"
    || row.RuntimeStatus === "not_executed_item_reward_or_cost"
    || row.RuntimeStatus === "not_executed_item_crafting_recipe"
    || row.RuntimeStatus === "not_executed_combat_trigger"
    || row.RuntimeStatus === "recorded_combat_trigger_not_resolved"
  ) {
    return "P1";
  }
  return "P2";
}

function sourceRows(flow, collectionName, kind) {
  const output = [];
  for (const source of flow.chapter1?.[collectionName] || []) {
    const sourceId = source.roleId || source.interactableId || "";
    const sourceName = source.name || source.displayName?.zhCN || "";
    for (const branch of source.branches || []) {
      const resultTokens = branch.resultTokens || [];
      for (const result of branch.resolvedResults || []) {
        const row = {
          Kind: kind,
          SourceId: sourceId,
          SourceName: sourceName,
          BranchOrder: branch.order || "",
          ActionHints: (branch.actionHints || []).join("|"),
          ConditionTokens: (branch.conditionTokens || []).join("|"),
          ResultId: result.resultId || "",
          Category: result.category || "",
          Action: result.action || "",
          NarrativeLines: (result.narrativeLines || []).join("|"),
          EvidenceLevel: result.evidenceLevel || branch.evidenceLevel || source.evidence?.level || "unknown",
          SourceFile: source.evidence?.resultSource || source.evidence?.source || "",
          SourceRecord: `${sourceId}#branch${branch.order || ""}`,
          RuntimeStatus: runtimeStatusV2(result, source, flow),
          RequiredRuntimeBinding: "",
          Severity: "",
        };
        row.Severity = severityFor(row);
        row.RequiredRuntimeBinding = bindingFor(row);
        output.push(row);
      }
      const missingResolved = resultTokens.filter((token) => !(branch.resolvedResults || []).some((result) => result.resultId === token));
      for (const token of missingResolved) {
        const row = {
          Kind: kind,
          SourceId: sourceId,
          SourceName: sourceName,
          BranchOrder: branch.order || "",
          ActionHints: (branch.actionHints || []).join("|"),
          ConditionTokens: (branch.conditionTokens || []).join("|"),
          ResultId: token,
          Category: "",
          Action: "",
          NarrativeLines: "",
          EvidenceLevel: "unknown",
          SourceFile: source.evidence?.resultSource || source.evidence?.source || "",
          SourceRecord: `${sourceId}#branch${branch.order || ""}`,
          RuntimeStatus: "missing_resolved_result_row",
          RequiredRuntimeBinding: "restore_result_row_before_runtime_binding",
          Severity: "P1",
        };
        output.push(row);
      }
    }
  }
  return output;
}

function bindingFor(row) {
  switch (row.RuntimeStatus) {
    case "implemented_text_feedback":
      return "already_shown_in_room_log";
    case "implemented_entity_mutation":
      return "runtime_entity_visibility_executor";
    case "implemented_map_state":
      return "runtime_map_marker_executor";
    case "implemented_player_marker":
      return "runtime_player_marker_executor";
    case "implemented_attribute_reward":
      return "runtime_attribute_reward_executor";
    case "implemented_inventory_delta":
      return "runtime_inventory_delta_executor";
    case "implemented_navigation_block":
      return "runtime_room_transition_block_executor";
    case "implemented_item_crafting_recipe":
      return "runtime_item_crafting_recipe_executor";
    case "implemented_combat_compare_to_comparewin":
      return "runtime_combat_compare_and_comparewin_executor";
    case "implemented_inheritance_combat_autotext":
      return "runtime_inheritance_combat_autotext_executor";
    case "implemented_skill_exp_delta":
      return "runtime_skill_exp_executor";
    case "implemented_time_marker":
      return "runtime_player_time_marker_executor";
    case "implemented_story_dialogue_feedback":
      return "runtime_story_dialogue_feedback";
    case "implemented_official_merit_ledger":
      return "runtime_official_merit_ledger_executor";
    case "scoped_out_seasonal_activity_module_disabled":
      return "chapter_system_module_scope_guard";
    case "partial_empty_text_feedback":
      return "suppress_empty_text_or_restore_text_source";
    case "not_executed_entity_mutation":
      return "entity_visibility_mutation_executor";
    case "not_executed_navigation_block":
      return "room_gate_and_stop_executor";
    case "recorded_navigation_stop_not_enforced":
      return "stop_token_recorded_but_room_gate_not_enforced";
    case "not_executed_map_state":
      return "map_marker_state_executor";
    case "not_executed_player_or_role_state":
      return "player_role_flag_executor";
    case "not_executed_attribute_reward":
      return "attribute_reward_executor";
    case "not_executed_item_reward_or_cost":
      return "inventory_delta_executor";
    case "not_executed_item_crafting_recipe":
      return "item_crafting_recipe_executor";
    case "not_executed_skill_progression":
      return "skill_exp_executor";
    case "not_executed_combat_trigger":
      return "combat_entry_executor";
    case "recorded_combat_trigger_not_resolved":
      return "combat_trigger_recorded_but_no_battle_resolution";
    case "not_executed_time_marker":
      return "player_time_marker_executor";
    case "not_executed_other_side_effect":
      return "specific_result_executor";
    default:
      return "manual_semantic_review";
  }
}

fs.mkdirSync(outDir, { recursive: true });

const flow = readJson(flowPath);
const rows = [
  ...sourceRows(flow, "npcs", "npc"),
  ...sourceRows(flow, "interactables", "interactable"),
];

const columns = [
  "Severity",
  "Kind",
  "SourceId",
  "SourceName",
  "BranchOrder",
  "ActionHints",
  "ConditionTokens",
  "ResultId",
  "Category",
  "Action",
  "NarrativeLines",
  "RuntimeStatus",
  "RequiredRuntimeBinding",
  "EvidenceLevel",
  "SourceFile",
  "SourceRecord",
];

writeCsv(path.join(outDir, "fb01_result_token_runtime_coverage.csv"), rows, columns);

const summary = {
  generatedAt: new Date().toISOString(),
  configPath: flowPath,
  rows: rows.length,
  bySeverity: countBy(rows, "Severity"),
  byRuntimeStatus: countBy(rows, "RuntimeStatus"),
  byBinding: countBy(rows, "RequiredRuntimeBinding"),
  p0Rows: rows.filter((row) => row.Severity === "P0").map((row) => ({
    sourceId: row.SourceId,
    sourceName: row.SourceName,
    resultId: row.ResultId,
    action: row.Action,
    runtimeStatus: row.RuntimeStatus,
    requiredRuntimeBinding: row.RequiredRuntimeBinding,
  })),
  outputDir: outDir,
};

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "report.md"), [
  "# fb01 Result Token Runtime Coverage",
  "",
  `Generated: ${summary.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Result rows: ${summary.rows}`,
  `- P0 rows: ${summary.bySeverity.P0 || 0}`,
  `- P1 rows: ${summary.bySeverity.P1 || 0}`,
  `- Implemented text feedback rows: ${summary.byRuntimeStatus.implemented_text_feedback || 0}`,
  "",
  "## Meaning",
  "",
  "- `implemented_text_feedback` means the current room log can display the restored text.",
  "- `not_executed_*` means the restored competitor result token is present but the runtime does not yet perform that side effect.",
  "- P0 rows are on the first-session gate path and must be bound before claiming startup-to-chapter completion.",
  "",
  "## P0 Rows",
  "",
  ...summary.p0Rows.map((row) => `- ${row.sourceId} ${row.sourceName}: ${row.resultId} / ${row.action} -> ${row.requiredRuntimeBinding}`),
  "",
].join("\n"), "utf8");

console.log(JSON.stringify(summary, null, 2));
