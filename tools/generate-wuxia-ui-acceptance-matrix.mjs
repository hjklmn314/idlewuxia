import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "config", "production", "ui_experience_registry.json");
const screenContractPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");
const outputDir = path.join(root, "outputs", "production_os");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const registry = readJson(registryPath);
const screenContract = readJson(screenContractPath);
const contractScreenIds = new Set(Object.keys(screenContract.screens || {}));
const cases = [];

for (const screen of registry.screens) {
  if (!contractScreenIds.has(screen.id)) {
    throw new Error(`UI registry screen is missing from active screen contract: ${screen.id}`);
  }
  for (const viewport of registry.viewports) {
    cases.push({
      caseId: `${screen.id}__${viewport.id}`,
      screenId: screen.id,
      viewportId: viewport.id,
      width: viewport.width,
      height: viewport.height,
      playerGoal: screen.playerGoal,
      primaryInput: screen.primaryInput,
      requiredFeedback: screen.requiredFeedback,
      acceptanceStatus: screen.acceptanceStatus || "active",
      postponedBy: screen.postponedBy || null,
      requiredEvidence: [
        "screenshot",
        "dom-state",
        "computed-style",
        "overflow",
        "console",
        "interaction-before-after"
      ]
    });
  }
}

if (cases.length !== registry.acceptancePolicy.requiredScreenViewportPairs) {
  throw new Error(
    `UI matrix count drift: generated ${cases.length}, expected ${registry.acceptancePolicy.requiredScreenViewportPairs}`,
  );
}

const output = {
  schema: "idlewuxia.ui_acceptance_matrix.v1",
  generatedAt: new Date().toISOString(),
  authority: "config/production/ui_experience_registry.json",
  registryHash: hashJson(registry),
  screenContractHash: hashJson(screenContract),
  policy: registry.acceptancePolicy,
  summary: {
    screens: registry.screens.length,
    viewports: registry.viewports.length,
    cases: cases.length,
    activeCases: cases.filter((entry) => entry.acceptanceStatus === "active").length,
    postponedCases: cases.filter((entry) => entry.acceptanceStatus === "postponed").length,
  },
  cases,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "ui-acceptance-matrix.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  status: "pass",
  output: "outputs/production_os/ui-acceptance-matrix.json",
  summary: output.summary,
}, null, 2));
