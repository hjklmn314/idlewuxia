import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const configPath = path.join(root, "config", "wuxia_first_session_flow.json");
const outputDir = path.join(root, "outputs", "wuxia_fb01_interaction_coverage");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function normalizeLines(lines) {
  return Array.isArray(lines) ? lines.filter(Boolean) : [];
}

const GLOBAL_NPC_ACTIONS = new Set(["present", "sale", "compete", "kill", "apprentice"]);
const GLOBAL_INTERACTABLE_ACTIONS = new Set(["pickup"]);
let configuredCombatActionTypes = new Set();

function branchForAction(entry, actionType, kind) {
  const branches = Array.isArray(entry.branches) ? entry.branches : [];
  const exact = branches.find((branch) => (branch.actionHints || []).includes(actionType));
  if (exact) {
    const hasUnroutedChoiceResult = (exact.resolvedResults || []).some((result) => /choice|tankuang/i.test(result.resultId || ""));
    if (hasUnroutedChoiceResult) {
      return { branch: exact, matchPolicy: "unrouted_choice_intentionally_hidden" };
    }
    const hasUnroutedCombatResult = !configuredCombatActionTypes.has(actionType)
      && (exact.resolvedResults || []).some((result) => result.category === "combat");
    if (hasUnroutedCombatResult) {
      return { branch: exact, matchPolicy: "unrouted_combat_intentionally_hidden" };
    }
    return { branch: exact, matchPolicy: "exact_action_hint" };
  }
  if (kind === "npc") {
    if (actionType === "talk") {
      const narrative = branches.find((branch) => normalizeLines(branch.narrativeLines).length);
      if (narrative) return { branch: narrative, matchPolicy: "talk_narrative_fallback" };
      if (normalizeLines(entry.defaultNarrativeLines).length) {
        return {
          branch: {
            order: "words",
            conditionTokens: ["words"],
            resultTokens: [],
            narrativeLines: entry.defaultNarrativeLines,
            evidenceLevel: "lua_confirmed",
          },
          matchPolicy: "default_words",
        };
      }
      return { branch: branches[0] || null, matchPolicy: branches[0] ? "talk_first_branch_fallback" : "no_branch" };
    }
    if (configuredCombatActionTypes.has(actionType)) {
      return { branch: null, matchPolicy: "configured_combat_action_policy" };
    }
    if (GLOBAL_NPC_ACTIONS.has(actionType)) {
      return { branch: null, matchPolicy: `global_${actionType}_intentionally_hidden_no_runtime_branch` };
    }
    return { branch: null, matchPolicy: branches.length ? "no_exact_action_branch" : "no_branch" };
  }
  if (kind === "interactable") {
    if (GLOBAL_INTERACTABLE_ACTIONS.has(actionType)) {
      return { branch: null, matchPolicy: `global_${actionType}_intentionally_hidden_no_runtime_branch` };
    }
    const narrative = branches.find((branch) => normalizeLines(branch.narrativeLines).length);
    if (narrative) return { branch: narrative, matchPolicy: "narrative_fallback" };
  }
  return { branch: branches[0] || null, matchPolicy: branches[0] ? "first_branch_runtime_fallback" : "no_branch" };
}

function statusForBranch(branch, matchPolicy) {
  if (matchPolicy === "default_words") return "default_words_confirmed";
  if (matchPolicy === "configured_combat_action_policy") return "configured_combat_action_policy";
  if (matchPolicy === "unrouted_choice_intentionally_hidden") return "intentionally_hidden_postponed_choice_ui";
  if (matchPolicy === "unrouted_combat_intentionally_hidden") return "intentionally_hidden_postponed_combat";
  if (matchPolicy.startsWith("global_")) return "intentionally_hidden_no_runtime_branch";
  if (!branch) return "missing_branch";
  const narrativeLines = normalizeLines(branch.narrativeLines);
  const resultTokens = Array.isArray(branch.resultTokens) ? branch.resultTokens.filter(Boolean) : [];
  if (matchPolicy.endsWith("fallback")) {
    if (narrativeLines.length) return "fallback_branch_with_narrative";
    if (resultTokens.length) return "fallback_branch_token_only";
    return "fallback_branch_empty";
  }
  if (narrativeLines.length) return "exact_branch_with_narrative";
  if (resultTokens.length) return "exact_branch_token_only";
  return "exact_branch_empty";
}

function actionRowsFor(entry, kind) {
  const idKey = kind === "npc" ? "roleId" : "interactableId";
  const name = entry.name || entry.displayName?.zhCN || "";
  const actions = Array.isArray(entry.actions) ? entry.actions : [];
  return actions.map((action) => {
    const actionType = action.actionType || "";
    const { branch, matchPolicy } = branchForAction(entry, actionType, kind);
    const narrativeLines = normalizeLines(branch?.narrativeLines);
    const resultTokens = Array.isArray(branch?.resultTokens) ? branch.resultTokens.filter(Boolean) : [];
    return {
      kind,
      id: entry[idKey] || "",
      name,
      actionType,
      actionLabel: action.label || "",
      status: statusForBranch(branch, matchPolicy),
      matchPolicy,
      branchOrder: branch?.order ?? "",
      narrativeCount: narrativeLines.length,
      resultTokens: resultTokens.join(";"),
      narrativePreview: narrativeLines.join(" / ").slice(0, 180),
      evidenceLevel: branch?.evidenceLevel || action.evidenceLevel || entry.evidence?.level || "",
      sourceEvidence: entry.evidence?.sourceEvidence || "",
    };
  });
}

const data = readJson(configPath);
configuredCombatActionTypes = new Set(Object.keys(data.chapterSystem?.combatActionPolicies || {}));
const npcs = data.chapter1?.npcs || [];
const interactables = data.chapter1?.interactables || [];
const rows = [
  ...npcs.flatMap((npc) => actionRowsFor(npc, "npc")),
  ...interactables.flatMap((item) => actionRowsFor(item, "interactable")),
];

const byStatus = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});
const byKind = rows.reduce((acc, row) => {
  acc[row.kind] = (acc[row.kind] || 0) + 1;
  return acc;
}, {});
const highRisk = rows.filter((row) => [
  "missing_branch",
  "fallback_branch_empty",
  "fallback_branch_token_only",
  "first_branch_runtime_fallback",
].includes(row.status) || row.matchPolicy === "first_branch_runtime_fallback");

ensureDir(outputDir);
const columns = [
  "kind",
  "id",
  "name",
  "actionType",
  "actionLabel",
  "status",
  "matchPolicy",
  "branchOrder",
  "narrativeCount",
  "resultTokens",
  "narrativePreview",
  "evidenceLevel",
  "sourceEvidence",
];
writeCsv(path.join(outputDir, "fb01_interaction_action_coverage.csv"), rows, columns);
writeCsv(path.join(outputDir, "fb01_interaction_high_risk.csv"), highRisk, columns);

const summary = {
  generatedAt: new Date().toISOString(),
  configPath,
  counts: {
    npcs: npcs.length,
    interactables: interactables.length,
    actions: rows.length,
    highRisk: highRisk.length,
  },
  byKind,
  byStatus,
  outputDir,
};
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));


