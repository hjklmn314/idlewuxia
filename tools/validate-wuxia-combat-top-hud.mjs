import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const contractPath = path.join(root, "config", "wuxia_combat_top_hud.json");
const schemaPath = path.join(root, "config", "wuxia_combat_top_hud.schema.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const findings = [];
if (!validate(contract)) {
  for (const error of validate.errors || []) findings.push({ code: "COMBAT_TOP_HUD_SCHEMA", path: error.instancePath || "$", message: error.message || "schema validation failed" });
}
if (contract.maxHeightRatio > 0.18) findings.push({ code: "COMBAT_TOP_HUD_TOO_TALL", path: "$.maxHeightRatio", message: "runtime combat top HUD exceeds 18 percent" });
const zones = new Set((contract.zones || []).map((zone) => zone.id));
for (const id of ["context", "turn-order", "state-legend"]) if (!zones.has(id)) findings.push({ code: "COMBAT_TOP_HUD_ZONE_MISSING", path: "$.zones", message: `missing zone ${id}` });
for (const field of ["unitId", "side", "displayName", "alive", "actorMount", "turnIndex"]) {
  if (!(contract.turnOrder?.requiredFields || []).includes(field)) findings.push({ code: "COMBAT_TOP_HUD_BINDING_FIELD_MISSING", path: "$.turnOrder.requiredFields", message: `missing binding field ${field}` });
}
const result = { status: findings.length ? "FAIL" : "PASS", valid: findings.length === 0, contractPath: path.relative(root, contractPath).replaceAll("\\", "/"), findings };
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 1;
