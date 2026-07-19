import fs from "node:fs";
import path from "node:path";

import {
  migrateEvidenceContract,
  validateEvidenceContract,
} from "../src/evidenceContract.js";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const schemaPath = path.join(root, "config", "wuxia_evidence_contract.schema.json");
const directionArg = process.argv.find((entry) => entry.startsWith("--direction="));
const direction = directionArg?.split("=")[1] || "up";
const write = process.argv.includes("--write");

const flow = JSON.parse(fs.readFileSync(flowPath, "utf8").replace(/^\uFEFF/, ""));
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, ""));
const migrated = migrateEvidenceContract(flow, {
  direction,
  contract: schema["x-idlewuxia-migration"],
});
const validation = direction === "up" ? validateEvidenceContract(migrated) : null;

if (validation?.status === "fail") {
  console.error(JSON.stringify(validation, null, 2));
  process.exit(1);
}
if (write) {
  fs.writeFileSync(flowPath, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  status: "pass",
  direction,
  wrote: write,
  flowPath,
  validation: validation?.summary || null,
}, null, 2));
