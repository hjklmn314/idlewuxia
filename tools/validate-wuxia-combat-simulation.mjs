import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "wuxia_combat_simulation.json");
const schemaPath = path.join(root, "config", "wuxia_combat_simulation.schema.json");
const contentPath = path.join(root, "config", "wuxia_combat_content.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const valid = ajv.compile(schema)(config);
const findings = [];
if (!valid) for (const error of ajv.errors || []) findings.push({ path: error.instancePath || "/", message: error.message || "schema error" });
const encounterIds = new Set((content.encounters || []).map((row) => row.encounterId));
const scenarioIds = new Set();
for (const [index, scenario] of (config.scenarios || []).entries()) {
  if (scenarioIds.has(scenario.scenarioId)) findings.push({ path: `/scenarios/${index}/scenarioId`, message: `duplicate scenario ${scenario.scenarioId}` });
  scenarioIds.add(scenario.scenarioId);
  if (!encounterIds.has(scenario.encounterId)) findings.push({ path: `/scenarios/${index}/encounterId`, message: `unknown encounter ${scenario.encounterId}` });
  if (Number(scenario.balance.winRateMin) > Number(scenario.balance.winRateMax)) findings.push({ path: `/scenarios/${index}/balance`, message: "winRateMin must not exceed winRateMax" });
}
if (!findings.length) {
  console.log(JSON.stringify({ accepted: true, scenarios: config.scenarios.length, runsPerScenario: config.runsPerScenario }, null, 2));
  process.exit(0);
}
console.error(JSON.stringify({ accepted: false, findings }, null, 2));
process.exit(1);
