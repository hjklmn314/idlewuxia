import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runProductionValidation } from "./validate-production-os.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs", "production_os");

function taskRows(tasks) {
  return tasks.map((task) =>
    `| ${task.id} | ${task.priority} | ${task.gate} | ${task.status} | ${task.owner} | ${task.title} |`,
  );
}

function gateRows(gates) {
  return gates.map((gate) =>
    `| ${gate.id} | ${gate.status} | ${gate.name} | ${gate.requiredTaskIds.join(", ")} |`,
  );
}

const { report, documents } = runProductionValidation({ writeReport: true });
const plan = documents.stagePlan;
const assets = documents.assetRegistry;
const ui = documents.uiExperienceRegistry;
const openTasks = plan.tasks.filter((task) => task.status !== "done");
const doneTaskIds = new Set(plan.tasks.filter((task) => task.status === "done").map((task) => task.id));
const nextP0Tasks = openTasks
  .filter((task) =>
    task.priority === "P0"
    && task.gate === plan.currentGate
    && task.status !== "postponed"
    && task.dependsOn.every((dependency) => doneTaskIds.has(dependency)),
  )
  .sort((left, right) => {
    const statusRank = { ready: 0, open: 1, blocked: 2 };
    return (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
  });

const markdown = [
  "# Idlewuxia Current Production Report",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `Contract validation: **${report.status.toUpperCase()}**`,
  `Production verdict: **${plan.currentVerdict}**`,
  `Current gate: **${plan.currentGate}**`,
  "",
  "This report is generated evidence. Configuration under `config/production/` remains the authority.",
  "",
  "## Production Summary",
  "",
  `- Gates: ${report.summary.gates}`,
  `- Tasks: ${report.summary.tasks}`,
  `- Open or postponed tasks: ${openTasks.length}`,
  `- Subsystems: ${report.summary.subsystems}`,
  `- UI acceptance matrix: ${ui.screens.length} screens x ${ui.viewports.length} viewports = ${report.summary.screenViewportPairs}`,
  `- Registered assets: ${assets.assets.length}; shipping-approved: ${report.summary.shippingAssets}`,
  `- Validation findings: ${report.summary.findings}`,
  "",
  "## Gates",
  "",
  "| Gate | Status | Purpose | Required Tasks |",
  "|---|---|---|---|",
  ...gateRows(plan.gates),
  "",
  "## Ready P0 Work In Current Gate",
  "",
  "| Task | Priority | Gate | Status | Owner | Title |",
  "|---|---|---|---|---|---|",
  ...taskRows(nextP0Tasks),
  "",
  "## Complete Task Register",
  "",
  "| Task | Priority | Gate | Status | Owner | Title |",
  "|---|---|---|---|---|---|",
  ...taskRows(plan.tasks),
  "",
  "## Asset Disposition",
  "",
  "| Asset | Kind | Provenance | License | Adoption |",
  "|---|---|---|---|---|",
  ...assets.assets.map((asset) =>
    `| ${asset.id} | ${asset.kind} | ${asset.provenance} | ${asset.licenseStatus} | ${asset.adoption} |`,
  ),
  "",
  "## Release Truth",
  "",
  "- A development debug APK is not a commercial release artifact.",
  "- Static or browser smoke checks do not substitute for the 11 x 3 visual matrix.",
  "- Reference parity does not prove ownership or redistribution rights.",
  "- COMBAT-002 and CombatSession remain postponed until explicit product-owner authorization.",
  "",
].join("\n");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "current-production-report.md"), markdown, "utf8");

console.log(JSON.stringify({
  status: report.status,
  report: "outputs/production_os/current-production-report.md",
  validation: "outputs/production_os/validation-report.json",
  nextP0Tasks: nextP0Tasks.map((task) => task.id),
}, null, 2));

if (report.status !== "pass") process.exitCode = 1;
