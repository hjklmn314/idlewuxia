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
const sourceDir = argValue("--source-dir", "outputs/browser_acceptance_chapter1_deep_20260712c");
const outputDir = path.join(root, "outputs", "wuxia_visual_browser_inventory_20260712");
const sourcePath = path.join(root, sourceDir, "real_browser_flow_summary.json");
if (!fs.existsSync(sourcePath)) throw new Error(`Missing real browser summary: ${sourcePath}`);
const flow = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const classifySurface = (row) => {
  if (row.screen === "UI_EarlyCombat") return "combat";
  if (/task|idle|hangup/i.test(row.label || "")) return "idle_task";
  if (/origin|opening|title|character/i.test(row.label || "")) return "onboarding";
  if (/npc|steward|coach|zhang|zhu|servant/i.test(row.label || "")) return "npc_interaction";
  if (/bookcase|bedroom|item|box/i.test(row.label || "")) return "interactable";
  return "map_or_navigation";
};
const checklist = (row) => {
  const surface = classifySurface(row);
  if (surface === "combat") return "portrait composition; unit readability; HP/MP; damage/heal/DoT/Buff cue; skill rhythm; jump text; no debug control; competitor visual reference";
  if (surface === "npc_interaction") return "NPC identity; action hierarchy; dialogue readability; condition visibility; touch target; log placement; competitor interaction reference";
  if (surface === "interactable") return "object identity; action meaning; result feedback; layout; touch target; competitor room/interactable reference";
  if (surface === "idle_task") return "task state; reward/progress readability; repeat feedback; CTA hierarchy; safe area";
  if (surface === "onboarding") return "text readability; choice hierarchy; CTA placement; portrait safe area; competitor recording layout reference";
  return "room title; exit layout; node overlap; room/NPC hierarchy; log readability; portrait safe area; competitor map reference";
};
const rows = (flow.results || []).map((row, index) => ({
  caseId: `VIS_${String(index + 1).padStart(3, "0")}`,
  step: row.label || "",
  state: row.state || "",
  screen: row.screen || "",
  roomId: row.roomId || "",
  surface: classifySurface(row),
  screenshot: row.screenshot || "",
  acceptanceChecklist: checklist(row),
  status: "pending_role_visual_review",
  finding: "",
  competitorEvidence: "required_before_pass",
}));
fs.mkdirSync(outputDir, { recursive: true });
const columns = ["caseId", "step", "state", "screen", "roomId", "surface", "screenshot", "acceptanceChecklist", "status", "finding", "competitorEvidence"];
fs.writeFileSync(path.join(outputDir, "visual_browser_acceptance_inventory.csv"), `${[columns.join(","), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\n")}\n`, "utf8");
const report = {
  generatedAt: new Date().toISOString(),
  sourceDir,
  totalCases: rows.length,
  pendingVisualReview: rows.length,
  rule: "Every real-browser screenshot must be reviewed by the UX/UI and art-direction roles. Missing review is a release blocker.",
};
fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
