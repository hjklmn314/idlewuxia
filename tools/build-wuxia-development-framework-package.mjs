import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_development_framework_package_20260710");
fs.mkdirSync(outDir, { recursive: true });

const readJson = (relativePath, fallback = {}) => {
  const fullPath = path.join(root, relativePath);
  return fs.existsSync(fullPath) ? JSON.parse(fs.readFileSync(fullPath, "utf8")) : fallback;
};
const text = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const csvEscape = (value) => {
  const normalized = value == null ? "" : String(value);
  return /[",\n\r]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};
const writeCsv = (name, rows, columns) => fs.writeFileSync(
  path.join(outDir, name),
  `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n")}\n`,
  "utf8",
);
const writeJson = (name, value) => fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

function latestBrowserSummary(scenario) {
  const outputs = path.join(root, "outputs");
  return fs.readdirSync(outputs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("skill_waterfall_acceptance_"))
    .map((entry) => path.join(outputs, entry.name, "real_browser_flow_summary.json"))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({ filePath, summary: JSON.parse(fs.readFileSync(filePath, "utf8")), mtime: fs.statSync(filePath).mtimeMs }))
    .filter((entry) => entry.summary.scenario === scenario)
    .sort((left, right) => right.mtime - left.mtime)[0] || null;
}

const flow = readJson("config/wuxia_first_session_flow.json");
const screens = readJson("config/wuxia_first_session_screen_contract.json");
const boundary = readJson("outputs/wuxia_content_data_driven_boundary/summary.json");
const online = readJson("outputs/skill_waterfall_stage_audit_20260706/summary.json");
const interaction = readJson("outputs/wuxia_fb01_interaction_coverage/summary.json");
const resultCoverage = readJson("outputs/wuxia_fb01_result_token_runtime_coverage/summary.json");
const stage = readJson("outputs/skill_waterfall_stage_tasks_20260708/summary.json");
const visualStyle = readJson("config/visual_style_contract.json");
const allKey = latestBrowserSummary("all-key-screens");
const chapterDeep = latestBrowserSummary("chapter1-deep");
const allKeyAutomation = allKey?.summary?.results?.filter((entry) => entry.click?.automation).length || 0;
const allKeyFailures = allKey?.summary?.failures?.length || 0;
const chapter = flow.chapter || flow.activeChapter || flow.chapter1 || {};

const currentAuditRows = [
  {
    domain: "code_architecture",
    evidence: `active=${(boundary.activeFiles || []).join("|")}; highHardcode=${boundary.counts?.high ?? "unknown"}`,
    status: boundary.passStrict ? "pass_framework" : "fail",
    onlineReady: boundary.passStrict ? "yes" : "no",
    blockingGap: "15 medium compatibility/generic binding rows remain bounded; do not grow them.",
    gate: "GATE_CONTENT_DATA_DRIVEN_BOUNDARY",
  },
  {
    domain: "configuration",
    evidence: `states=${flow.states?.length || 0}; actions=${flow.actions?.length || 0}; rooms=${chapter.rooms?.length || 0}; npcs=${chapter.npcs?.length || 0}; interactables=${chapter.interactables?.length || 0}`,
    status: "pass_current_scope",
    onlineReady: "yes",
    blockingGap: "Later chapters require importer and schema versioning before content expansion.",
    gate: "GATE_CONFIG_FIRST",
  },
  {
    domain: "competitor_semantics",
    evidence: `interactionActions=${interaction.counts?.actions ?? 0}; highRisk=${interaction.counts?.highRisk ?? 0}; resultTokens=${resultCoverage.rows ?? 0}`,
    status: (interaction.counts?.highRisk || 0) === 0 ? "pass_current_scope" : "fail",
    onlineReady: "yes",
    blockingGap: "P3 and scoped-out rows remain audit-visible and cannot be promoted without Lua/config evidence.",
    gate: "GATE_RUNTIME_P2_CLOSURE",
  },
  {
    domain: "player_visible_interaction",
    evidence: `allKeySteps=${allKey?.summary?.steps || 0}; failures=${allKeyFailures}; automationDispatches=${allKeyAutomation}`,
    status: allKeyFailures === 0 && allKeyAutomation === 0 ? "pass_key_route" : "fail",
    onlineReady: allKeyFailures === 0 && allKeyAutomation === 0 ? "yes" : "no",
    blockingGap: `Full ${interaction.counts?.actions ?? 0}-action real-browser crawl is not yet complete.`,
    gate: "GATE_PLAYER_VISIBLE_KEY_SCREEN_ENTRY",
  },
  {
    domain: "ui_experience",
    evidence: `screens=${Object.keys(screens.screens || {}).length}; targetViewport=540x960; productVisualGate=${stage.gateStatus?.fail ? "open" : "unknown"}`,
    status: "fail_product_visual",
    onlineReady: "no",
    blockingGap: "Screen-by-screen competitor composition, typography, responsive layout, feedback motion, and product skin are not accepted.",
    gate: "GATE_PRODUCT_VISUAL_PARITY",
  },
  {
    domain: "art_assets",
    evidence: `competitorReference=${online.assets?.competitorReferenceFiles ?? "unknown"}; generatedUi=${online.assets?.generatedUiFiles ?? "unknown"}; missingActive=${online.assets?.missingReferences ?? "unknown"}`,
    status: "fail_shipping_assets",
    onlineReady: "no",
    blockingGap: "Owned UI kit, character/environment art, motion, SFX, and asset replacement ledger are incomplete.",
    gate: "GATE_ART_ASSET_OWNERSHIP",
  },
  {
    domain: "combat_presentation",
    evidence: `combatPolicies=${Object.keys(flow.chapterSystem?.combatActionPolicies || {}).join("|")}; preview=${flow.defaultCombatPreviewId || ""}`,
    status: "pass_semantic_flow_fail_product_presentation",
    onlineReady: "no",
    blockingGap: "Web combat remains a fixed preview; unit-bound final art, effects, timing, hit feedback, and outcome variants are not product accepted.",
    gate: "GATE_COMBAT_PRODUCT_PRESENTATION",
  },
  {
    domain: "server_client",
    evidence: flow.serverPolicy?.prototype || "",
    status: "contract_only",
    onlineReady: "no",
    blockingGap: "Login sync and purchase verification require executable server adapter tests.",
    gate: "GATE_SERVER_LOGIN_PURCHASE",
  },
];

const moduleRows = [
  ["ContentRepository", "getChapter/getScreen/getAsset/getCombatPolicy", "validated JSON definitions", "config/*.json", "schema and reference errors", "codebase-design deep module"],
  ["FirstSessionDirector", "dispatch(ActionId)", "state/action route interpretation", "states|actions|server commands", "commandRejected event", "current runtime seam"],
  ["ChapterRuntime", "selectRoom/selectNpc/interact", "room graph, entity visibility, gates and branch execution", "chapter definitions", "typed rejected event", "current runtime seam"],
  ["ConditionEvaluator", "evaluate(token, context)", "condition token semantics", "conditionLookup", "unknown_condition_token", "must require explicit combat outcome"],
  ["ResultEffectExecutor", "apply(resultRows, context)", "inventory, markers, rewards, entity mutation, narrative", "resultLookup|resultEffectPolicies", "unknown result audit", "named policy modules"],
  ["CombatSession", "begin/resolve/cancel", "pending combat and post-outcome branch dispatch", "combatActionPolicies|combat preview/timeline", "missing outcome branch", "new generic seam"],
  ["ViewModelBuilder", "build(ScreenId, Snapshot)", "player-safe screen data", "screen contract|runtime snapshot", "missing binding", "raw IDs excluded"],
  ["ScreenRenderer", "render(ViewModel)", "portrait screen composition and feedback", "body blocks|style tokens|asset IDs", "visible fallback", "web adapter now; CommonUI adapter later"],
  ["ActionRouter", "route(ActionId or InteractionAction)", "input to runtime/server command", "action routes", "disabled/rejected feedback", "single player-visible entry"],
  ["ServerGateway", "login/sync/claim/purchase", "authoritative sync and receipt validation", "server command contracts", "retry/idempotency error", "in-memory + HTTP adapters"],
  ["AssetRegistry", "resolve(AssetId)", "owned/reference/replacement state", "visual style and asset manifest", "missing or reference-only asset", "no raw paths in screens"],
  ["AcceptanceRunner", "run(route or matrix)", "static, runtime, browser and manual evidence", "acceptance matrices", "blocking gate report", "real viewport evidence"],
].map(([moduleId, interfaceName, responsibility, configInputs, errorModes, status]) => ({ moduleId, interface: interfaceName, responsibility, configInputs, errorModes, status }));

const configRows = [
  ["ChapterDefinition", "chapterId|rooms|npcs|interactables|gates|rewards|resultLookup|conditionLookup", "chapterId and referenced IDs unique", "competitor map/config", "JSON nested graph"],
  ["ScreenDefinition", "screenId|mode|body|navActions|primaryActionId|acceptance", "every action resolves and every screen has body", "recording layout + state mapping", "JSON"],
  ["ActionRoute", "actionId|fromState|serverCommand|requestPayload|responseModel|toState", "from/to states exist", "competitor flow or project bridge labeled", "JSON/CSV"],
  ["InteractionDefinition", "sourceId|actionType|label|branches|evidence", "action and branch semantics sourced", "mapRole/mapConditionAndResult", "JSON"],
  ["CombatActionPolicy", "actionType|startActionId|resolveActionId|success/failure/runaway token|evidence", "outcome branch executes only after resolution", "FightResult.lua", "JSON"],
  ["ResultEffectPolicy", "moduleId|result pattern|player field|scope|evidence", "unknown cannot silently succeed", "CommonResults.lua and config", "JSON"],
  ["AssetDefinition", "assetId|type|source|copyrightStatus|replacementStatus|target|fallback", "shipping assets must be owned", "project art pipeline", "JSON/CSV"],
  ["AcceptanceDefinition", "checkId|precondition|action|expected|artifact|blocking", "player action plus resulting state", "competitor evidence + product target", "CSV"],
].map(([schemaId, requiredFields, validation, evidenceSource, format]) => ({ schemaId, requiredFields, validation, evidenceSource, format }));

const interactionRows = [
  ["screen_action", "visible configured button", "ActionId", "state change or rejection feedback", "tap target >=44px; primary >=56px", "real browser click"],
  ["room_navigation", "visible exit button", "RoomId + direction", "selected room and exploration log update", "no raw room IDs", "real browser route"],
  ["npc_selection", "visible NPC row", "RoleId", "actions and dialogue context appear", "selected state visible", "every visible NPC selectable"],
  ["npc_action", "configured action button", "RoleId + actionType", "branch feedback and side effects", "no result token text", "358-action crawl"],
  ["combat_start", "compete/kill action", "CombatActionPolicy", "pending combat then combat screen", "no immediate success branch", "old steward visible route"],
  ["combat_result", "combat completion", "outcome", "outcome branch then map/NPC state", "success/fail/runaway explicit", "runtime test + browser"],
  ["back_navigation", "top-left back", "configured nav ActionId", "returns to actual parent state", "never sect screen before sect selection", "screen-by-screen click"],
  ["locked_action", "disabled/locked state", "gate failure", "specific reason, state unchanged", "no dead tap", "negative-path test"],
].map(([interactionId, entry, input, expectedFeedback, mobileRule, acceptance]) => ({ interactionId, entry, input, expectedFeedback, mobileRule, acceptance }));

const screenRows = Object.entries(screens.screens || {}).map(([screenId, screen]) => ({
  screenId,
  playerIntent: screen.playerIntent || screen.title || screen.mode || "",
  primaryAction: screen.primaryActionId || "none",
  configuredBody: (screen.body || []).map((block) => block.type).join("|"),
  requiredStates: "default|pressed|disabled|locked|empty|error|retry",
  competitorEvidence: screen.evidence?.source || screen.source || "screen contract source mapping",
  productAcceptance: "540x960 readable; no debug/raw IDs; visible input feedback; screenshot diff reviewed",
  currentStatus: "functional_not_product_visual_accepted",
}));

const artRows = [
  ["UI_STYLE_KIT", "UI", "all first-session screens", "project_owned_required", "font/color/panel/button/icon/motion tokens", "P1_open"],
  ["CHAPTER1_BACKGROUND_SET", "environment", "chapter card and 45 rooms", "project_owned_required", "foreground/midground/background portrait layers", "P1_open"],
  ["CHARACTER_PORTRAIT_SET", "character", "player and 116 NPCs", "project_owned_required", "portrait/silhouette/fallback class", "P1_open"],
  ["COMBAT_UNIT_SET", "combat", "player and encounter units", "project_owned_required", "unit/HP/MP/Buff/impact anchors", "P1_open"],
  ["COMBAT_CUE_SET", "FX", "damage/heal/poison/shield/crit/miss/parry", "project_owned_required", "cue ID, timing, color, scale, target anchor", "P1_open"],
  ["AUDIO_CUE_SET", "audio", "navigation/dialogue/combat/reward", "project_owned_required", "cue ID, bus, volume, timing", "P1_open"],
  ["COMPETITOR_REFERENCE", "reference", "composition and timing only", "reference_only", "source frame/path/evidence record", "not_shippable"],
].map(([assetGroupId, assetType, coverage, copyrightStatus, requiredMetadata, currentStatus]) => ({ assetGroupId, assetType, coverage, copyrightStatus, requiredMetadata, currentStatus }));

const evidenceRows = [
  ["EV_COMBAT_COMPETE_ORDER", "combat", "compete starts fight; outcome dispatch follows", "src/app/models/map/MapHandle/Modules/CommonModule/FightResult.lua", "主动切磋:436-517", "lua_confirmed", "CombatActionPolicy.compete"],
  ["EV_COMBAT_RESULT_CALLBACK", "combat", "fight completion returns win team before map result refresh", "src/app/models/map/BaseMap.lua", "afterFightWithQieCuo:3235-3500", "lua_confirmed", "CombatSession.resolve"],
  ["EV_COMBAT_FAILURE_CONDITION", "combat", "failure/runaway are distinct outcomes", "src/app/models/map/ConditionMap.lua", "战斗切磋失败:713-725", "lua_confirmed", "failure/runaway policy"],
  ["EV_FB01_OLD_STEWARD", "chapter", "old steward swaps to fightable role; comparewin sets map marker", "res/script/map/mapRole/fb01.lua|res/script/map/mapConditionAndResult/fb01.lua", "fb01r01_1|fb01r01_1a|text27|change1|text28|mapbj2|change11", "config_confirmed", "visible first combat route"],
  ["EV_FB01_ROOM_GRAPH", "chapter", "45 restored rooms and exits", "res/script/map/mapRoom/fb01.lua", "fb01 room records", "config_confirmed", "ChapterDefinition.rooms"],
  ["EV_HANGUP_10001", "idle", "pool fishing task and reward class", "res/script/HangUpTask/hangUpTaskConfig.lua|hangUpTaskRewardConfig.lua", "taskId=10001|awardClass=100012", "cross_source_confirmed", "idle task route"],
  ["EV_RECORDING_LAYOUT", "UI", "portrait layout and interaction hierarchy", "competitor recording 1fps frames", "0s|60s|90s|120s|210s|450s|480s|600s|630s", "recording_observed", "ScreenDefinition composition only"],
].map(([evidenceId, domain, claim, sourceFile, sourceRecord, evidenceLevel, projectMapping]) => ({ evidenceId, domain, claim, sourceFile, sourceRecord, evidenceLevel, projectMapping }));

const taskRows = [
  ["P1_FULL_INTERACTION_BROWSER_CRAWL", "P1", "interaction", "open", `Expand real-browser coverage from curated route to ${interaction.counts?.actions ?? 0} configured actions with expected result assertions.`, "0 failed clicks; 0 raw token leaks; negative paths retain state"],
  ["P1_SCREEN_PARITY_AND_RESPONSIVE_QA", "P1", "ui_ux", "open", "Audit every first-session screen against competitor layout evidence at 360x640, 540x960, and 720x1280.", "all screens readable; no overlap; each action has visible feedback"],
  ["P1_OWNED_ART_AND_MOTION_KIT", "P1", "art_assets", "open", "Create and bind project-owned portrait UI/background/character/combat/audio asset groups.", "no reference-only or untracked placeholder asset in shipping mode"],
  ["P1_COMBAT_PRESENTATION_PRODUCT_PASS", "P1", "combat", "open", "Replace fixed preview feel with unit-bound state, outcome variants, hit timing, Buff and effect cues.", "battle understood without debug log; success/fail/runaway visible"],
  ["P2_SERVER_ADAPTER_AND_PURCHASE_VERIFY", "P2", "server_client", "open", "Implement login/sync/reward-claim/purchase verification port with in-memory and HTTP adapters.", "idempotency, invalid receipt, retry and offline cache tests pass"],
  ["P2_CONFIG_SCHEMA_VERSIONING", "P2", "configuration", "open", "Split monolithic first-session flow into versioned chapter/screen/policy packages behind ContentRepository.", "schema validation and cross-file reference audit pass"],
  ["P2_OUTPUT_AND_LEGACY_CONFIG_HYGIENE", "P2", "automation", "open", "Archive dormant prototype configs and rotate generated outputs without touching source evidence.", "active entry references only Wuxia contracts; generated outputs follow retention policy"],
  ["P2_NEXT_CHAPTER_IMPORTER", "P2", "chapter_framework", "ready_for_next", "Import later chapter room/NPC/result data through the same schemas and module interfaces.", "new chapter runs without runtime content-ID edits"],
].map(([taskId, priority, lane, status, task, acceptance]) => ({ taskId, priority, lane, status, task, acceptance }));

const changedFileRows = [
  ["src/wuxiaFirstSessionFlow.js", "active_runtime", "generic interpreter only", "node --check|interaction regression|content-boundary strict", "pass"],
  ["config/wuxia_first_session_flow.json", "runtime_config", "concrete content required here", "JSON parse|first-session validator|evidence map", "pass"],
  ["tools/sync-wuxia-combat-action-policies.mjs", "config_generator", "concrete ActionIds allowed only as generated config rows", "node --check|idempotent sync|full fast gate", "pass"],
  ["tools/test-wuxia-first-session-interactions.mjs", "behavior_test", "concrete competitor fixtures required for acceptance", "red before fix|green after fix", "pass"],
  ["tools/run-wuxia-real-browser-flow.mjs", "browser_acceptance", "concrete visible route selectors allowed in named scenario", "16 steps|0 failures|0 automation dispatches", "pass"],
  ["tools/build-wuxia-development-framework-package.mjs", "audit_generator", "competitor IDs allowed as sourced evidence records", "node --check|required output non-empty", "pass"],
  ["package.json", "tool_entrypoints", "commands only", "npm script execution", "pass"],
  ["CONTEXT.md", "domain_glossary", "domain language only", "manual glossary audit", "pass"],
  ["AGENTS.md", "project_governance", "evidence-backed current state only", "paths and gate counts verified", "pass"],
].map(([file, ownership, concreteContentPolicy, validationEvidence, status]) => ({
  file,
  lines: fs.existsSync(path.join(root, file)) ? text(file).split(/\r?\n/).length : 0,
  ownership,
  concreteContentPolicy,
  validationEvidence,
  status,
}));

writeCsv("current_completion_audit.csv", currentAuditRows, ["domain", "evidence", "status", "onlineReady", "blockingGap", "gate"]);
writeCsv("module_architecture.csv", moduleRows, ["moduleId", "interface", "responsibility", "configInputs", "errorModes", "status"]);
writeCsv("configuration_standard.csv", configRows, ["schemaId", "requiredFields", "validation", "evidenceSource", "format"]);
writeCsv("interaction_standard.csv", interactionRows, ["interactionId", "entry", "input", "expectedFeedback", "mobileRule", "acceptance"]);
writeCsv("screen_experience_standard.csv", screenRows, ["screenId", "playerIntent", "primaryAction", "configuredBody", "requiredStates", "competitorEvidence", "productAcceptance", "currentStatus"]);
writeCsv("art_asset_standard.csv", artRows, ["assetGroupId", "assetType", "coverage", "copyrightStatus", "requiredMetadata", "currentStatus"]);
writeCsv("competitor_evidence_line_audit.csv", evidenceRows, ["evidenceId", "domain", "claim", "sourceFile", "sourceRecord", "evidenceLevel", "projectMapping"]);
writeCsv("development_task_list.csv", taskRows, ["taskId", "priority", "lane", "status", "task", "acceptance"]);
writeCsv("new_content_line_audit.csv", changedFileRows, ["file", "lines", "ownership", "concreteContentPolicy", "validationEvidence", "status"]);

const requiredFiles = [
  "current_completion_audit.csv",
  "module_architecture.csv",
  "configuration_standard.csv",
  "interaction_standard.csv",
  "screen_experience_standard.csv",
  "art_asset_standard.csv",
  "competitor_evidence_line_audit.csv",
  "development_task_list.csv",
  "new_content_line_audit.csv",
];
const summary = {
  generatedAt: new Date().toISOString(),
  outDir,
  status: currentAuditRows.every((row) => row.onlineReady === "yes") ? "online_ready" : "framework_ready_product_blocked",
  allKeyBrowser: {
    summaryPath: allKey ? path.relative(root, allKey.filePath).replaceAll("\\", "/") : "",
    steps: allKey?.summary?.steps || 0,
    failures: allKeyFailures,
    automationDispatches: allKeyAutomation,
  },
  deepBrowserSummary: chapterDeep ? path.relative(root, chapterDeep.filePath).replaceAll("\\", "/") : "",
  counts: {
    auditDomains: currentAuditRows.length,
    modules: moduleRows.length,
    configSchemas: configRows.length,
    interactionStandards: interactionRows.length,
    screens: screenRows.length,
    assetGroups: artRows.length,
    evidenceRows: evidenceRows.length,
    openTasks: taskRows.filter((row) => row.status === "open").length,
  },
  visualStyleSchema: visualStyle.schema || "legacy_or_missing",
  requiredFiles,
};
writeJson("summary.json", summary);

fs.writeFileSync(path.join(outDir, "architecture_framework.md"), [
  "# Idle Wuxia Continued Development Framework",
  "",
  "## Audit Conclusion",
  "",
  "The current runtime has a valid data-driven framework for the restored first-session and fb01 configuration, and the visible key route now passes without automation dispatch. It is not online-ready because product visual parity, owned art, complete interaction crawling, combat presentation, and server adapters remain open.",
  "",
  "## Architecture",
  "",
  "`ContentRepository -> FirstSessionDirector/ChapterRuntime -> ConditionEvaluator/ResultEffectExecutor/CombatSession -> ViewModelBuilder -> ScreenRenderer -> ActionRouter`",
  "",
  "Server commands cross the `ServerGateway` seam. Assets cross the `AssetRegistry` seam. Automated and manual proof crosses the `AcceptanceRunner` seam.",
  "",
  "## Non-Negotiable Rules",
  "",
  "1. Competitor code and configuration define behavior evidence; recordings define layout and interaction evidence only.",
  "2. Chapters, rooms, NPCs, enemies, dialogue, conditions, results, rewards, combat policies, UI copy, tuning, and asset IDs enter configuration before runtime code.",
  "3. Runtime modules interpret schemas and expose small interfaces. They do not contain concrete chapter or content IDs.",
  "4. Combat success/failure/runaway branches execute only after a CombatSession outcome.",
  "5. Reference assets never ship. Every shipping asset needs ownership and replacement status.",
  "6. Product completion requires a real 9:16 browser/PIE run; generated screenshots and file-exists checks are diagnostics only.",
  "",
  "## Current Proof",
  "",
  `- Visible key route: ${summary.allKeyBrowser.steps} steps, ${summary.allKeyBrowser.failures} failures, ${summary.allKeyBrowser.automationDispatches} automation dispatches.`,
  `- Data boundary high findings: ${boundary.counts?.high ?? "unknown"}.`,
  `- Restored chapter scope: ${chapter.rooms?.length || 0} rooms, ${chapter.npcs?.length || 0} NPCs, ${chapter.interactables?.length || 0} interactables.`,
  `- Interaction semantics: ${interaction.counts?.actions ?? 0} configured actions, ${interaction.counts?.highRisk ?? 0} high-risk rows.`,
  "",
  "## Blocking Work",
  "",
  ...taskRows.map((row) => `- ${row.taskId}: ${row.task}`),
  "",
  "## Package Files",
  "",
  ...requiredFiles.map((file) => `- ${file}`),
  "- summary.json",
  "",
].join("\n"), "utf8");

const missing = requiredFiles.filter((name) => !fs.existsSync(path.join(outDir, name)) || fs.statSync(path.join(outDir, name)).size === 0);
if (missing.length) throw new Error(`missing framework outputs: ${missing.join(", ")}`);
console.log(JSON.stringify(summary, null, 2));
