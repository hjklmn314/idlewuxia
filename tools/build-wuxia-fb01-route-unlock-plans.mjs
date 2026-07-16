import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const batchPath = path.join(root, "outputs", "wuxia_fb01_browser_interaction_crawl_batches", "fb01_browser_crawl_batches.csv");
const outDir = path.join(root, "outputs", "wuxia_fb01_route_unlock_plans");
const probeRoot = path.join(root, "outputs", "wuxia_fb01_route_unlock_probes");

function parseCsv(text) {
  const rows = [];
  let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] || ""])));
}

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
const batches = parseCsv(fs.readFileSync(batchPath, "utf8").replace(/^\uFEFF/, ""));
const chapter = flow.chapter1 || {};
const npcs = chapter.npcs || [];
const rolesById = new Map(npcs.map((npc) => [npc.roleId, npc]));
const gateEvidence = [...new Set(batches.map((batch) => batch.routeGateEvidence).filter(Boolean))];

function reverseTestedActivationAction(roleId, expectedVisibleNpcId) {
  if (!fs.existsSync(probeRoot)) return null;
  for (const entry of fs.readdirSync(probeRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    if (!entry.name.startsWith(`${roleId}_`)) continue;
    const summaryPath = path.join(probeRoot, entry.name, "real_browser_flow_summary.json");
    if (!fs.existsSync(summaryPath)) continue;
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      const visibility = (summary.results || []).find((result) => result.expectedVisibleNpcId === expectedVisibleNpcId);
      if (!visibility?.visible || (summary.failures || []).length) continue;
      const actionResult = (summary.results || []).find((result) => String(result.label || "").startsWith(`crawl_npc_${roleId}_`));
      const actionType = String(actionResult?.label || "").slice(`crawl_npc_${roleId}_`.length);
      if (actionType) return { actionType, summaryPath: path.relative(root, summaryPath).replaceAll("\\", "/") };
    } catch {
      // Invalid evidence is deliberately ignored instead of being treated as a passing reverse test.
    }
  }
  return null;
}

function resultSwap(branch, fromRoleId) {
  return (branch.resolvedResults || []).find((result) => (
    result.action === "换人"
    && result.args?.Arg3 === fromRoleId
  ));
}

function sourceUnlockSteps(blocker, conditionToken) {
  const candidates = npcs.filter((npc) => (
    (npc.branches || []).some((branch) => (branch.conditionTokens || []).includes(conditionToken))
  ));
  const steps = [];
  for (const npc of candidates) {
    const winBranch = (npc.branches || []).find((branch) => (branch.conditionTokens || []).includes("comparewin"));
    if (!winBranch) continue;
    const predecessor = npcs.flatMap((candidate) => (candidate.branches || []).map((branch) => ({ candidate, branch })))
      .find(({ branch }) => resultSwap(branch, npc.roleId));
    if (predecessor) {
      const action = (predecessor.candidate.actions || []).find((item) => (predecessor.branch.actionHints || []).includes(item.actionType));
      const reverseTest = action ? null : reverseTestedActivationAction(predecessor.candidate.roleId, npc.roleId);
      if (action) {
        steps.push({
          order: steps.length + 1,
          roleId: predecessor.candidate.roleId,
          actionType: action.actionType,
          status: "executable_config_bound",
          purpose: `activate ${npc.roleId} through ${predecessor.branch.resultTokens.join(";")}`,
          evidence: predecessor.branch.evidenceLevel || "config_confirmed",
        });
      } else if (reverseTest) {
        steps.push({
          order: steps.length + 1,
          roleId: predecessor.candidate.roleId,
          actionType: reverseTest.actionType,
          status: "reverse_tested_action_bound",
          purpose: `activate ${npc.roleId} through ${predecessor.branch.resultTokens.join(";")}; no Lua actionHints`,
          evidence: `real_browser_reverse_test:${reverseTest.summaryPath}`,
        });
      } else {
        steps.push({
          order: steps.length + 1,
          roleId: predecessor.candidate.roleId,
          actionType: "",
          status: "action_binding_evidence_required",
          purpose: `activate ${npc.roleId} through ${predecessor.branch.resultTokens.join(";")}; branch has no actionHints`,
          evidence: predecessor.branch.evidenceLevel || "config_confirmed",
        });
      }
    }
    steps.push({
      order: steps.length + 1,
      roleId: npc.roleId,
      actionType: "compete",
      status: "executable_config_bound",
      purpose: `satisfy ${conditionToken} via comparewin; results ${winBranch.resultTokens.join(";")}`,
      evidence: winBranch.evidenceLevel || "config_confirmed",
    });
  }
  return steps;
}

const plans = gateEvidence.map((evidence) => {
  const [roomId, blockerRoleId, conditionToken] = evidence.split(":");
  const blocker = rolesById.get(blockerRoleId);
  const blockerBranch = (blocker?.branches || []).find((branch) => (branch.conditionTokens || []).includes(conditionToken));
  const condition = chapter.conditionLookup?.[conditionToken] || {};
  return {
    routeGateEvidence: evidence,
    roomId,
    blockerRoleId,
    blockerName: blocker?.name || "",
    conditionToken,
    targetRoomId: condition.arg2 || condition.args?.Arg2 || "",
    blockedResultTokens: blockerBranch?.resultTokens || [],
    blockedNarrativeLines: blockerBranch?.narrativeLines || [],
    unlockSteps: sourceUnlockSteps(blocker, conditionToken),
    evidence: blocker?.evidence || {},
  };
});

fs.mkdirSync(outDir, { recursive: true });
const rows = plans.flatMap((plan) => plan.unlockSteps.map((step) => ({
  routeGateEvidence: plan.routeGateEvidence,
  roomId: plan.roomId,
  blockerRoleId: plan.blockerRoleId,
  blockerName: plan.blockerName,
  conditionToken: plan.conditionToken,
  targetRoomId: plan.targetRoomId,
  blockedResultTokens: plan.blockedResultTokens.join(";"),
  stepOrder: step.order,
  roleId: step.roleId,
  actionType: step.actionType,
  status: step.status,
  purpose: step.purpose,
  evidence: step.evidence,
})));
const columns = ["routeGateEvidence", "roomId", "blockerRoleId", "blockerName", "conditionToken", "targetRoomId", "blockedResultTokens", "stepOrder", "roleId", "actionType", "status", "purpose", "evidence"];
fs.writeFileSync(path.join(outDir, "fb01_route_unlock_steps.csv"), `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "fb01_route_unlock_plans.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), plans }, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "fb01_route_unlock_plans.md"), [
  "# FB01 Route Unlock Plans",
  "",
  "Generated from restored map-role branches. It is a configuration-derived plan, not a hardcoded walkthrough.",
  "",
  ...plans.flatMap((plan) => [
    `## ${plan.roomId}: ${plan.blockerName} (${plan.conditionToken})`,
    `- gate evidence: ${plan.routeGateEvidence}`,
    `- target room after unlock: ${plan.targetRoomId || "missing"}`,
    `- blocker results: ${plan.blockedResultTokens.join("; ") || "none"}`,
    ...plan.unlockSteps.map((step) => `- ${step.order}. ${step.roleId} -> ${step.actionType || "[action evidence required]"} [${step.status}]: ${step.purpose}`),
    "",
  ]),
].join("\n"), "utf8");

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  plans: plans.length,
  steps: rows.length,
  outputDir: path.relative(root, outDir).replaceAll("\\", "/"),
}, null, 2));
