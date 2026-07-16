import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);
const roleIndex = args.indexOf("--role");
const roleId = roleIndex >= 0 ? args[roleIndex + 1] : "";
if (!roleId) throw new Error("--role is required.");

const config = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_browser_acceptance_role_agents.json"), "utf8"));
const role = (config.roles || []).find((candidate) => candidate.roleId === roleId);
if (!role) throw new Error(`Unknown acceptance role: ${roleId}`);
if (config.policy?.execution !== "sequential_real_browser_only") throw new Error("Role browser acceptance requires sequential_real_browser_only policy.");

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const outputDir = path.join(root, role.outputDir, runId);
fs.mkdirSync(outputDir, { recursive: true });
const execution = spawnSync(process.execPath, [
  path.join(root, "tools", "run-wuxia-real-browser-flow.mjs"),
  "--scenario", role.browserScenario,
  "--out-dir", path.relative(root, outputDir),
  ...(role.runnerArgs || []),
], { cwd: root, encoding: "utf8" });
const flowSummaryPath = path.join(outputDir, "real_browser_flow_summary.json");
let flowSummary = null;
let parseError = "";
try { flowSummary = fs.existsSync(flowSummaryPath) ? JSON.parse(fs.readFileSync(flowSummaryPath, "utf8")) : null; }
catch (error) { parseError = error.message; }
const report = {
  generatedAt: new Date().toISOString(),
  roleId: role.roleId,
  title: role.title,
  skills: role.skills,
  browserScenario: role.browserScenario,
  passRule: role.passRule,
  executionPolicy: config.policy.execution,
  processExitCode: execution.status ?? -1,
  processSpawnError: execution.error?.message || "",
  flowSteps: flowSummary?.steps ?? 0,
  flowFailures: flowSummary?.failures?.length ?? 0,
  flowSummaryPath: path.relative(root, flowSummaryPath).replaceAll("\\", "/"),
  parseError,
  stdoutTail: String(execution.stdout || "").trim().slice(-1000),
  stderrTail: String(execution.stderr || "").trim().slice(-1000),
};
fs.writeFileSync(path.join(outputDir, "role_browser_acceptance_summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.processExitCode !== 0 || report.flowFailures || report.parseError) process.exitCode = 1;
