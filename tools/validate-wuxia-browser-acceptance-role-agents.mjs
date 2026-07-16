import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "config", "wuxia_browser_acceptance_role_agents.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const allowedScenarios = new Set(["chapter1-deep", "interaction-contract", "all-key-screens", "entity-actions"]);
const errors = [];
const roleIds = new Set();
for (const role of config.roles || []) {
  if (!role.roleId || roleIds.has(role.roleId)) errors.push(`duplicate_or_missing_role_id:${role.roleId || "empty"}`);
  roleIds.add(role.roleId);
  if (!Array.isArray(role.skills) || !role.skills.length) errors.push(`missing_skills:${role.roleId}`);
  if (!Array.isArray(role.runnerArgs)) errors.push(`missing_runner_args:${role.roleId}`);
  if (!allowedScenarios.has(role.browserScenario)) errors.push(`unsupported_browser_scenario:${role.roleId}:${role.browserScenario}`);
  if (!role.outputDir?.startsWith("outputs/role_browser_acceptance/")) errors.push(`invalid_output_dir:${role.roleId}`);
  if (!role.passRule) errors.push(`missing_pass_rule:${role.roleId}`);
}
if (config.policy?.execution !== "sequential_real_browser_only") errors.push("execution_policy_must_be_sequential_real_browser_only");
for (const required of ["visible_dom_click", "resulting_runtime_state", "540x960_browser_screenshot", "role_report"]) {
  if (!config.policy?.requiredEvidence?.includes(required)) errors.push(`missing_required_evidence:${required}`);
}
const report = { generatedAt: new Date().toISOString(), roleCount: config.roles?.length || 0, errors };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
