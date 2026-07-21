import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "outputs", "wuxia_predev_analysis_package_20260710");
fs.mkdirSync(outDir, { recursive: true });

const readJson = (relativePath, fallback = {}) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

const readText = (relativePath, fallback = "") => {
  const fullPath = path.join(root, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : fallback;
};

const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const writeCsv = (filePath, rows, columns) => {
  fs.writeFileSync(
    filePath,
    `${[
      columns.join(","),
      ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
    ].join("\n")}\n`,
    "utf8",
  );
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

function lineCount(relativePath) {
  const text = readText(relativePath);
  return text ? text.split(/\r?\n/).length : 0;
}

function collectActiveRuntimeFiles() {
  const indexText = readText("index.html");
  const scripts = [...indexText.matchAll(/<script[^>]+src=["']\.\/([^"']+)["']/g)].map((match) => match[1]);
  const active = new Set(["index.html", ...scripts]);
  const queue = [...scripts];
  while (queue.length) {
    const relativePath = queue.shift();
    const text = readText(relativePath);
    for (const match of text.matchAll(/import\s+[^"']*["'](\.\/[^"']+)["']/g)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), match[1]));
      if (!active.has(resolved)) {
        active.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...active].sort();
}

const flow = readJson("config/wuxia_first_session_flow.json");
const screenContract = readJson("config/wuxia_first_session_screen_contract.json");
const contentBoundary = readJson("outputs/wuxia_content_data_driven_boundary/summary.json");
const onlineStandard = readJson("outputs/skill_waterfall_stage_audit_20260706/summary.json");
const interactionCoverage = readJson("outputs/wuxia_fb01_interaction_coverage/summary.json");
const resultCoverage = readJson("outputs/wuxia_fb01_result_token_runtime_coverage/summary.json");
const p2Closure = readJson("outputs/wuxia_p2_closure_gate/summary.json");

const chapter = flow.chapter || flow.activeChapter || flow.chapter1 || {};
const sourceFiles = flow.sourceFiles || {};

const codeSurfaceRows = collectActiveRuntimeFiles().map((relativePath) => {
  const text = readText(relativePath);
  const publicFunctions = [...text.matchAll(/(?:export\s+)?function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  const imports = [...text.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((match) => match[1]);
  const configTokens = (text.match(/activeChapter|wuxiaFirstSessionFlow|wuxiaScreenContract|rewardAttributeMap|chapterSystem|resultEffectPolicies/g) || []).length;
  const concreteContentTokens = (text.match(/\bfb\d{2}\b|NODE_FB\d{2}|fb\d{2}r\d+|fb\d{2}item_\d+|无名少女|池边打鱼|华山|师门/g) || []).length;
  return {
    file: relativePath,
    lines: lineCount(relativePath),
    imports: imports.join(" | "),
    publicFunctions: publicFunctions.join(" | "),
    designRole: relativePath === "src/chapterSession.js"
      ? "stateful_chapter_session_runtime"
      : relativePath.includes("wuxiaFirstSessionFlow")
        ? "chapter_session_compatibility_facade"
      : relativePath.includes("wuxia-main")
        ? "ui_renderer_and_action_router"
        : relativePath === "index.html"
          ? "mobile_shell_entry"
          : "active_runtime_support",
    configDrivenSignals: configTokens,
    concreteContentTokens,
    requiredPolicy: concreteContentTokens === 0
      ? "keep_generic_framework"
      : "move_concrete_content_to_config_before_new_feature",
  };
});

const configRows = [
  {
    configId: "wuxia_first_session_flow",
    file: "config/wuxia_first_session_flow.json",
    designRole: "source-of-truth for states/actions/server commands/player seed/chapter package/result policies",
    records: `states=${flow.states?.length || 0}; actions=${flow.actions?.length || 0}; rooms=${chapter.rooms?.length || 0}; npcs=${chapter.npcs?.length || 0}; interactables=${chapter.interactables?.length || 0}; rewards=${chapter.rewards?.length || 0}`,
    sourceEvidence: Object.values(sourceFiles).filter(Boolean).join(" | "),
    nextRule: "new chapter content must enter this schema or chapterN package before runtime/UI code changes",
  },
  {
    configId: "wuxia_first_session_screen_contract",
    file: "config/wuxia_first_session_screen_contract.json",
    designRole: "screen/view model/body/action bindings",
    records: `screens=${Object.keys(screenContract.screens || {}).length}`,
    sourceEvidence: "first-session recording + runtime screen mapping",
    nextRule: "new UI must define ScreenId, body blocks, nav actions, primary action, and acceptance before rendering code changes",
  },
];

const competitorEvidenceRows = Object.entries(sourceFiles).map(([sourceId, sourcePath]) => ({
  sourceId,
  sourcePath,
  exists: fs.existsSync(path.join(root, sourcePath)) ? "yes" : "no",
  priority: /mapRoom|mapRole|mapCondition|hangUp|runtime_package|room_runtime|progression/.test(sourceId) ? "P0" : "P1",
  usage: sourceId.includes("mapRoom")
    ? "room graph and traversal"
    : sourceId.includes("mapRole")
      ? "NPC placement and interaction"
      : sourceId.includes("hang")
        ? "idle task/reward"
        : "flow/evidence input",
}));

const developmentGateRows = [
  {
    gateId: "GATE_PREDEV_LINE_ANALYSIS",
    rule: "Before new content, produce line/module analysis for active runtime and source competitor files.",
    artifact: "code_surface_analysis.csv + competitor_evidence_sources.csv",
    blocking: "yes",
  },
  {
    gateId: "GATE_CONFIG_FIRST",
    rule: "Chapters, map nodes, NPCs, enemies, story text, rewards, gates, assets, and tuning values enter JSON/config first.",
    artifact: "content_data_driven_boundary_report.md + config_contract_matrix.csv",
    blocking: "yes",
  },
  {
    gateId: "GATE_DESIGN_PACKAGE",
    rule: "Design must separate confirmed competitor facts, tested inference, project proposal, and unknowns.",
    artifact: "evidence ledger and implementation package",
    blocking: "yes",
  },
  {
    gateId: "GATE_IMPLEMENTATION_SEAM",
    rule: "Code changes must extend a reusable module/interface, not add concrete branch-specific logic.",
    artifact: "implementation_plan.md module/interface section",
    blocking: "yes",
  },
  {
    gateId: "GATE_REAL_ACCEPTANCE",
    rule: "Claims require automated checks plus browser/PIE/manual evidence appropriate to platform.",
    artifact: "acceptance matrix + screenshot/video/log summary",
    blocking: "yes",
  },
];

const assetGovernanceRows = [
  {
    domain: "reference assets",
    rule: "Competitor assets are evidence/reference only and cannot be shipped directly.",
    currentEvidence: `competitorReferenceFiles=${onlineStandard.assets?.competitorReferenceFiles ?? "unknown"}`,
    nextAction: "replace with owned art kit or generated/commissioned assets before product claim",
  },
  {
    domain: "generated UI assets",
    rule: "Generated placeholder assets must have ownership and style status before being called product-ready.",
    currentEvidence: `generatedUiFiles=${onlineStandard.assets?.generatedUiFiles ?? "unknown"}`,
    nextAction: "bind each screen to owned asset rows and readability acceptance",
  },
  {
    domain: "runtime assets",
    rule: "Active entry references must be zero-missing and data-bound.",
    currentEvidence: `referencedByActiveEntry=${onlineStandard.assets?.referencedByActiveEntry ?? "unknown"}; missing=${onlineStandard.assets?.missingReferences ?? "unknown"}`,
    nextAction: "keep in active-entry validation",
  },
];

const algorithmRows = [
  {
    algorithmId: "first_session_state_machine",
    ownerModule: "src/chapterSession.js",
    inputData: "states/actions/rewardClasses/chapter/resultEffectPolicies",
    interface: "createChapterSession(definitions, options); createFirstSessionRuntime remains a compatibility facade",
    policy: "state transitions and rewards are data interpreted, not UI-authored",
    currentRisk: contentBoundary.passStrict ? "low" : "high_content_hardcode",
  },
  {
    algorithmId: "chapter_room_interaction_executor",
    ownerModule: "src/entityInteractionService.js + src/chapterSession.js",
    inputData: "rooms/npcs/interactables/conditionLookup/resultLookup",
    interface: "selectChapterRoom/selectChapterNpc/interactWithChapterNpc/selectChapterInteractable/interactWithChapterInteractable",
    policy: "NPC/interactable branches execute restored config tokens and keep unknowns visible",
    currentRisk: `interactionHighRisk=${interactionCoverage.counts?.highRisk ?? "unknown"}`,
  },
  {
    algorithmId: "result_effect_executor",
    ownerModule: "src/resultPreparation.js + src/resultEffectExecutor.js; ChapterSession owns commit adoption",
    inputData: "resultLookup/resultEffectPolicies/rewardAttributeMap/chapterClearPolicy",
    interface: "applyResultEffects through configured action routes",
    policy: "result tokens map to named effect modules with evidence level; unknown stays audit-visible",
    currentRisk: `p2Rows=${p2Closure.totalP2Rows ?? "unknown"}; resultRows=${resultCoverage.rows ?? "unknown"}`,
  },
];

const summary = {
  generatedAt: new Date().toISOString(),
  outDir,
  conclusion: "Future work must start from evidence and config contracts, then extend generic runtime/UI seams only when the current framework cannot interpret a proven data shape.",
  currentEvidence: {
    contentBoundaryHigh: contentBoundary.counts?.high ?? "unknown",
    contentBoundaryPass: contentBoundary.passStrict ?? false,
    firstSessionStates: flow.states?.length || 0,
    firstSessionActions: flow.actions?.length || 0,
    chapterRooms: chapter.rooms?.length || 0,
    chapterNpcs: chapter.npcs?.length || 0,
    interactionActions: interactionCoverage.counts?.actions ?? "unknown",
    p2ClosurePassed: p2Closure.passed ?? false,
  },
};

writeCsv(path.join(outDir, "code_surface_analysis.csv"), codeSurfaceRows, [
  "file",
  "lines",
  "imports",
  "publicFunctions",
  "designRole",
  "configDrivenSignals",
  "concreteContentTokens",
  "requiredPolicy",
]);
writeCsv(path.join(outDir, "config_contract_matrix.csv"), configRows, [
  "configId",
  "file",
  "designRole",
  "records",
  "sourceEvidence",
  "nextRule",
]);
writeCsv(path.join(outDir, "competitor_evidence_sources.csv"), competitorEvidenceRows, [
  "sourceId",
  "sourcePath",
  "exists",
  "priority",
  "usage",
]);
writeCsv(path.join(outDir, "development_gate_matrix.csv"), developmentGateRows, [
  "gateId",
  "rule",
  "artifact",
  "blocking",
]);
writeCsv(path.join(outDir, "asset_governance_matrix.csv"), assetGovernanceRows, [
  "domain",
  "rule",
  "currentEvidence",
  "nextAction",
]);
writeCsv(path.join(outDir, "algorithm_seam_matrix.csv"), algorithmRows, [
  "algorithmId",
  "ownerModule",
  "inputData",
  "interface",
  "policy",
  "currentRisk",
]);
writeJson(path.join(outDir, "summary.json"), summary);

fs.writeFileSync(path.join(outDir, "predev_analysis_report.md"), [
  "# Pre-Development Analysis Package",
  "",
  "## Conclusion",
  "",
  summary.conclusion,
  "",
  "## Current Status",
  "",
  `- Content boundary high rows: ${summary.currentEvidence.contentBoundaryHigh}`,
  `- Content boundary pass: ${summary.currentEvidence.contentBoundaryPass}`,
  `- First-session states/actions: ${summary.currentEvidence.firstSessionStates}/${summary.currentEvidence.firstSessionActions}`,
  `- Chapter rooms/NPCs: ${summary.currentEvidence.chapterRooms}/${summary.currentEvidence.chapterNpcs}`,
  `- Interaction actions: ${summary.currentEvidence.interactionActions}`,
  `- P2 closure passed: ${summary.currentEvidence.p2ClosurePassed}`,
  "",
  "## Mandatory Development Order",
  "",
  "1. Read existing active runtime, config contracts, competitor Lua/config evidence, latest reports, and acceptance outputs.",
  "2. Produce line/module analysis and evidence ledger before design.",
  "3. Design data schema and content rows first; keep concrete content out of runtime code.",
  "4. Extend runtime/UI as generic modules only when config cannot be interpreted by existing seams.",
  "5. Bind assets through governed rows; competitor assets remain reference-only.",
  "6. Run automated audits and real browser/PIE/manual acceptance before claiming completion.",
  "",
  "## Outputs",
  "",
  "- code_surface_analysis.csv",
  "- config_contract_matrix.csv",
  "- competitor_evidence_sources.csv",
  "- development_gate_matrix.csv",
  "- asset_governance_matrix.csv",
  "- algorithm_seam_matrix.csv",
  "- summary.json",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify(summary, null, 2));
