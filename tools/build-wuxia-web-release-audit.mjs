import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const argValue = (name, fallback = "") => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
};
const deepDirName = argValue("--deep-dir", "browser_acceptance_chapter1_deep_20260712c");
const deepDir = path.join(root, "outputs", deepDirName);
const outputDir = path.join(root, "outputs", "wuxia_web_release_audit_20260712");

const readJson = (filePath, fallback = null) => {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback; }
  catch (error) { return { parseError: error.message }; }
};
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = (filePath, rows, columns) => fs.writeFileSync(
  filePath,
  `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`,
  "utf8",
);

const completeness = readJson(path.join(root, "outputs", "wuxia_web_acceptance_completeness_20260711", "summary.json"), {});
const deep = readJson(path.join(deepDir, "real_browser_flow_summary.json"), {});
const stepRows = (deep.results || []).map((row, index) => ({
  order: index + 1,
  label: row.label || "",
  state: row.state || "",
  screen: row.screen || "",
  roomId: row.roomId || "",
  click: row.click?.clicked === true ? "clicked" : (row.click?.reason || "capture_only"),
  result: row.error ? "failed" : "passed",
  error: row.error || "",
  screenshot: row.screenshot || "",
}));

const visualFindings = [
  {
    severity: "blocker",
    surface: "combat_stage",
    finding: "Real browser combat uses flat yellow placeholder figures and a generic dark building silhouette; it has no competitor-equivalent unit art, animation, impact cue, Buff icon treatment, or readable damage sequence.",
    evidence: `${deepDirName}/14_old_steward_compete_win.png; ${deepDirName}/22_coach_zhao_compete_win.png`,
    acceptance: "fail_product_visual_parity",
  },
  {
    severity: "blocker",
    surface: "map_navigation",
    finding: "Room navigation is rendered as a debug grid with rectangular direction buttons, not a competitor-style room/map surface with authored visual hierarchy and touch affordances.",
    evidence: `${deepDirName}/51_west_corridor_servant_room.png`,
    acceptance: "fail_product_visual_parity",
  },
  {
    severity: "high",
    surface: "npc_interaction",
    finding: "NPC and object interaction surfaces are functional, but remain raw action-button cards with debug-like layout; all visible actions still need individual Lua/config evidence and browser coverage.",
    evidence: `${deepDirName}/53_servant_talk.png; ${deepDirName}/40_study_bookcase_20_use.png`,
    acceptance: "fail_product_interaction_presentation",
  },
  {
    severity: "high",
    surface: "coverage",
    finding: "The completed deep route is one configuration path. It does not substitute for exhaustive validation of all visible FB01 actions, rejected conditions, or feedback-only executors.",
    evidence: "wuxia_web_acceptance_completeness_20260711/summary.json",
    acceptance: "fail_coverage_gate",
  },
];

const counts = completeness.counts || {};
const deepFailures = stepRows.filter((row) => row.result === "failed");
const releaseBlocked = deep.parseError || !stepRows.length || deepFailures.length > 0
  || Number(counts.browserPending || 0) > 0
  || Number(counts.executorGaps || 0) > 0
  || visualFindings.some((row) => row.severity === "blocker");

fs.mkdirSync(outputDir, { recursive: true });
writeCsv(path.join(outputDir, "chapter1_deep_browser_steps.csv"), stepRows, ["order", "label", "state", "screen", "roomId", "click", "result", "error", "screenshot"]);
writeCsv(path.join(outputDir, "visual_acceptance_findings.csv"), visualFindings, ["severity", "surface", "finding", "evidence", "acceptance"]);
const report = {
  generatedAt: new Date().toISOString(),
  policy: "Release acceptance requires real browser interaction, configuration/evidence traceability, and visual inspection. A route pass does not erase uncovered actions or placeholder presentation.",
  releaseStatus: releaseBlocked ? "blocked" : "passed",
  deepRoute: {
    evidenceDir: `outputs/${deepDirName}`,
    steps: stepRows.length,
    failures: deepFailures.length,
  },
  completeness: counts,
  visualFindings,
};
fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outputDir, "web_release_audit.md"), [
  "# Wuxia Web Release Audit",
  "",
  "## Verdict",
  "",
  `- releaseStatus: **${report.releaseStatus}**`,
  `- real-browser deep route: ${stepRows.length} steps / ${deepFailures.length} failed`,
  `- visible FB01 actions without browser evidence: ${counts.browserPending ?? "unknown"}`,
  `- feedback-only or missing executors: ${counts.executorGaps ?? "unknown"}`,
  `- current visual findings: ${visualFindings.length}`,
  "",
  "## What Passed",
  "",
  "The single configuration-derived route through the opening, old steward, Zhao, Zhou, Zhang Feng, owner rooms, objects, and servant completed in a real 540x960 browser run. This is a narrow functional result, not a release pass.",
  "",
  "## Release Blockers",
  "",
  ...visualFindings.map((row) => `- ${row.severity.toUpperCase()} | ${row.surface}: ${row.finding}`),
  "",
  "## Required Closure Order",
  "",
  "1. Keep real-browser audits sequential and classify all interrupted browser infrastructure rows separately from product failures.",
  "2. Add config-backed executors or hide every visible action that has neither a Lua/config-proven result nor a safe presentation state.",
  "3. Turn each of the 11 configured screens into a real-browser evidence case with action, state, safe-area, touch-bound, and screenshot assertions.",
  "4. Replace browser combat/map/NPC placeholder presentation using owned assets and a data-driven visual contract before requesting product-quality acceptance.",
  "",
].join("\n"), "utf8");
console.log(JSON.stringify(report, null, 2));
if (releaseBlocked) process.exitCode = 1;
